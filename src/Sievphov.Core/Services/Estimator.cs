using Sievphov.Models;

namespace Sievphov.Services;

public sealed record ItemEstimate(int PagesSelected, int PagesPrinted, int SidesPerCopy, int SheetsPerCopy, int Sheets, string? Error);

public sealed record PrinterEstimate(string Printer, int Files, int Pages, int Sheets);

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

    public static List<PrinterEstimate> ByPrinter(IEnumerable<JobItem> items, string defaultPrinterName)
    {
        return items
            .Select(i => (Printer: string.IsNullOrEmpty(i.Settings.PrinterName) ? defaultPrinterName : i.Settings.PrinterName,
                          Est: ForItem(i.Settings, i.PageCount)))
            .GroupBy(x => x.Printer, StringComparer.OrdinalIgnoreCase)
            .Select(g => new PrinterEstimate(g.Key, g.Count(), g.Sum(x => x.Est.PagesPrinted), g.Sum(x => x.Est.Sheets)))
            .OrderBy(e => e.Printer)
            .ToList();
    }
}
