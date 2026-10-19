using System.ComponentModel;
using System.Drawing;
using System.Runtime.CompilerServices;

namespace Sievphov.Models;

public enum ItemStatus { Waiting, Printing, Printed, Error, Stopped, Locked }

/// <summary>One PDF file in the list, with its own settings.</summary>
public sealed class JobItem : INotifyPropertyChanged
{
    private bool _isChecked = true;
    private string _filePath = "";
    private ItemStatus _status = ItemStatus.Waiting;
    private string _message = "";
    private PrintSettings _settings = new();
    private string? _presetId;
    private string? _presetName;
    private bool _isModified;

    public event PropertyChangedEventHandler? PropertyChanged;

    public bool IsChecked { get => _isChecked; set => Set(ref _isChecked, value); }

    public string FilePath
    {
        get => _filePath;
        set { if (Set(ref _filePath, value)) { OnChanged(nameof(FileName)); OnChanged(nameof(Folder)); } }
    }

    public string FileName => Path.GetFileName(FilePath);
    public string Folder => Path.GetDirectoryName(FilePath) ?? "";

    public int PageCount { get; set; }
    /// <summary>Page sizes in PDF points (1/72 inch).</summary>
    public IReadOnlyList<SizeF> PageSizes { get; set; } = Array.Empty<SizeF>();
    /// <summary>Password that opened the file (not saved in job files).</summary>
    public string? Password { get; set; }

    public ItemStatus Status { get => _status; set { if (Set(ref _status, value)) OnChanged(nameof(StatusText)); } }
    public string Message { get => _message; set { if (Set(ref _message, value)) OnChanged(nameof(StatusText)); } }

    public string StatusText => Status switch
    {
        ItemStatus.Waiting => "Wait",
        ItemStatus.Printing => string.IsNullOrEmpty(Message) ? "Printing" : Message,
        ItemStatus.Printed => "Printed",
        ItemStatus.Stopped => "Stopped",
        ItemStatus.Locked => "Locked",
        _ => string.IsNullOrEmpty(Message) ? "Error" : "Error: " + Message,
    };

    public PrintSettings Settings
    {
        get => _settings;
        set { _settings = value; OnSettingsChanged(); }
    }

    public string? PresetId { get => _presetId; set { _presetId = value; OnChanged(nameof(PresetDisplay)); } }
    public string? PresetName { get => _presetName; set { _presetName = value; OnChanged(nameof(PresetDisplay)); } }

    /// <summary>True when the settings were changed by hand after the preset was applied.</summary>
    public bool IsModified { get => _isModified; set { _isModified = value; OnChanged(nameof(PresetDisplay)); } }

    public string PresetDisplay => PresetName is null ? (IsModified ? "(own settings)" : "—") : PresetName + (IsModified ? " *" : "");

    public string PrinterDisplay => string.IsNullOrEmpty(Settings.PrinterName) ? "(Default printer)" : Settings.PrinterName;
    public string TrayDisplay => string.IsNullOrEmpty(Settings.Tray) ? "As in printer" : Settings.Tray;
    public string PaperDisplay => string.IsNullOrEmpty(Settings.PaperSize) ? "Printer default" : Settings.PaperSize;

    public string SidesDisplay => Settings.Layout == LayoutMode.Booklet
        ? "Booklet"
        : Settings.Sides switch
        {
            SidesMode.LongEdge => "2-sided (long)",
            SidesMode.ShortEdge => "2-sided (short)",
            _ => "1-sided",
        };

    public int Copies => Settings.Copies;

    public void OnSettingsChanged()
    {
        foreach (var name in new[] { nameof(Settings), nameof(PrinterDisplay), nameof(TrayDisplay), nameof(PaperDisplay), nameof(SidesDisplay), nameof(Copies), nameof(PresetDisplay) })
            OnChanged(name);
    }

    private bool Set<T>(ref T field, T value, [CallerMemberName] string? name = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value)) return false;
        field = value;
        OnChanged(name);
        return true;
    }

    private void OnChanged(string? name) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
