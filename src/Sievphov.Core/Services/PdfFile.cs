using System.Drawing;
using PDFtoImage;
using PDFtoImage.Exceptions;
using SkiaSharp;

namespace Sievphov.Services;

public sealed class PdfPasswordNeededException : Exception
{
    public PdfPasswordNeededException(string path) : base("This PDF is locked with a password.") { Path = path; }
    public string Path { get; }
}

/// <summary>Reads PDF files with PDFium (through PDFtoImage).</summary>
public static class PdfFile
{
    public sealed record Info(int PageCount, IReadOnlyList<SizeF> PageSizes, string? Password);

    /// <summary>
    /// Opens the file and reads its page sizes, trying no password first, then <paramref name="passwords"/>.
    /// </summary>
    /// <exception cref="PdfPasswordNeededException">None of the passwords work.</exception>
    public static Info Open(string path, IEnumerable<string?> passwords)
    {
        var bytes = File.ReadAllBytes(path);
        foreach (var pw in new string?[] { null }.Concat(passwords.Where(p => !string.IsNullOrEmpty(p))))
        {
            try
            {
                var sizes = Conversion.GetPageSizes(bytes, pw).ToList();
                return new Info(sizes.Count, sizes, pw);
            }
            catch (PdfPasswordProtectedException)
            {
            }
        }
        throw new PdfPasswordNeededException(path);
    }

    /// <summary>Renders one page (1-based) to a bitmap. The caller disposes it.</summary>
    public static SKBitmap Render(byte[] pdf, int page, string? password, int dpi, bool grayscale, bool rotate90)
    {
        var options = new RenderOptions
        {
            Dpi = dpi,
            WithAnnotations = true,
            WithFormFill = true,
            Grayscale = grayscale,
            Rotation = rotate90 ? PdfRotation.Rotate90 : PdfRotation.Rotate0,
            BackgroundColor = SKColors.White,
        };
        return Conversion.ToImage(pdf, page - 1, password, options);
    }

    /// <summary>A short, readable reason for a PDF that cannot be read.</summary>
    public static string Describe(Exception ex) => ex switch
    {
        PdfPasswordNeededException => "Locked with a password",
        PdfInvalidFormatException => "Not a valid PDF (file is broken)",
        PdfCannotOpenFileException => "Cannot open the file",
        PdfUnsupportedSecuritySchemeException => "Uses an unsupported kind of protection",
        FileNotFoundException => "File not found",
        DirectoryNotFoundException => "Folder not found",
        UnauthorizedAccessException => "No permission to read the file",
        IOException io => io.Message,
        _ => ex.Message,
    };
}
