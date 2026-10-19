using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using Sievphov.Models;
using Sievphov.Services;

namespace Sievphov.Printing;

/// <summary>
/// Draws one sheet side: PDF pages (normal, N-up or booklet), page numbers, text watermark and logo.
/// The same code draws to the printer and to the preview. Units are 1/100 inch.
/// Runs on an STA thread (text is drawn with WPF).
/// </summary>
public sealed class SheetRenderer : IDisposable
{
    private readonly JobItem _item;
    private readonly PrintSettings _s;
    private readonly byte[] _pdf;
    private readonly int _stampDpi;
    private readonly Dictionary<string, Bitmap?> _textCache = new();
    private Image? _logo;
    private bool _logoLoaded;

    /// <param name="maxDpi">Upper limit for page images (lower for the preview).</param>
    public SheetRenderer(JobItem item, byte[] pdf, int? maxDpi = null)
    {
        _item = item;
        _s = item.Settings;
        _pdf = pdf;
        MaxDpi = maxDpi ?? _s.Dpi;
        _stampDpi = Math.Clamp(MaxDpi, 72, 600);
    }

    public int MaxDpi { get; }

    public void DrawSide(Graphics g, RectangleF printable, SheetSide side)
    {
        var slots = LayoutMath.Slots(printable, _s);
        for (int i = 0; i < slots.Length && i < side.Slots.Length; i++)
        {
            var slot = slots[i];
            if (_s.Layout == LayoutMode.PagesPerSheet && _s.Borders)
                using (var pen = new Pen(Color.Black, 1f))
                    g.DrawRectangle(pen, slot.X, slot.Y, slot.Width, slot.Height);

            if (side.Slots[i] is not int page || page < 1 || page > _item.PageSizes.Count) continue;
            DrawPage(g, slot, page, LayoutMath.SlotAlignment(_s, i));
        }
    }

    private void DrawPage(Graphics g, RectangleF slot, int page, Align9 align)
    {
        var sizePt = _item.PageSizes[page - 1];
        var size = LayoutMath.PointsToUnits(sizePt);
        bool rotate = LayoutMath.ShouldRotate(size, slot, _s);
        var shown = rotate ? new SizeF(size.Height, size.Width) : size;
        var rect = LayoutMath.FitPage(shown, slot, _s.Fit, _s.ZoomPercent, align);

        // The page's own width ends up as the drawn height when it is turned.
        int dpi = Math.Min(MaxDpi, LayoutMath.RenderDpi(_s.Dpi, rotate ? rect.Height : rect.Width, sizePt));
        using (var sk = PdfFile.Render(_pdf, page, _item.Password, dpi, _s.Grayscale, rotate))
        using (var bmp = BitmapConvert.ToGdi(sk, dpi))
        {
            var state = g.Save();
            g.SetClip(slot);
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.DrawImage(bmp, rect);
            g.Restore(state);
        }

        var visible = RectangleF.Intersect(rect, slot);
        DrawStamps(g, visible, page);
    }

    private void DrawStamps(Graphics g, RectangleF page, int pdfPage)
    {
        var pn = _s.PageNumbers;
        if (pn.Enabled && Macros.PageNumberText(pn, _item.FilePath, pdfPage, _item.PageCount) is string number)
        {
            var bmp = Text(number, pn.Font, pn.SizePt, pn.Color);
            if (bmp is not null)
            {
                var size = UnitsOf(bmp);
                var at = LayoutMath.PlaceStamp(size, page, pn.Position, LayoutMath.MmToUnits(pn.MarginMm), pdfPage);
                g.DrawImage(bmp, at);
            }
        }

        var wm = _s.Watermark;
        if (wm.Enabled)
        {
            var text = Macros.Expand(wm.Text, _item.FilePath, pdfPage, _item.PageCount);
            var bmp = Text(text, wm.Font, wm.SizePt, wm.Color);
            if (bmp is not null)
                DrawTurned(g, bmp, UnitsOf(bmp), page, wm.Position, wm.MarginMm, wm.Angle, wm.SeeThroughPercent, pdfPage);
        }

        var logo = _s.Logo;
        if (logo.Enabled && Logo() is Image img && img.Width > 0)
        {
            float w = page.Width * Math.Clamp(logo.WidthPercent, 1, 100) / 100f;
            var size = new SizeF(w, w * img.Height / img.Width);
            DrawTurned(g, img, size, page, logo.Position, logo.MarginMm, 0, logo.SeeThroughPercent, pdfPage);
        }
    }

    private static void DrawTurned(Graphics g, Image img, SizeF size, RectangleF page, StampPosition pos, double marginMm, double angle, int seeThrough, int pdfPage)
    {
        // Place by the turned outline so a turned watermark still stays inside the margins.
        double rad = angle * Math.PI / 180;
        float bw = (float)(Math.Abs(size.Width * Math.Cos(rad)) + Math.Abs(size.Height * Math.Sin(rad)));
        float bh = (float)(Math.Abs(size.Width * Math.Sin(rad)) + Math.Abs(size.Height * Math.Cos(rad)));
        var box = LayoutMath.PlaceStamp(new SizeF(bw, bh), page, pos, LayoutMath.MmToUnits(marginMm), pdfPage);

        using var attrs = new ImageAttributes();
        var matrix = new ColorMatrix { Matrix33 = 1f - Math.Clamp(seeThrough, 0, 100) / 100f };
        attrs.SetColorMatrix(matrix);

        var state = g.Save();
        g.SetClip(page);
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.TranslateTransform(box.X + bw / 2, box.Y + bh / 2);
        g.RotateTransform((float)-angle); // positive angle = counter-clockwise, like most programs
        var dest = new[]
        {
            new PointF(-size.Width / 2, -size.Height / 2),
            new PointF(size.Width / 2, -size.Height / 2),
            new PointF(-size.Width / 2, size.Height / 2),
        };
        g.DrawImage(img, dest, new RectangleF(0, 0, img.Width, img.Height), GraphicsUnit.Pixel, attrs);
        g.Restore(state);
    }

    private SizeF UnitsOf(Bitmap bmp) => new(bmp.Width * 100f / _stampDpi, bmp.Height * 100f / _stampDpi);

    private Bitmap? Text(string text, string font, double sizePt, string color)
    {
        var key = string.Join("\u0001", text, font, sizePt, color);
        if (_textCache.TryGetValue(key, out var cached)) return cached;
        if (_textCache.Count > 200)
        {
            foreach (var b in _textCache.Values) b?.Dispose();
            _textCache.Clear();
        }
        var bmp = TextStamp.Render(text, font, sizePt, color, _stampDpi);
        _textCache[key] = bmp;
        return bmp;
    }

    private Image? Logo()
    {
        if (_logoLoaded) return _logo;
        _logoLoaded = true;
        var path = _s.Logo.Path;
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) return null;
        // Load from memory so the picture file is not locked while printing.
        using var stream = new MemoryStream(File.ReadAllBytes(path));
        using var fromFile = Image.FromStream(stream);
        _logo = new Bitmap(fromFile);
        return _logo;
    }

    public void Dispose()
    {
        foreach (var b in _textCache.Values) b?.Dispose();
        _textCache.Clear();
        _logo?.Dispose();
    }
}
