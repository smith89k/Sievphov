using Sievphov.Models;

namespace Sievphov.Services;

public static class PageRangeParser
{
    /// <summary>
    /// Parses text like "1,3,5", "1-5, 20-25", "last", "12-last", "odd", "even" into 1-based
    /// page numbers, in the order written. Pages past the end of the file are skipped.
    /// An empty text means all pages.
    /// </summary>
    /// <exception cref="FormatException">The text is not a valid range.</exception>
    public static List<int> Parse(string? text, int pageCount)
    {
        var result = new List<int>();
        if (string.IsNullOrWhiteSpace(text))
        {
            result.AddRange(Enumerable.Range(1, pageCount));
            return result;
        }

        foreach (var raw in text.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var token = raw.ToLowerInvariant().Replace(" ", "");
            switch (token)
            {
                case "odd":
                    result.AddRange(Enumerable.Range(1, pageCount).Where(p => p % 2 == 1));
                    continue;
                case "even":
                    result.AddRange(Enumerable.Range(1, pageCount).Where(p => p % 2 == 0));
                    continue;
                case "all":
                    result.AddRange(Enumerable.Range(1, pageCount));
                    continue;
            }

            var dash = token.IndexOf('-', 1);
            if (dash < 0)
            {
                var page = ParseNumber(token, pageCount, raw);
                if (page <= pageCount) result.Add(page);
                continue;
            }

            var from = ParseNumber(token[..dash], pageCount, raw);
            var to = ParseNumber(token[(dash + 1)..], pageCount, raw);
            if (from <= to)
            {
                for (int p = from; p <= Math.Min(to, pageCount); p++) result.Add(p);
            }
            else
            {
                // "10-1" prints backwards.
                for (int p = Math.Min(from, pageCount); p >= to; p--) result.Add(p);
            }
        }
        return result;
    }

    /// <summary>True when <paramref name="text"/> is a valid range (ignores the page count).</summary>
    public static bool IsValid(string? text, out string? error)
    {
        try
        {
            Parse(text, 1000);
            error = null;
            return true;
        }
        catch (FormatException ex)
        {
            error = ex.Message;
            return false;
        }
    }

    /// <summary>The 1-based pages of a file that the settings say to print, in print order.</summary>
    public static List<int> SelectPages(PrintSettings settings, int pageCount)
    {
        List<int> pages = settings.Pages switch
        {
            PageSelection.Odd => Enumerable.Range(1, pageCount).Where(p => p % 2 == 1).ToList(),
            PageSelection.Even => Enumerable.Range(1, pageCount).Where(p => p % 2 == 0).ToList(),
            PageSelection.Range => Parse(settings.PageRange, pageCount),
            _ => Enumerable.Range(1, pageCount).ToList(),
        };
        if (settings.Reverse) pages.Reverse();
        return pages;
    }

    private static int ParseNumber(string s, int pageCount, string token)
    {
        if (s == "last") return pageCount;
        if (int.TryParse(s, out var n) && n >= 1) return n;
        throw new FormatException($"\"{token}\" is not a page or range. Use e.g. 1-5, 8, 12-last.");
    }
}
