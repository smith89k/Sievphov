using System.Drawing;
using System.Drawing.Printing;
using Sievphov.Models;
using Sievphov.Services;

namespace Sievphov.Printing;

/// <summary>How far printing is: one file's state, and the whole job's share done (0…1).</summary>
/// <param name="Status">printing · printed · error · stopped</param>
public sealed record PrintProgress(string Id, string Status, string Message, int Side, int Sides, int File, int Files, double Fraction);

/// <summary>Prints the list one file at a time, each with its own printer and settings.</summary>
public sealed class PrintEngine
{
    private readonly ManualResetEventSlim _running = new(true);
    private CancellationTokenSource _cts = new();

    /// <summary>Raised on the printing thread.</summary>
    public event Action<PrintProgress>? Progress;

    public bool IsPaused => !_running.IsSet;

    /// <summary>Self-test only: print each file into this file (for "Microsoft Print to PDF").</summary>
    public Func<JobItem, string>? PrintToFile { get; set; }

    /// <summary>Self-test only: print two-sided jobs one-sided when the printer cannot duplex.</summary>
    public bool AllowOneSidedFallback { get; set; }

    public void Pause() => _running.Reset();
    public void Resume() => _running.Set();

    public void Stop()
    {
        _cts.Cancel();
        _running.Set();
    }

    /// <summary>Runs on its own STA thread so the window stays responsive.</summary>
    public Task<List<ReportRow>> RunAsync(IReadOnlyList<JobItem> items, AfterPrintSettings after)
    {
        _cts = new CancellationTokenSource();
        _running.Set();
        var done = new TaskCompletionSource<List<ReportRow>>();
        var thread = new Thread(() =>
        {
            try
            {
                done.SetResult(RunAll(items, after, _cts.Token));
            }
            catch (Exception ex)
            {
                done.SetException(ex);
            }
        })
        {
            IsBackground = true,
            Name = "Sievphov printing",
        };
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        return done.Task;
    }

    private List<ReportRow> RunAll(IReadOnlyList<JobItem> items, AfterPrintSettings after, CancellationToken token)
    {
        var report = new List<ReportRow>();
        for (int n = 0; n < items.Count; n++)
        {
            var item = items[n];
            var row = new ReportRow
            {
                Id = item.Id,
                FileName = item.FileName,
                Folder = item.Folder,
                Printer = string.IsNullOrEmpty(item.Settings.PrinterName) ? PrinterCatalog.DefaultPrinter() : item.Settings.PrinterName,
                Copies = item.Settings.Copies,
                Started = DateTime.Now,
            };
            report.Add(row);

            if (token.IsCancellationRequested)
            {
                Report(item, "stopped", "Not printed (stopped)", n, items.Count, n);
                row.Status = "Stopped";
                row.Message = "Not printed (stopped)";
                continue;
            }

            try
            {
                Report(item, "printing", "Starting…", n, items.Count, n);
                var (pages, sheets, cancelled) = PrintOne(item, n, items.Count, token);
                row.Pages = pages;
                row.Sheets = sheets;
                if (cancelled)
                {
                    Report(item, "stopped", "Stopped while printing", n, items.Count, n + 1);
                    row.Status = "Stopped";
                    row.Message = "Stopped while printing";
                }
                else
                {
                    var (note, newPath) = AfterPrint(item, after);
                    row.NewPath = newPath;
                    row.Status = "Printed";
                    row.Message = note;
                    Report(item, "printed", note, n, items.Count, n + 1);
                }
            }
            catch (Exception ex)
            {
                var message = PdfFile.Describe(ex);
                Report(item, "error", message, n, items.Count, n + 1);
                row.Status = "Error";
                row.Message = message;
            }
            row.Finished = DateTime.Now;
        }
        return report;
    }

    private (int Pages, int Sheets, bool Cancelled) PrintOne(JobItem item, int index, int count, CancellationToken token)
    {
        var s = item.Settings;
        if (!File.Exists(item.FilePath)) throw new FileNotFoundException("File not found", item.FilePath);

        var pages = PageRangeParser.SelectPages(s, item.PageCount);
        if (pages.Count == 0) throw new InvalidOperationException("No pages selected (check the page range)");
        var sides = SheetLayout.Build(pages, s);
        var sequence = SheetLayout.WithCopies(sides, s);
        int sheets = SheetLayout.SheetsPerCopy(sides, s) * Math.Max(1, s.Copies);

        using var doc = new PrintDocument
        {
            DocumentName = item.FileName,
            PrintController = new StandardPrintController(), // no "Printing page…" pop-up
        };
        Configure(doc, s, item, pages[0], AllowOneSidedFallback);
        if (PrintToFile is not null)
        {
            doc.PrinterSettings.PrintToFile = true;
            doc.PrinterSettings.PrintFileName = PrintToFile(item);
        }

        var pdf = File.ReadAllBytes(item.FilePath);
        using var renderer = new SheetRenderer(item, pdf);
        int next = 0;
        bool cancelled = false;

        doc.PrintPage += (_, e) =>
        {
            try
            {
                _running.Wait(token);
            }
            catch (OperationCanceledException)
            {
                cancelled = true;
                e.Cancel = true;
                e.HasMorePages = false;
                return;
            }

            var g = e.Graphics!;
            var ps = e.PageSettings;
            // Draw in whole-sheet coordinates: (0,0) is the paper corner, not the printable corner.
            g.TranslateTransform(-ps.HardMarginX, -ps.HardMarginY);
            var sheet = new RectangleF(0, 0, e.PageBounds.Width, e.PageBounds.Height);
            var printable = RectangleF.Inflate(sheet, -ps.HardMarginX, -ps.HardMarginY);
            if (!sequence[next].IsBlank)
            {
                // One solid picture per side: printers handle see-through watermarks badly.
                using var composed = Compose(renderer, printable, sequence[next], s.Dpi);
                g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                g.DrawImage(composed, printable);
            }

            next++;
            Progress?.Invoke(new PrintProgress(item.Id, "printing", $"Side {next} of {sequence.Count}", next, sequence.Count,
                index + 1, count, (index + (double)next / sequence.Count) / count));
            e.HasMorePages = next < sequence.Count;
        };

        doc.Print();
        return (pages.Count * Math.Max(1, s.Copies), sheets, cancelled || token.IsCancellationRequested);
    }

