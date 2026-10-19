using System.Windows;
using System.Windows.Controls;

namespace Sievphov.Views;

/// <summary>Small "type a name / password" dialog.</summary>
public static class TextPrompt
{
    public static string? Ask(Window? owner, string title, string question, string value = "", bool password = false, string? checkText = null)
        => AskWithCheck(owner, title, question, value, password, checkText).Text;

    public static (string? Text, bool Checked) AskWithCheck(Window? owner, string title, string question, string value = "", bool password = false, string? checkText = null)
    {
        var win = new Window
        {
            Title = title,
            Owner = owner,
            Width = 420,
            SizeToContent = SizeToContent.Height,
            ResizeMode = ResizeMode.NoResize,
            WindowStartupLocation = owner is null ? WindowStartupLocation.CenterScreen : WindowStartupLocation.CenterOwner,
            ShowInTaskbar = owner is null,
        };
        var panel = new StackPanel { Margin = new Thickness(12) };
        panel.Children.Add(new TextBlock { Text = question, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 6) });

        var text = new TextBox { Text = value, Padding = new Thickness(3) };
        var pass = new PasswordBox { Padding = new Thickness(3) };
        panel.Children.Add(password ? pass : text);

        var check = new CheckBox { Content = checkText, Margin = new Thickness(0, 8, 0, 0), Visibility = checkText is null ? Visibility.Collapsed : Visibility.Visible };
        panel.Children.Add(check);

        var buttons = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 12, 0, 0) };
        var ok = new Button { Content = "OK", IsDefault = true, MinWidth = 70, Margin = new Thickness(0, 0, 6, 0), Padding = new Thickness(8, 2, 8, 2) };
        var cancel = new Button { Content = "Cancel", IsCancel = true, MinWidth = 70, Padding = new Thickness(8, 2, 8, 2) };
        ok.Click += (_, _) => win.DialogResult = true;
        buttons.Children.Add(ok);
        buttons.Children.Add(cancel);
        panel.Children.Add(buttons);
        win.Content = panel;
        win.Loaded += (_, _) =>
        {
            if (password) pass.Focus();
            else { text.Focus(); text.SelectAll(); }
        };

        if (win.ShowDialog() != true) return (null, false);
        var result = password ? pass.Password : text.Text.Trim();
        return (password || result.Length > 0 ? result : null, check.IsChecked == true);
    }
}
