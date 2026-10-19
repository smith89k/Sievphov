namespace Sievphov.Models;

/// <summary>Contents of a saved job (.svpv): the file list plus every file's own settings.</summary>
public sealed class JobFile
{
    public const string Extension = ".svpv";

    public int Version { get; set; } = 1;
    public List<JobEntry> Items { get; set; } = new();
}

public sealed class JobEntry
{
    public string FilePath { get; set; } = "";
    /// <summary>Path relative to the job file, used when the absolute path no longer exists.</summary>
    public string? RelativePath { get; set; }
    public bool Checked { get; set; } = true;
    public string? PresetId { get; set; }
    public string? PresetName { get; set; }
    public bool Modified { get; set; }
    public PrintSettings Settings { get; set; } = new();
}

public enum AfterPrintAction { Nothing, MoveTo, CopyTo }

/// <summary>App options remembered between runs.</summary>
public sealed class AppSettings
{
    public string? LastFolder { get; set; }
    public bool IncludeSubfolders { get; set; } = true;
    public AfterPrintAction AfterPrint { get; set; } = AfterPrintAction.Nothing;
    public string AfterPrintFolder { get; set; } = "";
    /// <summary>Passwords tried automatically on locked PDFs.</summary>
    public List<string> Passwords { get; set; } = new();
}

public sealed class ReportRow
{
    public string FileName { get; set; } = "";
    public string Folder { get; set; } = "";
    public string Printer { get; set; } = "";
    public string Preset { get; set; } = "";
    public string Status { get; set; } = "";
    public string Message { get; set; } = "";
    public int Pages { get; set; }
    public int Sheets { get; set; }
    public int Copies { get; set; }
    public DateTime Started { get; set; }
    public DateTime Finished { get; set; }
}
