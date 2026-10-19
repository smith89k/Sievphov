using System.Drawing;
using System.Drawing.Printing;
using System.Windows.Threading;
using Sievphov.Models;
using Sievphov.Services;

namespace Sievphov.Printing;

/// <summary>Prints the list one file at a time, each with its own printer and settings.</summary>
public sealed class PrintEngine
{
    private readonly Dispatcher _ui;
    private readonly ManualResetEventSlim _running = new(true);
    private CancellationTokenSource _cts = new();

    public PrintEngine(Dispatcher ui)
    {
        _ui = ui;
    }

    /// <summary>"File 1 of 3, side 40 of 120" style text.</summary>
    public event Action<string, double>? Progress;

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
    public Task<List<ReportRow>> RunAsync(IReadOnlyList<JobItem> items, AppSettings app)
    {
        _cts = new CancellationTokenSource();
        _running.Set();
        var done = new TaskCompletionSource<List<ReportRow>>();
        var thread = new Thread(() =>
        {
            try
            {
                done.SetResult(RunAll(items, app, _cts.Token));
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

    private List<ReportRow> RunAll(IReadOnlyList<JobItem> items, AppSettings app, CancellationToken token)
    {
        var report = new List<ReportRow>();
        for (int n = 0; n < items.Count; n++)
        {
            var item = items[n];
            var row = new ReportRow
            {
                FileName = item.FileName,
                Folder = item.Folder,
                Printer = OnUi(() => item.PrinterDisplay),
                Preset = OnUi(() => item.PresetDisplay),
                Copies = item.Settings.Copies,
                Started = DateTime.Now,
            };
            report.Add(row);

            if (token.IsCancellationRequested)
            {
                SetStatus(item, ItemStatus.Stopped, "");
                row.Status = "Stopped";
                row.Message = "Not printed (stopped)";
                continue;
            }

            try
            {
                SetStatus(item, ItemStatus.Printing, "Starting…");
                var (pages, sheets, cancelled) = PrintOne(item, n, items.Count, token);
                row.Pages = pages;
                row.Sheets = sheets;
                if (cancelled)
                {
                    SetStatus(item, ItemStatus.Stopped, "");
                    row.Status = "Stopped";
                    row.Message = "Stopped while printing";
                }
                else
                {
                    var after = AfterPrint(item, app);
                    SetStatus(item, ItemStatus.Printed, "");
                    row.Status = "Printed";
                    row.Message = after;
                }
            }
            catch (Exception ex)
            {
                var message = PdfFile.Describe(ex);
                SetStatus(item, ItemStatus.Error, message);
                row.Status = "Error";
                row.Message = message;
            }
            row.Finished = DateTime.Now;
        }
        Progress?.Invoke(token.IsCancellationRequested ? "Stopped" : "Finished", 1);
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
            Progress?.Invoke($"Printing file {index + 1} of {count}: {item.FileName} — side {next} of {sequence.Count}",
                (index + (double)next / sequence.Count) / count);
            SetStatus(item, ItemStatus.Printing, $"Side {next}/{sequence.Count}");
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

    /// <summary>Moves or copies the printed PDF when the user asked for that.</summary>
    private string AfterPrint(JobItem item, AppSettings app)
    {
        if (app.AfterPrint == AfterPrintAction.Nothing || string.IsNullOrWhiteSpace(app.AfterPrintFolder)) return "";
        try
        {
            Directory.CreateDirectory(app.AfterPrintFolder);
            var target = UniquePath(Path.Combine(app.AfterPrintFolder, item.FileName));
            if (app.AfterPrint == AfterPrintAction.MoveTo)
            {
                File.Move(item.FilePath, target);
                OnUi(() => item.FilePath = target);
                return "Moved to " + app.AfterPrintFolder;
            }
            File.Copy(item.FilePath, target);
            return "Copied to " + app.AfterPrintFolder;
        }
        catch (Exception ex)
        {
            return "Printed, but could not move/copy: " + ex.Message;
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

    private void SetStatus(JobItem item, ItemStatus status, string message) =>
        _ui.BeginInvoke(() => { item.Status = status; item.Message = message; });

    private T OnUi<T>(Func<T> f) => _ui.Invoke(f);
    private void OnUi(Action a) => _ui.Invoke(a);
}
