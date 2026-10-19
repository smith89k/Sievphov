using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Printing;
using System.Windows;
using System.Windows.Controls;
using Sievphov.Models;
using Sievphov.Printing;
using Sievphov.Services;

namespace Sievphov.Views;

/// <summary>Shows each sheet side the way it will be printed (no paper used).</summary>
public sealed class PreviewWindow : Window
{
    private const float PixelsPerUnit = 1.0f; // 100 px per inch

    private readonly JobItem _item;
    private readonly List<SheetSide> _sides;
    private readonly SheetRenderer? _renderer;
    private readonly SizeF _sheet;
    private readonly RectangleF _printable;
    private readonly System.Windows.Controls.Image _image = new() { Stretch = System.Windows.Media.Stretch.Uniform, Margin = new Thickness(12) };
    private readonly TextBlock _label = new() { VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(10, 0, 10, 0), MinWidth = 220, TextAlignment = TextAlignment.Center };
    private readonly Button _prev = new() { Content = "◀ Previous", Padding = new Thickness(10, 3, 10, 3) };
    private readonly Button _next = new() { Content = "Next ▶", Padding = new Thickness(10, 3, 10, 3) };
    private int _index;

    public PreviewWindow(JobItem item)
    {
        _item = item;
        Title = "Preview – " + item.FileName;
        Width = 900;
        Height = 820;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;

        var s = item.Settings;
        string? error = null;
        try
        {
            var pages = PageRangeParser.SelectPages(s, item.PageCount);
            _sides = SheetLayout.Build(pages, s);
            if (_sides.Count == 0) error = "No pages selected.";
            (_sheet, _printable) = SheetGeometry(item, pages.FirstOrDefault(1));
            _renderer = new SheetRenderer(item, File.ReadAllBytes(item.FilePath), maxDpi: 100);
        }
        catch (Exception ex)
        {
            _sides = new List<SheetSide>();
            error = PdfFile.Describe(ex);
        }

        var bar = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(8) };
        bar.Children.Add(_prev);
        bar.Children.Add(_label);
        bar.Children.Add(_next);
        _prev.Click += (_, _) => Show(_index - 1);
        _next.Click += (_, _) => Show(_index + 1);
        KeyDown += (_, e) =>
        {
            if (e.Key is System.Windows.Input.Key.Right or System.Windows.Input.Key.PageDown) Show(_index + 1);
            if (e.Key is System.Windows.Input.Key.Left or System.Windows.Input.Key.PageUp) Show(_index - 1);
        };

        var root = new DockPanel { Background = System.Windows.Media.Brushes.DimGray };
        var top = new Border { Background = System.Windows.SystemColors.ControlBrush, Child = bar };
        DockPanel.SetDock(top, Dock.Top);
        root.Children.Add(top);
        if (error is not null)
            root.Children.Add(new TextBlock { Text = error, Foreground = System.Windows.Media.Brushes.White, FontSize = 16, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center });
        else
            root.Children.Add(_image);
        Content = root;
        Closed += (_, _) => _renderer?.Dispose();

        if (error is null) Show(0);
        else _prev.IsEnabled = _next.IsEnabled = false;
    }

    private void Show(int index)
    {
        if (_renderer is null || _sides.Count == 0) return;
        _index = Math.Clamp(index, 0, _sides.Count - 1);
        var side = _sides[_index];

        int w = (int)(_sheet.Width * PixelsPerUnit), h = (int)(_sheet.Height * PixelsPerUnit);
        using var bmp = new Bitmap(Math.Max(1, w), Math.Max(1, h), System.Drawing.Imaging.PixelFormat.Format32bppPArgb);
        using (var g = Graphics.FromImage(bmp))
        {
            g.Clear(Color.White);
            g.ScaleTransform(PixelsPerUnit, PixelsPerUnit);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            try
            {
                _renderer.DrawSide(g, _printable, side);
            }
            catch (Exception ex)
            {
                g.DrawString("Cannot draw: " + PdfFile.Describe(ex), System.Drawing.SystemFonts.DefaultFont, Brushes.Red, 20, 20);
            }
            using var pen = new Pen(Color.FromArgb(120, 0, 120, 255), 1) { DashStyle = DashStyle.Dash };
            g.DrawRectangle(pen, _printable.X, _printable.Y, _printable.Width, _printable.Height);
        }
        _image.Source = BitmapConvert.ToWpf(bmp);

        var s = _item.Settings;
        string where = s.IsTwoSided ? $"sheet {side.Sheet + 1}, {(side.IsBack ? "back" : "front")}" : $"sheet {side.Sheet + 1}";
        string pages = string.Join(" | ", side.Slots.Select(p => p?.ToString() ?? "blank"));
        _label.Text = $"Side {_index + 1} of {_sides.Count} · {where} · page {pages}";
        _prev.IsEnabled = _index > 0;
        _next.IsEnabled = _index < _sides.Count - 1;
    }

    /// <summary>Paper size and printable area (1/100 inch) for the file's printer, paper and orientation.</summary>
    private static (SizeF Sheet, RectangleF Printable) SheetGeometry(JobItem item, int firstPage)
    {
        var s = item.Settings;
        float paperW = 827, paperH = 1169, marginX = 25, marginY = 25; // A4 if the printer cannot be asked
        try
        {
            var ps = new PrinterSettings();
            if (!string.IsNullOrEmpty(s.PrinterName)) ps.PrinterName = s.PrinterName;
            if (ps.IsValid)
            {
                var page = new PageSettings(ps);
                if (!string.IsNullOrEmpty(s.PaperSize) &&
                    ps.PaperSizes.Cast<PaperSize>().FirstOrDefault(p => p.PaperName == s.PaperSize) is PaperSize size)
                    page.PaperSize = size;
                paperW = Math.Min(page.PaperSize.Width, page.PaperSize.Height);
                paperH = Math.Max(page.PaperSize.Width, page.PaperSize.Height);
                marginX = page.HardMarginX;
                marginY = page.HardMarginY;
            }
        }
        catch
        {
            // keep A4
        }

        var first = item.PageSizes.Count >= firstPage ? item.PageSizes[firstPage - 1] : new SizeF(595, 842);
        bool landscape = LayoutMath.SheetIsLandscape(s, first, new SizeF(paperW, paperH));
        var sheet = landscape ? new SizeF(paperH, paperW) : new SizeF(paperW, paperH);
        if (landscape) (marginX, marginY) = (marginY, marginX);
        var printable = RectangleF.Inflate(new RectangleF(PointF.Empty, sheet), -marginX, -marginY);
        return (sheet, printable);
    }
}
