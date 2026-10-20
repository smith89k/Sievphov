namespace Sievphov.Models;

public enum AfterPrintAction { Nothing, MoveTo, CopyTo }

/// <summary>What to do with each PDF once it has printed.</summary>
public sealed class AfterPrintSettings
{
    public AfterPrintAction Action { get; set; } = AfterPrintAction.Nothing;
    public string Folder { get; set; } = "";
}

/// <summary>One line of the finished report.</summary>
public sealed class ReportRow
{
    public string Id { get; set; } = "";
    public string FileName { get; set; } = "";
    public string Folder { get; set; } = "";
    public string Printer { get; set; } = "";
    public string Status { get; set; } = "";
    public string Message { get; set; } = "";
    public int Pages { get; set; }
    public int Sheets { get; set; }
    public int Copies { get; set; }
    /// <summary>How many times the whole list was printed for this file (Repeat).</summary>
    public int Sets { get; set; }
    /// <summary>Where the PDF is now, when it was moved after printing.</summary>
    public string? NewPath { get; set; }
    public DateTime Started { get; set; }
    public DateTime Finished { get; set; }
}
