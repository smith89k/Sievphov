using Sievphov.Services;

namespace Sievphov.Tests;

/// <summary>Uses the real PDFium engine on small generated PDFs.</summary>
public class PdfFileTests
{
    [Fact]
    public void ReadsPageCountAndSizes()
    {
        var path = TestPdf.WriteTemp(TestPdf.Create((595, 842), (842, 595), (300, 400)));
        var info = PdfFile.Open(path, Array.Empty<string>());
        Assert.Equal(3, info.PageCount);
        Assert.Equal(842, info.PageSizes[1].Width, 1);
        Assert.Equal(595, info.PageSizes[1].Height, 1);
        Assert.Null(info.Password);
    }

    [Fact]
    public void RendersAtRequestedDpiAndRotates()
    {
        var pdf = TestPdf.Create((144, 288)); // 2 x 4 inches
        using var bmp = PdfFile.Render(pdf, 1, null, 100, grayscale: false, rotate90: false);
        Assert.Equal(200, bmp.Width);
        Assert.Equal(400, bmp.Height);
        // The black box is in the top-left corner, the rest is white.
        Assert.Equal(SkiaSharp.SKColors.Black, bmp.GetPixel(10, 10));
        Assert.Equal(SkiaSharp.SKColors.White, bmp.GetPixel(190, 390));

        using var rotated = PdfFile.Render(pdf, 1, null, 100, grayscale: true, rotate90: true);
        Assert.Equal(400, rotated.Width);
        Assert.Equal(200, rotated.Height);
    }

    [Fact]
    public void BrokenFileGivesClearReason()
    {
        var path = TestPdf.WriteTemp(System.Text.Encoding.ASCII.GetBytes("this is not a pdf"));
        var ex = Assert.ThrowsAny<Exception>(() => PdfFile.Open(path, Array.Empty<string>()));
        Assert.Equal("Not a valid PDF (file is broken)", PdfFile.Describe(ex));
    }
}