    /// <summary>Draws a whole side into one bitmap at <paramref name="dpi"/> (kept under ~120 megapixels).</summary>
    private static Bitmap Compose(SheetRenderer renderer, RectangleF area, SheetSide side, int dpi)
    {
        double pixels = area.Width / 100.0 * dpi * (area.Height / 100.0 * dpi);
        if (pixels > 120e6) dpi = (int)(dpi * Math.Sqrt(120e6 / pixels));
        int w = Math.Max(1, (int)Math.Ceiling(area.Width / 100f * dpi));
        int h = Math.Max(1, (int)Math.Ceiling(area.Height / 100f * dpi));
        var bmp = new Bitmap(w, h, System.Drawing.Imaging.PixelFormat.Format24bppRgb);
        bmp.SetResolution(dpi, dpi);
        using var g = Graphics.FromImage(bmp);
        g.Clear(Color.White);
        g.PageUnit = GraphicsUnit.Pixel;
        g.ScaleTransform(dpi / 100f, dpi / 100f);
        g.TranslateTransform(-area.X, -area.Y);
        renderer.DrawSide(g, area, side);
        return bmp;
    }

    /// <summary>Sets printer, tray, paper, sides, orientation and color for this file only.</summary>
    private static void Configure(PrintDocument doc, PrintSettings s, JobItem item, int firstPage, bool allowOneSided)
    {
        var ps = doc.PrinterSettings;
        if (!string.IsNullOrEmpty(s.PrinterName)) ps.PrinterName = s.PrinterName;
        if (!ps.IsValid) throw new InvalidOperationException($"Printer \"{s.PrinterName}\" is not installed");

        // Copies are made by Sievphov itself so every printer behaves the same.
        ps.Copies = 1;
        ps.Collate = false;

        if (s.IsTwoSided)
        {
            if (!ps.CanDuplex && !allowOneSided) throw new InvalidOperationException($"\"{ps.PrinterName}\" cannot print on both sides");
            // Booklets are landscape sheets folded in the middle: flip on the short edge.
            ps.Duplex = !ps.CanDuplex ? Duplex.Simplex
                : s.Layout == LayoutMode.Booklet || s.Sides == SidesMode.ShortEdge ? Duplex.Horizontal : Duplex.Vertical;
        }
        else
        {
            ps.Duplex = Duplex.Simplex;
        }

        var page = doc.DefaultPageSettings;
        if (!string.IsNullOrEmpty(s.PaperSize))
        {
            page.PaperSize = ps.PaperSizes.Cast<PaperSize>().FirstOrDefault(p => p.PaperName == s.PaperSize)
                ?? throw new InvalidOperationException($"Paper \"{s.PaperSize}\" is not offered by \"{ps.PrinterName}\"");
        }
        if (!string.IsNullOrEmpty(s.Tray))
        {
            page.PaperSource = ps.PaperSources.Cast<PaperSource>().FirstOrDefault(p => p.SourceName == s.Tray)
                ?? throw new InvalidOperationException($"Tray \"{s.Tray}\" is not on \"{ps.PrinterName}\"");
        }

        var paper = page.PaperSize;
        var portrait = new SizeF(Math.Min(paper.Width, paper.Height), Math.Max(paper.Width, paper.Height));
        var first = item.PageSizes.Count >= firstPage ? item.PageSizes[firstPage - 1] : new SizeF(595, 842);
        page.Landscape = LayoutMath.SheetIsLandscape(s, first, portrait);
        if (ps.SupportsColor) page.Color = !s.Grayscale;
    }

    /// <summary>Moves or copies the printed PDF when the user asked for that → (note for the report, new path if moved).</summary>
    private static (string Note, string? NewPath) AfterPrint(JobItem item, AfterPrintSettings after)
    {
        if (after.Action == AfterPrintAction.Nothing || string.IsNullOrWhiteSpace(after.Folder)) return ("", null);
        try
        {
            Directory.CreateDirectory(after.Folder);
            var target = UniquePath(Path.Combine(after.Folder, item.FileName));
            if (after.Action == AfterPrintAction.MoveTo)
            {
                File.Move(item.FilePath, target);
                return ("Moved to " + after.Folder, target);
            }
            File.Copy(item.FilePath, target);
            return ("Copied to " + after.Folder, null);
        }
        catch (Exception ex)
        {
            return ("Printed, but could not move/copy: " + ex.Message, null);
        }
    }

    private static string UniquePath(string path)
    {
        if (!File.Exists(path)) return path;
        var dir = Path.GetDirectoryName(path)!;
        var name = Path.GetFileNameWithoutExtension(path);
        var ext = Path.GetExtension(path);
        for (int i = 2; ; i++)
        {
            var candidate = Path.Combine(dir, $"{name} ({i}){ext}");
            if (!File.Exists(candidate)) return candidate;
        }
    }

    private void Report(JobItem item, string status, string message, int index, int count, int filesDone) =>
        Progress?.Invoke(new PrintProgress(item.Id, status, message, 0, 0, index + 1, count, (double)filesDone / count));
}
