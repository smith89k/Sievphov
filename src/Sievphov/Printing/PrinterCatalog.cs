using System.Collections.Concurrent;
using System.Drawing.Printing;

namespace Sievphov.Printing;

/// <summary>Installed printers and what each one offers (paper sizes, trays, two-sided).</summary>
public static class PrinterCatalog
{
    public sealed record Capabilities(IReadOnlyList<string> PaperSizes, IReadOnlyList<string> Trays, bool CanDuplex, bool SupportsColor, bool Exists);

    private static readonly ConcurrentDictionary<string, Capabilities> Cache = new(StringComparer.OrdinalIgnoreCase);

    public static IReadOnlyList<string> Printers()
    {
        try
        {
            return PrinterSettings.InstalledPrinters.Cast<string>().OrderBy(p => p).ToList();
        }
        catch
        {
            return Array.Empty<string>();
        }
    }

    public static string DefaultPrinter()
    {
        try
        {
            return new PrinterSettings().PrinterName;
        }
        catch
        {
            return "";
        }
    }

    /// <summary>Asks the printer driver (can be slow for network printers, so results are kept).</summary>
    public static Capabilities For(string printerName)
    {
        var key = string.IsNullOrEmpty(printerName) ? DefaultPrinter() : printerName;
        return Cache.GetOrAdd(key, name =>
        {
            try
            {
                var ps = new PrinterSettings { PrinterName = name };
                if (!ps.IsValid) return new Capabilities(Array.Empty<string>(), Array.Empty<string>(), false, false, false);
                var papers = ps.PaperSizes.Cast<PaperSize>().Select(p => p.PaperName).Where(n => !string.IsNullOrWhiteSpace(n)).Distinct().ToList();
                var trays = ps.PaperSources.Cast<PaperSource>().Select(p => p.SourceName).Where(n => !string.IsNullOrWhiteSpace(n)).Distinct().ToList();
                return new Capabilities(papers, trays, ps.CanDuplex, ps.SupportsColor, true);
            }
            catch
            {
                return new Capabilities(Array.Empty<string>(), Array.Empty<string>(), false, false, false);
            }
        });
    }

    public static void Refresh() => Cache.Clear();
}
