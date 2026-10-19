using System.Globalization;
using Sievphov.Models;

namespace Sievphov.Services;

public static class Macros
{
    /// <summary>Replaces {filename}, {name}, {date}, {time}, {page}, {pages} in <paramref name="text"/>.</summary>
    public static string Expand(string text, string filePath, int page, int pages, DigitStyle digits = DigitStyle.Western, DateTime? now = null)
    {
        var t = now ?? DateTime.Now;
        return text
            .Replace("{filename}", Path.GetFileName(filePath), StringComparison.OrdinalIgnoreCase)
            .Replace("{name}", Path.GetFileNameWithoutExtension(filePath), StringComparison.OrdinalIgnoreCase)
            .Replace("{date}", Digits(t.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture), digits), StringComparison.OrdinalIgnoreCase)
            .Replace("{time}", Digits(t.ToString("HH:mm", CultureInfo.InvariantCulture), digits), StringComparison.OrdinalIgnoreCase)
            .Replace("{pages}", Digits(pages.ToString(CultureInfo.InvariantCulture), digits), StringComparison.OrdinalIgnoreCase)
            .Replace("{page}", Digits(page.ToString(CultureInfo.InvariantCulture), digits), StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Western digits 0-9 to Khmer digits ០-៩ when asked.</summary>
    public static string Digits(string s, DigitStyle style)
    {
        if (style != DigitStyle.Khmer) return s;
        return string.Create(s.Length, s, (span, src) =>
        {
            for (int i = 0; i < src.Length; i++)
                span[i] = src[i] is >= '0' and <= '9' ? (char)('០' + (src[i] - '0')) : src[i];
        });
    }

    /// <summary>
    /// The page number text for 1-based PDF page <paramref name="pdfPage"/>, or null when the page
    /// gets no number (its number would be below 1).
    /// </summary>
    public static string? PageNumberText(PageNumberSettings p, string filePath, int pdfPage, int pageCount)
    {
        int shown = pdfPage + p.StartAt - 1;
        if (shown < 1) return null;
        int total = pageCount + p.StartAt - 1;
        return Expand(p.Format, filePath, shown, total, p.Digits);
    }
}
