using System.Windows;
using System.Windows.Controls;
using Sievphov.Models;

namespace Sievphov.Views;

/// <summary>Asked after picking a folder: include subfolders? which preset for the new files?</summary>
public static class AddFolderOptions
{
    public static (bool Subfolders, Preset? Preset)? Ask(Window owner, string folder, bool subfolders, PresetLibrary library, Preset? preset)
    {
        var win = new Window
        {
            Title = "Add folder",
            Owner = owner,
            Width = 460,
            SizeToContent = SizeToContent.Height,
            ResizeMode = ResizeMode.NoResize,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            ShowInTaskbar = false,
        };
        var panel = new StackPanel { Margin = new Thickness(12) };
        panel.Children.Add(new TextBlock { Text = folder, FontWeight = FontWeights.SemiBold, TextTrimming = TextTrimming.CharacterEllipsis, ToolTip = folder });
        var sub = new CheckBox { Content = "Include subfolders", IsChecked = subfolders, Margin = new Thickness(0, 10, 0, 0) };
        panel.Children.Add(sub);
        panel.Children.Add(new TextBlock { Text = "Apply this preset to the added files:", Margin = new Thickness(0, 10, 0, 4) });
        var box = new ComboBox { ItemsSource = library.Presets, DisplayMemberPath = nameof(Preset.Name), SelectedItem = preset };
        panel.Children.Add(box);

        var buttons = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 14, 0, 0) };
        var ok = new Button { Content = "Add", IsDefault = true, MinWidth = 70, Margin = new Thickness(0, 0, 6, 0), Padding = new Thickness(8, 2, 8, 2) };
        var cancel = new Button { Content = "Cancel", IsCancel = true, MinWidth = 70, Padding = new Thickness(8, 2, 8, 2) };
        ok.Click += (_, _) => win.DialogResult = true;
        buttons.Children.Add(ok);
        buttons.Children.Add(cancel);
        panel.Children.Add(buttons);
        win.Content = panel;

        if (win.ShowDialog() != true) return null;
        return (sub.IsChecked == true, box.SelectedItem as Preset);
    }
}
