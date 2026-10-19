using System.Windows;
using System.Windows.Controls;
using Microsoft.Win32;
using Sievphov.Models;
using Sievphov.Services;

namespace Sievphov.Views;

/// <summary>New, edit, duplicate, rename, delete, reorder, set default, import and export presets.</summary>
public sealed class PresetManagerWindow : Window
{
    private readonly PresetLibrary _lib;
    private readonly ListBox _list = new() { Margin = new Thickness(0, 0, 0, 6) };
    private readonly SettingsEditor _editor = new();
    private readonly TextBlock _title = new() { FontSize = 14, FontWeight = FontWeights.SemiBold, Margin = new Thickness(0, 0, 0, 6) };
    private Preset? _shown;

    /// <param name="library">A copy; read <see cref="Result"/> after OK.</param>
    public PresetManagerWindow(PresetLibrary library, string? selectId = null)
    {
        _lib = library.Clone();
        Title = "Manage presets";
        Width = 900;
        Height = 640;
        MinWidth = 760;
        MinHeight = 480;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;

        var buttons = new WrapPanel();
        foreach (var (text, action) in new (string, Action)[]
        {
            ("New", New), ("Duplicate", Duplicate), ("Rename", Rename), ("Delete", Delete),
            ("▲", () => MoveBy(-1)), ("▼", () => MoveBy(1)), ("Set as default", SetDefault),
            ("Import…", Import), ("Export…", Export),
        })
        {
            var b = new Button { Content = text, Padding = new Thickness(8, 2, 8, 2), Margin = new Thickness(0, 0, 4, 4) };
            b.Click += (_, _) => action();
            buttons.Children.Add(b);
        }

        var left = new DockPanel { Width = 280, Margin = new Thickness(10, 10, 6, 10) };
        var hint = new TextBlock
        {
            Text = "Ctrl+1 … Ctrl+9 in the main window apply the first 9 presets. The default preset is given to new files.",
            TextWrapping = TextWrapping.Wrap,
            Foreground = System.Windows.Media.Brushes.Gray,
            Margin = new Thickness(0, 4, 0, 0),
        };
        DockPanel.SetDock(buttons, Dock.Bottom);
        DockPanel.SetDock(hint, Dock.Bottom);
        left.Children.Add(hint);
        left.Children.Add(buttons);
        left.Children.Add(_list);

        var ok = new Button { Content = "Save", IsDefault = true, Padding = new Thickness(14, 3, 14, 3), Margin = new Thickness(0, 0, 6, 0) };
        var cancel = new Button { Content = "Cancel", IsCancel = true, Padding = new Thickness(14, 3, 14, 3) };
        ok.Click += (_, _) => Save();
        var bottom = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 8, 0, 0) };
        bottom.Children.Add(ok);
        bottom.Children.Add(cancel);

        var right = new DockPanel { Margin = new Thickness(6, 10, 10, 10) };
        DockPanel.SetDock(_title, Dock.Top);
        DockPanel.SetDock(bottom, Dock.Bottom);
        right.Children.Add(_title);
        right.Children.Add(bottom);
        right.Children.Add(_editor);

        var root = new DockPanel();
        DockPanel.SetDock(left, Dock.Left);
        root.Children.Add(left);
        root.Children.Add(right);
        Content = root;

        _list.SelectionChanged += (_, _) => ShowSelected();
        _list.MouseDoubleClick += (_, _) => Rename();
        Refresh(_lib.Find(selectId) ?? _lib.Presets.FirstOrDefault());
    }

    public PresetLibrary? Result { get; private set; }

    private void Refresh(Preset? select)
    {
        _list.ItemsSource = null;
        _list.ItemsSource = _lib.Presets.Select((p, i) => new Row(p, (i < 9 ? $"Ctrl+{i + 1}   " : "            ") + p.Name + (p.Id == _lib.DefaultPresetId ? "   (default)" : ""))).ToList();
        _list.DisplayMemberPath = nameof(Row.Text);
        if (select is not null) _list.SelectedItem = ((List<Row>)_list.ItemsSource).FirstOrDefault(r => r.Preset == select);
        if (_list.SelectedItem is null && _list.Items.Count > 0) _list.SelectedIndex = 0;
        ShowSelected();
    }

    private Preset? Selected => (_list.SelectedItem as Row)?.Preset;

    private bool KeepEdits()
    {
        if (_shown is null) return true;
        if (_editor.HasErrors)
        {
            MessageBox.Show(this, "Some values are not valid (red box). Please fix them first.", Title, MessageBoxButton.OK, MessageBoxImage.Warning);
            return false;
        }
        _shown.Settings = _editor.Read();
        return true;
    }

    private void ShowSelected()
    {
        if (_shown is not null && _shown != Selected && !_editor.HasErrors) _shown.Settings = _editor.Read();
        _shown = Selected;
        _editor.IsEnabled = _shown is not null;
        _title.Text = _shown is null ? "No preset selected" : "Preset: " + _shown.Name;
        if (_shown is not null) _editor.Load(_shown.Settings, null);
    }

    private void New()
    {
        if (!KeepEdits()) return;
        var name = TextPrompt.Ask(this, "New preset", "Name of the new preset:", "New preset");
        if (name is null) return;
        var p = new Preset { Name = _lib.UniqueName(name) };
        _lib.Presets.Add(p);
        Refresh(p);
    }

    private void Duplicate()
    {
        if (Selected is not Preset src || !KeepEdits()) return;
        var copy = new Preset { Name = _lib.UniqueName(src.Name + " copy"), Settings = src.Settings.Clone() };
        _lib.Presets.Insert(_lib.Presets.IndexOf(src) + 1, copy);
        Refresh(copy);
    }

    private void Rename()
    {
        if (Selected is not Preset p || !KeepEdits()) return;
        var name = TextPrompt.Ask(this, "Rename preset", "New name:", p.Name);
        if (name is null) return;
        p.Name = _lib.UniqueName(name, except: p);
        Refresh(p);
    }

    private void Delete()
    {
        if (Selected is not Preset p) return;
        if (MessageBox.Show(this, $"Delete the preset \"{p.Name}\"?\nFiles using it keep their settings.", Title,
                MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes) return;
        int i = _lib.Presets.IndexOf(p);
        _lib.Presets.Remove(p);
        if (_lib.DefaultPresetId == p.Id) _lib.DefaultPresetId = _lib.Presets.FirstOrDefault()?.Id;
        _shown = null;
        Refresh(_lib.Presets.Count == 0 ? null : _lib.Presets[Math.Min(i, _lib.Presets.Count - 1)]);
    }

    private void MoveBy(int delta)
    {
        if (Selected is not Preset p || !KeepEdits()) return;
        int i = _lib.Presets.IndexOf(p), j = i + delta;
        if (j < 0 || j >= _lib.Presets.Count) return;
        _lib.Presets.RemoveAt(i);
        _lib.Presets.Insert(j, p);
        Refresh(p);
    }

    private void SetDefault()
    {
        if (Selected is not Preset p) return;
        _lib.DefaultPresetId = p.Id;
        Refresh(p);
    }

    private void Import()
    {
        if (!KeepEdits()) return;
        var dlg = new OpenFileDialog { Filter = $"Sievphov presets|*{Storage.PresetExtension}|All files|*.*" };
        if (dlg.ShowDialog(this) != true) return;
        try
        {
            int n = Storage.ImportPresets(dlg.FileName, _lib);
            Refresh(_lib.Presets.LastOrDefault());
            MessageBox.Show(this, $"{n} preset(s) imported.", Title);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, "Could not import: " + ex.Message, Title, MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void Export()
    {
        if (!KeepEdits()) return;
        var dlg = new SaveFileDialog { Filter = $"Sievphov presets|*{Storage.PresetExtension}", FileName = "Sievphov presets" + Storage.PresetExtension };
        if (dlg.ShowDialog(this) != true) return;
        try
        {
            Storage.ExportPresets(dlg.FileName, _lib.Presets);
            MessageBox.Show(this, $"{_lib.Presets.Count} preset(s) exported. Copy the file to another PC and use Import.", Title);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, "Could not export: " + ex.Message, Title, MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void Save()
    {
        if (!KeepEdits()) return;
        Result = _lib;
        DialogResult = true;
    }

    private sealed record Row(Preset Preset, string Text);
}
