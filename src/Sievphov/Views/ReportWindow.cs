using System.Windows;
using System.Windows.Controls;
using Microsoft.Win32;
using Sievphov.Models;
using Sievphov.Services;

namespace Sievphov.Views;

/// <summary>After printing: what printed, what failed and why. Can be saved as CSV for Excel.</summary>
public sealed class ReportWindow : Window
{
    public ReportWindow(IReadOnlyList<ReportRow> rows)
    {
        Title = "Finished report";
        Width = 1000;
        Height = 520;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;

        int printed = rows.Count(r => r.Status == "Printed");
        int failed = rows.Count(r => r.Status == "Error");
        int stopped = rows.Count(r => r.Status == "Stopped");
        var summary = new TextBlock
        {
            Margin = new Thickness(10),
            FontSize = 14,
            Text = $"{printed} printed · {failed} failed · {stopped} stopped · {rows.Sum(r => r.Pages)} pages · {rows.Sum(r => r.Sheets)} sheets",
        };

        var grid = new DataGrid
        {
            ItemsSource = rows,
            IsReadOnly = true,
            AutoGenerateColumns = false,
            Margin = new Thickness(10, 0, 10, 0),
            HeadersVisibility = DataGridHeadersVisibility.Column,
        };
        void Col(string header, string path, double width = double.NaN) =>
            grid.Columns.Add(new DataGridTextColumn
            {
                Header = header,
                Binding = new System.Windows.Data.Binding(path) { StringFormat = path is nameof(ReportRow.Started) or nameof(ReportRow.Finished) ? "HH:mm:ss" : null },
                Width = double.IsNaN(width) ? DataGridLength.Auto : new DataGridLength(width),
            });
        Col("File", nameof(ReportRow.FileName), 220);
        Col("Status", nameof(ReportRow.Status));
        Col("Message", nameof(ReportRow.Message), 260);
        Col("Printer", nameof(ReportRow.Printer));
        Col("Preset", nameof(ReportRow.Preset));
        Col("Pages", nameof(ReportRow.Pages));
        Col("Sheets", nameof(ReportRow.Sheets));
        Col("Copies", nameof(ReportRow.Copies));
        Col("Start", nameof(ReportRow.Started));
        Col("End", nameof(ReportRow.Finished));

        var save = new Button { Content = "Save as CSV (Excel)…", Padding = new Thickness(10, 3, 10, 3), Margin = new Thickness(0, 0, 6, 0) };
        var close = new Button { Content = "Close", IsCancel = true, IsDefault = true, Padding = new Thickness(14, 3, 14, 3) };
        save.Click += (_, _) =>
        {
            var dlg = new SaveFileDialog { Filter = "CSV (Excel)|*.csv", FileName = $"Sievphov report {DateTime.Now:yyyy-MM-dd HHmm}.csv" };
            if (dlg.ShowDialog(this) != true) return;
            try
            {
                Storage.WriteReportCsv(dlg.FileName, rows);
            }
            catch (Exception ex)
            {
                MessageBox.Show(this, "Could not save: " + ex.Message, Title, MessageBoxButton.OK, MessageBoxImage.Error);
            }
        };
        close.Click += (_, _) => Close();
        var buttons = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(10) };
        buttons.Children.Add(save);
        buttons.Children.Add(close);

        var root = new DockPanel();
        DockPanel.SetDock(summary, Dock.Top);
        DockPanel.SetDock(buttons, Dock.Bottom);
        root.Children.Add(summary);
        root.Children.Add(buttons);
        root.Children.Add(grid);
        Content = root;
    }
}
