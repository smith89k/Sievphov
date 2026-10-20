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
}
