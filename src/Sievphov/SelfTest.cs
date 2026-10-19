using System.Drawing;
using System.Drawing.Imaging;
using Sievphov.Models;
using Sievphov.Printing;
using Sievphov.Services;

namespace Sievphov;

/// <summary>
/// <c>Sievphov.exe --selftest &lt;folder&gt;</c>: prints sample books to "Microsoft Print to PDF"
/// (no paper) with booklet, 2-up, page range, copies, Khmer page numbers and a watermark,
/// and saves preview pictures. Used by the Windows build on GitHub.
/// </summary>
public static class SelfTest
{
    private const string Printer = "Microsoft Print to PDF";

    public static async Task<int> RunAsync(string folder, System.Windows.Threading.Dispatcher ui)
    {
        Directory.CreateDirectory(folder);
        var log = new List<string>();
        void Log(string line) { log.Add(line); File.WriteAllLines(Path.Combine(folder, "selftest.log"), log); }

        try
        {
            Log("Printers: " + string.Join(" | ", PrinterCatalog.Printers()));
            if (!PrinterCatalog.Printers().Contains(Printer))
            {
                Log($"FAIL: \"{Printer}\" is not installed.");
                return 2;
            }
            var caps = PrinterCatalog.For(Printer);
            Log($"Trays: {string.Join(" | ", caps.Trays)}");
            Log($"Paper sizes: {string.Join(" | ", caps.PaperSizes.Take(12))}");

            var items = new List<JobItem>
            {
                Make(folder, "booklet8.pdf", Enumerable.Repeat((420f, 595f), 8).ToArray(), s =>
                {
                    s.Layout = LayoutMode.Booklet;
                    s.Sides = SidesMode.ShortEdge;
                    s.PageNumbers.Enabled = true;
                    s.PageNumbers.Format = "ទំព័រ {page}";
                    s.PageNumbers.Digits = DigitStyle.Khmer;
                    s.PageNumbers.Position = StampPosition.BottomOutside;
                    s.PageNumbers.SizePt = 14;
                    s.Watermark.Enabled = true;
                    s.Watermark.Text = "សៀវភៅ សាកល្បង";
                    s.Watermark.SizePt = 40;
                }),
                Make(folder, "twoup5.pdf", Enumerable.Repeat((595f, 842f), 5).ToArray(), s =>
                {
                    s.Layout = LayoutMode.PagesPerSheet;
                    s.Columns = 2;
                    s.Rows = 1;
                    s.Borders = true;
                }),
                Make(folder, "range6.pdf", new[] { (595f, 842f), (595f, 842f), (842f, 595f), (595f, 842f), (595f, 842f), (595f, 842f) }, s =>
                {
                    s.Pages = PageSelection.Range;
                    s.PageRange = "2-3";
                    s.Copies = 2;
                    s.Grayscale = true;
                }),
            };

            // Preview pictures (same drawing code as printing).
            foreach (var item in items)
                SavePreview(item, Path.Combine(folder, Path.GetFileNameWithoutExtension(item.FilePath) + "-preview.png"));
            Log("Previews saved.");

            var engine = new PrintEngine(ui)
            {
                PrintToFile = i => Path.Combine(folder, "printed-" + i.FileName),
                AllowOneSidedFallback = true,
            };
            var report = await engine.RunAsync(items, new AppSettings());
            int failures = 0;
            foreach (var r in report)
            {
                var output = Path.Combine(folder, "printed-" + r.FileName);
                bool ok = r.Status == "Printed" && File.Exists(output) && new FileInfo(output).Length > 0;
                if (!ok) failures++;
                Log($"{(ok ? "OK  " : "FAIL")} {r.FileName}: {r.Status} {r.Message} · pages {r.Pages} · sheets {r.Sheets}");
            }
            Log(failures == 0 ? "PASSED" : $"FAILED ({failures})");
            return failures == 0 ? 0 : 1;
        }
        catch (Exception ex)
        {
            Log("FAIL: " + ex);
            return 3;
        }
    }

    private static JobItem Make(string folder, string name, (float W, float H)[] pages, Action<PrintSettings> setup)
    {
        var path = Path.Combine(folder, name);
        File.WriteAllBytes(path, SimplePdf.Create(pages));
        var info = PdfFile.Open(path, Array.Empty<string>());
        var settings = new PrintSettings { PrinterName = Printer, Dpi = 150 };
        setup(settings);
        return new JobItem { FilePath = path, PageCount = info.PageCount, PageSizes = info.PageSizes, Settings = settings };
    }

    private static void SavePreview(JobItem item, string png)
    {
        var s = item.Settings;
        var sides = SheetLayout.Build(PageRangeParser.SelectPages(s, item.PageCount), s);
        bool landscape = LayoutMath.SheetIsLandscape(s, item.PageSizes[0], new SizeF(850, 1100));
        var sheet = landscape ? new SizeF(1100, 850) : new SizeF(850, 1100);
        var printable = RectangleF.Inflate(new RectangleF(PointF.Empty, sheet), -25, -25);

        using var renderer = new SheetRenderer(item, File.ReadAllBytes(item.FilePath), maxDpi: 100);
        // All sides next to each other in one picture.
        using var bmp = new Bitmap((int)sheet.Width * sides.Count + 10 * (sides.Count - 1), (int)sheet.Height, PixelFormat.Format32bppPArgb);
        using var g = Graphics.FromImage(bmp);
        g.Clear(Color.DimGray);
        for (int i = 0; i < sides.Count; i++)
        {
            var state = g.Save();
            g.TranslateTransform(i * (sheet.Width + 10), 0);
            g.FillRectangle(Brushes.White, 0, 0, sheet.Width, sheet.Height);
            renderer.DrawSide(g, printable, sides[i]);
            g.Restore(state);
        }
        bmp.Save(png, ImageFormat.Png);
    }
}
