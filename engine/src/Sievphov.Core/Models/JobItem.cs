using System.Drawing;

namespace Sievphov.Models;

/// <summary>One PDF file to print, with its own settings (sent by the app for each request).</summary>
public sealed class JobItem
{
    /// <summary>The app's id for the row, echoed back in progress messages.</summary>
    public string Id { get; set; } = "";
    public string FilePath { get; set; } = "";
    public string FileName => Path.GetFileName(FilePath);
    public string Folder => Path.GetDirectoryName(FilePath) ?? "";

    public int PageCount { get; set; }
    /// <summary>Page sizes in PDF points (1/72 inch).</summary>
    public IReadOnlyList<SizeF> PageSizes { get; set; } = Array.Empty<SizeF>();
    /// <summary>Password that opens the file, if it is locked.</summary>
    public string? Password { get; set; }
    public PrintSettings Settings { get; set; } = new();
}
