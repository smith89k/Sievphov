using System.Drawing;

namespace Sievphov.Models;

/// <summary>One PDF file to print, with its own settings (sent by the app for each request).</summary>
public sealed class JobItem
{
    /// <summary>The app's id for the row, echoed back in progress messages.</summary>
    public string Id { get; set; } = "";
    public string FilePath { get; set; } = "";
    /// <summary>
    /// Blank paper: a row with no file, put between files as a separator. It prints one empty page with the row's
    /// printer, tray, paper and sides, so Copies is the number of blank sheets.
    /// </summary>
    public bool Blank { get; set; }
    public string FileName => Blank ? "Blank paper" : Path.GetFileName(FilePath);
    public string Folder => Blank ? "" : Path.GetDirectoryName(FilePath) ?? "";

    public int PageCount { get; set; }
    /// <summary>Page sizes in PDF points (1/72 inch).</summary>
    public IReadOnlyList<SizeF> PageSizes { get; set; } = Array.Empty<SizeF>();
    /// <summary>Password that opens the file, if it is locked.</summary>
    public string? Password { get; set; }
    public PrintSettings Settings { get; set; } = new();
}
