using System.Drawing;
using System.Drawing.Imaging;
using SkiaSharp;

namespace Sievphov.Printing;

public static class BitmapConvert
{
    /// <summary>Copies a Skia bitmap (what PDFium renders) into a GDI+ bitmap the printer can draw.</summary>
    public static unsafe Bitmap ToGdi(SKBitmap source, int dpi)
    {
        SKBitmap? converted = null;
        var src = source;
        if (source.ColorType != SKColorType.Bgra8888)
        {
            converted = source.Copy(SKColorType.Bgra8888) ?? throw new InvalidOperationException("Cannot convert page image.");
            src = converted;
        }
        try
        {
            var bmp = new Bitmap(src.Width, src.Height, PixelFormat.Format32bppPArgb);
            var data = bmp.LockBits(new Rectangle(0, 0, src.Width, src.Height), ImageLockMode.WriteOnly, PixelFormat.Format32bppPArgb);
            try
            {
                byte* from = (byte*)src.GetPixels();
                byte* to = (byte*)data.Scan0;
                long rowBytes = src.Width * 4L;
                for (int y = 0; y < src.Height; y++)
                    Buffer.MemoryCopy(from + y * (long)src.RowBytes, to + y * (long)data.Stride, data.Stride, rowBytes);
            }
            finally
            {
                bmp.UnlockBits(data);
            }
            bmp.SetResolution(dpi, dpi);
            return bmp;
        }
        finally
        {
            converted?.Dispose();
        }
    }

    /// <summary>A GDI+ bitmap as a WPF image (for the preview window).</summary>
    public static System.Windows.Media.Imaging.BitmapSource ToWpf(Bitmap bmp)
    {
        var data = bmp.LockBits(new Rectangle(0, 0, bmp.Width, bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppPArgb);
        try
        {
            var source = System.Windows.Media.Imaging.BitmapSource.Create(
                bmp.Width, bmp.Height, 96, 96, System.Windows.Media.PixelFormats.Pbgra32, null,
                data.Scan0, data.Stride * bmp.Height, data.Stride);
            source.Freeze();
            return source;
        }
        finally
        {
            bmp.UnlockBits(data);
        }
    }
}
