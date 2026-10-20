using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Printing;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Sievphov.Models;
using Sievphov.Printing;
using Sievphov.Services;

namespace Sievphov;

/// <summary>
/// The print engine Sievphov (Electron) starts and talks to: one JSON object per line on stdin / stdout.
/// Request <c>{ id, cmd, ... }</c> → reply <c>{ id, ok, result }</c> or <c>{ id, ok: false, error, reason }</c>;
/// while printing it also sends <c>{ event: "progress" | "done", ... }</c>.
/// <c>Sievphov.Engine.exe --selftest &lt;folder&gt;</c> runs the self-test instead.
/// </summary>
public static class Program
{
    /// <summary>Replies and events: camelCase; print settings inside items keep their own names (as in .svpv files).</summary>
    private static readonly JsonSerializerOptions Wire = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter() },
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private static readonly object WriteLock = new();
    private static TextWriter _out = TextWriter.Null;
    private static PrintEngine? _printing;
    private static (string Path, DateTime Stamp, byte[] Bytes)? _cache;

    [STAThread]
    public static int Main(string[] args)
    {
        if (args.Length >= 2 && args[0] == "--selftest") return SelfTest.Run(Path.GetFullPath(args[1]));

        var input = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false));
        _out = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true };
        Send(new { @event = "ready", version = typeof(Program).Assembly.GetName().Version?.ToString(3) });

        while (input.ReadLine() is string line)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            JsonElement id = default;
            try
            {
                using var doc = JsonDocument.Parse(line);
                var req = doc.RootElement;
                id = req.TryGetProperty("id", out var i) ? i.Clone() : default;
                var cmd = req.GetProperty("cmd").GetString();
                if (cmd == "quit") break;
                var result = Handle(cmd, req);
                Send(new { id, ok = true, result });
            }
            catch (Exception ex)
            {
                Send(new { id, ok = false, error = PdfFile.Describe(ex), reason = Reason(ex) });
            }
        }
        _printing?.Stop();
        return 0;
    }

    private static object? Handle(string? cmd, JsonElement req) => cmd switch
    {
        "printers" => Printers(),
        "caps" => PrinterCatalog.For(Str(req, "name")),
        "open" => Open(req),
        "estimate" => Estimate(req),
        "preview" => Preview(req),
        "print" => Print(req),
        "pause" => Do(() => _printing?.Pause()),
        "resume" => Do(() => _printing?.Resume()),
        "stop" => Do(() => _printing?.Stop()),
        _ => throw new InvalidOperationException($"Unknown command \"{cmd}\""),
    };

    private static object? Do(Action a) { a(); return null; }

    private static object Printers()
    {
        var def = PrinterCatalog.DefaultPrinter();
        return PrinterCatalog.Printers().Select(p => new { name = p, isDefault = p == def }).ToList();
    }

    private static object Open(JsonElement req)
    {
        var passwords = req.TryGetProperty("passwords", out var pw) && pw.ValueKind == JsonValueKind.Array
            ? pw.EnumerateArray().Select(p => p.GetString()).ToList()
            : new List<string?>();
        var info = PdfFile.Open(Str(req, "path"), passwords);
        return new { pageCount = info.PageCount, pageSizes = info.PageSizes.Select(s => new[] { s.Width, s.Height }), password = info.Password };
    }

    private static object Estimate(JsonElement req) =>
        req.GetProperty("items").EnumerateArray().Select(e =>
        {
            var est = Estimator.ForItem(Settings(e), e.GetProperty("pageCount").GetInt32());
            return new { pagesSelected = est.PagesSelected, pagesPrinted = est.PagesPrinted, sides = est.SidesPerCopy, sheets = est.Sheets, error = est.Error };
        }).ToList();

    /// <summary>One sheet side as a PNG, drawn by the same code as printing, on the file's printer and paper.</summary>
    private static object Preview(JsonElement req)
    {
        var item = Item(req.GetProperty("item"));
        int maxPx = req.TryGetProperty("maxPx", out var m) ? Math.Clamp(m.GetInt32(), 100, 4000) : 1400;
        var s = item.Settings;
        var pages = PageRangeParser.SelectPages(s, item.PageCount);
        var sides = SheetLayout.Build(pages, s);
        if (sides.Count == 0) throw new InvalidOperationException("No pages selected (check the page range)");
        int index = Math.Clamp(req.TryGetProperty("side", out var sd) ? sd.GetInt32() : 0, 0, sides.Count - 1);
        var side = sides[index];

        var (sheet, printable) = SheetGeometry(item, pages[0]);
        float scale = maxPx / Math.Max(sheet.Width, sheet.Height); // pixels per 1/100 inch
        int w = Math.Max(1, (int)(sheet.Width * scale)), h = Math.Max(1, (int)(sheet.Height * scale));
        int dpi = Math.Clamp((int)(scale * 100), 30, 300);

        using var renderer = new SheetRenderer(item, Bytes(item.FilePath), maxDpi: dpi);
        using var bmp = new Bitmap(w, h, PixelFormat.Format32bppPArgb);
        using (var g = Graphics.FromImage(bmp))
        {
            g.Clear(Color.White);
            g.ScaleTransform(scale, scale);
            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            renderer.DrawSide(g, printable, side);
            using var pen = new Pen(Color.FromArgb(110, 106, 63, 216), 1f / scale) { DashStyle = System.Drawing.Drawing2D.DashStyle.Dash };
            g.DrawRectangle(pen, printable.X, printable.Y, printable.Width, printable.Height);
            if (s.Layout == LayoutMode.Booklet) DrawFold(g, s, sheet, printable, scale);
        }
        using var png = new MemoryStream();
        bmp.Save(png, ImageFormat.Png);
        return new
        {
            png = Convert.ToBase64String(png.ToArray()),
            side = index,
            sides = sides.Count,
            sheet = side.Sheet + 1,
            isBack = side.IsBack,
            twoSided = s.IsTwoSided,
            slots = side.Slots,
            widthIn = sheet.Width / 100f,
            heightIn = sheet.Height / 100f,
        };
    }

    /// <summary>
    /// Preview only (like the dashed printable edge): where a booklet sheet is folded, which is the book's spine,
    /// as a dash-dot line over the whole sheet with a small "Fold · spine" tag at the top edge.
    /// </summary>
    private static void DrawFold(Graphics g, PrintSettings s, SizeF sheet, RectangleF printable, float scale)
    {
        var slots = LayoutMath.Slots(printable, s);
        float x = (slots[0].Right + slots[1].Left) / 2;
        var purple = Color.FromArgb(106, 63, 216);
        using (var fold = new Pen(Color.FromArgb(200, purple), Math.Max(1.5f / scale, sheet.Height / 380f)) { DashStyle = System.Drawing.Drawing2D.DashStyle.DashDot })
            g.DrawLine(fold, x, 0, x, sheet.Height);

        const string tag = "Fold · spine";
        using var font = new Font("Segoe UI", Math.Max(9f / scale, sheet.Height * 0.026f), FontStyle.Bold, GraphicsUnit.World);
        var size = g.MeasureString(tag, font);
        float padX = size.Height * 0.45f, w = size.Width + padX * 2, h = size.Height * 1.15f, top = Math.Max(1f / scale, printable.Top * 0.4f);
        var box = new RectangleF(x - w / 2, top, w, h);
        using (var path = new System.Drawing.Drawing2D.GraphicsPath())
        {
            path.AddArc(box.Left, box.Top, h, h, 90, 180);
            path.AddArc(box.Right - h, box.Top, h, h, 270, 180);
            path.CloseFigure();
            using var fill = new SolidBrush(Color.FromArgb(240, 255, 255, 255));
            using var edge = new Pen(Color.FromArgb(200, purple), 1f / scale);
            g.FillPath(fill, path);
            g.DrawPath(edge, path);
        }
        using var ink = new SolidBrush(purple);
        using var centred = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
        g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
        g.DrawString(tag, font, ink, box, centred);
    }

    private static object Print(JsonElement req)
    {
        if (_printing is not null) throw new InvalidOperationException("Already printing");
        var items = req.GetProperty("items").EnumerateArray().Select(Item).ToList();
        var after = req.TryGetProperty("after", out var a) ? a.Deserialize<AfterPrintSettings>(Wire) ?? new() : new();
        var engine = new PrintEngine();
        engine.Progress += p => Send(new { @event = "progress", progress = p });
        _printing = engine;
        int repeat = req.TryGetProperty("repeat", out var rp) && rp.ValueKind == JsonValueKind.Number ? rp.GetInt32() : 1;
        engine.RunAsync(items, after, repeat).ContinueWith(t =>
        {
            _printing = null;
            if (t.IsFaulted) Send(new { @event = "done", error = PdfFile.Describe(t.Exception!.GetBaseException()), report = Array.Empty<ReportRow>() });
            else Send(new { @event = "done", report = t.Result });
        });
        return new { started = true };
    }

    /// <summary>Paper size and printable area (1/100 inch) for the file's printer, paper and orientation.</summary>
    private static (SizeF Sheet, RectangleF Printable) SheetGeometry(JobItem item, int firstPage)
    {
        var s = item.Settings;
        float paperW = 827, paperH = 1169, marginX = 25, marginY = 25; // A4 if the printer cannot be asked
        try
        {
            var ps = new PrinterSettings();
            if (!string.IsNullOrEmpty(s.PrinterName)) ps.PrinterName = s.PrinterName;
            if (ps.IsValid)
            {
                var page = new PageSettings(ps);
                if (!string.IsNullOrEmpty(s.PaperSize) &&
                    ps.PaperSizes.Cast<PaperSize>().FirstOrDefault(p => p.PaperName == s.PaperSize) is PaperSize size)
                    page.PaperSize = size;
                paperW = Math.Min(page.PaperSize.Width, page.PaperSize.Height);
                paperH = Math.Max(page.PaperSize.Width, page.PaperSize.Height);
                marginX = page.HardMarginX;
                marginY = page.HardMarginY;
            }
        }
        catch
        {
            // keep A4
        }

        var first = item.PageSizes.Count >= firstPage ? item.PageSizes[firstPage - 1] : new SizeF(595, 842);
        bool landscape = LayoutMath.SheetIsLandscape(s, first, new SizeF(paperW, paperH));
        var sheet = landscape ? new SizeF(paperH, paperW) : new SizeF(paperW, paperH);
        if (landscape) (marginX, marginY) = (marginY, marginX);
        var printable = RectangleF.Inflate(new RectangleF(PointF.Empty, sheet), -marginX, -marginY);
        return (sheet, printable);
    }

    /// <summary>The last file read is kept, so flipping through a preview does not read it again.</summary>
    private static byte[] Bytes(string path)
    {
        var stamp = File.GetLastWriteTimeUtc(path);
        if (_cache is { } c && c.Path == path && c.Stamp == stamp) return c.Bytes;
        var bytes = File.ReadAllBytes(path);
        _cache = (path, stamp, bytes);
        return bytes;
    }

    private static JobItem Item(JsonElement e) => new()
    {
        Id = e.TryGetProperty("id", out var id) ? id.ToString() : "",
        FilePath = Str(e, "path"),
        Password = e.TryGetProperty("password", out var pw) && pw.ValueKind == JsonValueKind.String ? pw.GetString() : null,
        PageCount = e.GetProperty("pageCount").GetInt32(),
        PageSizes = e.GetProperty("pageSizes").EnumerateArray()
            .Select(p => new SizeF(p[0].GetSingle(), p[1].GetSingle())).ToList(),
        Settings = Settings(e),
    };

    private static PrintSettings Settings(JsonElement e) =>
        e.TryGetProperty("settings", out var s) ? s.Deserialize<PrintSettings>(Json.Options) ?? new() : new();

    private static string Str(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";

    private static string Reason(Exception ex) => ex switch
    {
        PdfPasswordNeededException => "password",
        PDFtoImage.Exceptions.PdfInvalidFormatException => "damaged",
        FileNotFoundException or DirectoryNotFoundException => "missing",
        _ => "other",
    };

    private static void Send(object message)
    {
        var json = JsonSerializer.Serialize(message, Wire);
        lock (WriteLock) _out.WriteLine(json);
    }
}
