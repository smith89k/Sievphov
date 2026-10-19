using System.Windows;
using System.Windows.Controls;
using Sievphov.Models;
using Sievphov.Services;

namespace Sievphov.Views;

/// <summary>
/// Settings for one file or several selected files. Back / Next move between them;
/// "Apply to all selected" gives every selected file the settings shown.
/// </summary>
public sealed class FileSettingsWindow : Window
{
    private readonly IReadOnlyList<JobItem> _items;
    private readonly PresetLibrary _library;
    private readonly Dictionary<JobItem, PrintSettings> _pending = new();
    private readonly SettingsEditor _editor = new();
    private readonly TextBlock _header = new() { FontSize = 14, FontWeight = FontWeights.SemiBold, TextTrimming = TextTrimming.CharacterEllipsis };
    private readonly TextBlock _sub = new() { Foreground = System.Windows.Media.Brushes.Gray };
    private readonly Button _back = Btn("◀ Back"), _next = Btn("Next ▶"), _reset = Btn("Reset to preset"), _all, _ok = Btn("OK"), _cancel = Btn("Cancel");
    private int _index;

    public FileSettingsWindow(IReadOnlyList<JobItem> items, int startIndex, PresetLibrary library)
    {
        _items = items;
        _library = library;
        _index = Math.Clamp(startIndex, 0, items.Count - 1);
        _all = Btn($"Apply to all {items.Count} selected");

        Title = "File settings";
        Width = 640;
        Height = 620;
        MinWidth = 520;
        MinHeight = 450;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;

        var top = new StackPanel { Margin = new Thickness(10, 10, 10, 4) };
        top.Children.Add(_header);
        top.Children.Add(_sub);

        var left = new StackPanel { Orientation = Orientation.Horizontal };
        left.Children.Add(_back);
        left.Children.Add(_next);
        left.Children.Add(_reset);
        if (items.Count > 1) left.Children.Add(_all);
        var right = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
        right.Children.Add(_ok);
        right.Children.Add(_cancel);
        var bottom = new DockPanel { Margin = new Thickness(10) };
        DockPanel.SetDock(right, Dock.Right);
        bottom.Children.Add(right);
        bottom.Children.Add(left);

        var root = new DockPanel();
        DockPanel.SetDock(top, Dock.Top);
        DockPanel.SetDock(bottom, Dock.Bottom);
        root.Children.Add(top);
        root.Children.Add(bottom);
        root.Children.Add(_editor);
        Content = root;

        _back.Visibility = _next.Visibility = items.Count > 1 ? Visibility.Visible : Visibility.Collapsed;
        _back.Click += (_, _) => Move(-1);
        _next.Click += (_, _) => Move(+1);
        _reset.Click += (_, _) => Reset();
        _all.Click += (_, _) => ApplyToAll();
        _ok.IsDefault = true;
        _ok.Click += (_, _) => Finish();
        _cancel.IsCancel = true;
        _editor.Changed += (_, _) => _ok.IsEnabled = !_editor.HasErrors;

        Show(_index);
    }

    private static Button Btn(string text) => new() { Content = text, Padding = new Thickness(10, 3, 10, 3), Margin = new Thickness(0, 0, 6, 0), MinWidth = 70 };

    private void Show(int index)
    {
        _index = index;
        var item = _items[index];
        var preset = _library.Find(item.PresetId);
        _header.Text = _items.Count > 1 ? $"File {index + 1} of {_items.Count}: {item.FileName}" : item.FileName;
        _sub.Text = (preset is null ? "No preset" : $"Preset: {preset.Name}") + $" · {item.PageCount} pages" +
                    (preset is null ? "" : " · values in bold differ from the preset");
        _editor.Load(_pending.TryGetValue(item, out var p) ? p : item.Settings, preset?.Settings);
        _back.IsEnabled = index > 0;
        _next.IsEnabled = index < _items.Count - 1;
        _reset.IsEnabled = preset is not null;
    }

    private bool Keep()
    {
        if (_editor.HasErrors)
        {
            MessageBox.Show(this, "Some values are not valid (red box). Please fix them first.", Title, MessageBoxButton.OK, MessageBoxImage.Warning);
            return false;
        }
        _pending[_items[_index]] = _editor.Read();
        return true;
    }

    private void Move(int delta)
    {
        if (Keep()) Show(Math.Clamp(_index + delta, 0, _items.Count - 1));
    }

    private void Reset()
    {
        var preset = _library.Find(_items[_index].PresetId);
        if (preset is not null) _editor.Load(preset.Settings, preset.Settings);
    }

    private void ApplyToAll()
    {
        if (!Keep()) return;
        var settings = _pending[_items[_index]];
        foreach (var item in _items) _pending[item] = settings.Clone();
        MessageBox.Show(this, $"These settings will be used for all {_items.Count} selected files when you click OK.", Title);
    }

    private void Finish()
    {
        if (!Keep()) return;
        foreach (var (item, settings) in _pending)
        {
            if (settings.ContentEquals(item.Settings)) continue;
            var preset = _library.Find(item.PresetId);
            if (preset is not null && settings.ContentEquals(preset.Settings))
                PresetSync.Apply(new[] { item }, preset); // back to exactly the preset: no *
            else
                PresetSync.SetByHand(item, settings, _library);
        }
        DialogResult = true;
    }
}
