using System.Drawing.Imaging;
using System.Globalization;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace Sievphov.Printing;

/// <summary>
/// Draws text (page numbers, watermarks) to a bitmap with WPF's text engine, which shapes
/// Khmer correctly (coeng subscripts, vowel signs). Must run on an STA thread.
/// </summary>
public static class TextStamp
{
    private const string Fallback = "Khmer UI, Khmer OS, Leelawadee UI, DaunPenh, Segoe UI";

    public static System.Drawing.Bitmap? Render(string text, string font, double sizePt, string color, int dpi)
    {
        if (string.IsNullOrWhiteSpace(text) || sizePt <= 0) return null;

        var brush = new SolidColorBrush(ParseColor(color));
        brush.Freeze();
        var family = new FontFamily(string.IsNullOrWhiteSpace(font) ? Fallback : font + ", " + Fallback);
        var typeface = new Typeface(family, FontStyles.Normal, FontWeights.Normal, FontStretches.Normal);
        var formatted = new FormattedText(text, CultureInfo.CurrentUICulture, FlowDirection.LeftToRight,
            typeface, sizePt * 96.0 / 72.0, brush, dpi / 96.0);

        double scale = dpi / 96.0;
        int w = (int)Math.Ceiling(Math.Max(1, formatted.WidthIncludingTrailingWhitespace) * scale) + 2;
        int h = (int)Math.Ceiling(Math.Max(1, formatted.Height) * scale) + 2;
        if ((long)w * h > 40_000_000) return null; // absurd size: skip rather than run out of memory

        var visual = new DrawingVisual();
        using (var dc = visual.RenderOpen())
            dc.DrawText(formatted, new Point(1 / scale, 1 / scale));

        var target = new RenderTargetBitmap(w, h, dpi, dpi, PixelFormats.Pbgra32);
        target.Render(visual);

        var bmp = new System.Drawing.Bitmap(w, h, System.Drawing.Imaging.PixelFormat.Format32bppPArgb);
        var data = bmp.LockBits(new System.Drawing.Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, System.Drawing.Imaging.PixelFormat.Format32bppPArgb);
        try
        {
            target.CopyPixels(Int32Rect.Empty, data.Scan0, data.Stride * h, data.Stride);
        }
        finally
        {
            bmp.UnlockBits(data);
        }
        bmp.SetResolution(dpi, dpi);
        return bmp;
    }

    public static Color ParseColor(string? value)
    {
        try
        {
            if (!string.IsNullOrWhiteSpace(value) && ColorConverter.ConvertFromString(value.Trim()) is Color c) return c;
        }
        catch (FormatException)
        {
        }
        return Colors.Black;
    }
}
