using Sievphov.Models;

namespace Sievphov.Services;

public sealed record ItemEstimate(int PagesSelected, int PagesPrinted, int SidesPerCopy, int SheetsPerCopy, int Sheets, string? Error);

public static class Estimator
{
    public static ItemEstimate ForItem(PrintSettings s, int pageCount)
    {
        try
        {
            var pages = PageRangeParser.SelectPages(s, pageCount);
            if (pages.Count == 0) return new ItemEstimate(0, 0, 0, 0, 0, "No pages selected");
            var sides = SheetLayout.Build(pages, s);
            int copies = Math.Max(1, s.Copies);
            int sheets = SheetLayout.SheetsPerCopy(sides, s);
            return new ItemEstimate(pages.Count, pages.Count * copies, sides.Count, sheets, sheets * copies, null);
        }
        catch (FormatException ex)
        {
            return new ItemEstimate(0, 0, 0, 0, 0, ex.Message);
        }
    }
}
