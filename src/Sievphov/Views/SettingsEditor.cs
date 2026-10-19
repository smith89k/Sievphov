using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Microsoft.Win32;
using Sievphov.Models;
using Sievphov.Printing;
using Sievphov.Services;

namespace Sievphov.Views;

/// <summary>
/// Edits a <see cref="PrintSettings"/>. Used by File settings and Manage presets.
/// Values that differ from <see cref="Baseline"/> (the file's preset) are shown in bold.
/// </summary>
public sealed class SettingsEditor : UserControl
{
    private readonly List<Field> _fields = new();
    private readonly TabControl _tabs = new();
    private PrintSettings _current = new();
    private bool _loading;

    private ChoiceField _printer = null!, _paper = null!, _tray = null!;
    private Field _layout = null!, _sides = null!, _orientation = null!;
    private readonly TextBlock _printerInfo = new() { Foreground = Brushes.Gray, Margin = new Thickness(0, 2, 0, 0), TextWrapping = TextWrapping.Wrap };

    public SettingsEditor()
    {
        Build();
        Content = _tabs;
    }

    /// <summary>Raised whenever the user changes a value.</summary>
    public event EventHandler? Changed;

    /// <summary>The preset settings to compare with (null = nothing is bold).</summary>
    public PrintSettings? Baseline { get; set; }

    public bool HasErrors => _fields.Any(f => !f.IsValid);

    public void Load(PrintSettings settings, PrintSettings? baseline)
    {
        _loading = true;
        _current = settings.Clone();
        Baseline = baseline;
        RefreshPrinterLists();
        foreach (var f in _fields) f.Load(_current);
        _loading = false;
        UpdateLook();
    }

    /// <summary>A copy of the settings as currently shown.</summary>
    public PrintSettings Read()
    {
        var s = _current.Clone();
        foreach (var f in _fields) f.Save(s);
        return s;
    }

    private void OnFieldChanged(Field field)
    {
        if (_loading) return;
        var before = _current;
        _current = Read();

        // Choosing booklet switches on two-sided printing, as booklets need it.
        if (field == _layout && _current.Layout == LayoutMode.Booklet && before.Layout != LayoutMode.Booklet)
        {
            _current.Sides = SidesMode.ShortEdge;
            _current.Orientation = OrientationMode.Landscape;
            _loading = true;
            _sides.Load(_current);
            _orientation.Load(_current);
            _loading = false;
        }
        if (field == _printer)
        {
            _loading = true;
            RefreshPrinterLists();
            _paper.Load(_current);
            _tray.Load(_current);
            _loading = false;
        }
        UpdateLook();
        Changed?.Invoke(this, EventArgs.Empty);
    }

    private void UpdateLook()
    {
        foreach (var f in _fields)
        {
            bool differs = Baseline is not null && !Equals(f.Value(_current), f.Value(Baseline));
            f.Label.FontWeight = differs ? FontWeights.Bold : FontWeights.Normal;
            f.SetEnabled(f.EnabledWhen?.Invoke(_current) ?? true);
        }
    }

    private void RefreshPrinterLists()
    {
        var printers = PrinterCatalog.Printers();
        var defaultName = PrinterCatalog.DefaultPrinter();
        var printerItems = new List<(object Value, string Text)> { ("", $"(Default printer: {defaultName})") };
        printerItems.AddRange(printers.Select(p => ((object)p, p)));
        if (!string.IsNullOrEmpty(_current.PrinterName) && !printers.Contains(_current.PrinterName))
            printerItems.Add((_current.PrinterName, _current.PrinterName + "  (not installed on this PC)"));
        _printer.SetItems(printerItems);

        var caps = PrinterCatalog.For(_current.PrinterName);
        var papers = new List<(object, string)> { ("", "Printer default") };
        papers.AddRange(caps.PaperSizes.Select(p => ((object)p, p)));
        if (!string.IsNullOrEmpty(_current.PaperSize) && !caps.PaperSizes.Contains(_current.PaperSize))
            papers.Add((_current.PaperSize, _current.PaperSize + "  (not on this printer)"));
        _paper.SetItems(papers);

        var trays = new List<(object, string)> { ("", "As in printer") };
        trays.AddRange(caps.Trays.Select(t => ((object)t, t)));
        if (!string.IsNullOrEmpty(_current.Tray) && !caps.Trays.Contains(_current.Tray))
            trays.Add((_current.Tray, _current.Tray + "  (not on this printer)"));
        _tray.SetItems(trays);

        _printerInfo.Text = !caps.Exists
            ? "This printer is not installed on this PC."
            : $"{caps.Trays.Count} trays · {caps.PaperSizes.Count} paper sizes · " +
              (caps.CanDuplex ? "can print both sides" : "one side only") + " · " + (caps.SupportsColor ? "color" : "black & white");
    }

    // ---------------------------------------------------------------- layout of the tabs

    private void Build()
    {
        var general = Page("Printer & pages");
        _printer = Choice(general, "Printer", s => s.PrinterName, (s, v) => s.PrinterName = (string)v);
        general.Children.Add(Row("", _printerInfo));
        Int(general, "Copies", 1, 999, s => s.Copies, (s, v) => s.Copies = v);
        Enum(general, "Collate", s => s.Collate, (s, v) => s.Collate = v,
            (CollateMode.ByDocument, "By document (1,2,3 … 1,2,3)"), (CollateMode.ByPage, "By page (1,1 … 2,2 …)"))
            .EnabledWhen = s => s.Copies > 1;
        Enum(general, "Pages", s => s.Pages, (s, v) => s.Pages = v,
            (PageSelection.All, "All pages"), (PageSelection.Odd, "Odd pages"), (PageSelection.Even, "Even pages"), (PageSelection.Range, "Page range…"));
        var range = Text(general, "Page range", s => s.PageRange, (s, v) => s.PageRange = v,
            v => PageRangeParser.IsValid(v, out var e) ? null : e);
        range.EnabledWhen = s => s.Pages == PageSelection.Range;
        range.Hint = "e.g. 1-5, 8, 12-last";
        Check(general, "Reverse order", "Print the last page first", s => s.Reverse, (s, v) => s.Reverse = v);

        var paper = Page("Paper & tray");
        _paper = Choice(paper, "Paper size", s => s.PaperSize, (s, v) => s.PaperSize = (string)v);
        _tray = Choice(paper, "Paper tray", s => s.Tray, (s, v) => s.Tray = (string)v);
        _orientation = Enum(paper, "Orientation", s => s.Orientation, (s, v) => s.Orientation = v,
            (OrientationMode.Auto, "Auto (turn pages to fit)"), (OrientationMode.Portrait, "Portrait"), (OrientationMode.Landscape, "Landscape"));
        _sides = Enum(paper, "Sides", s => s.Sides, (s, v) => s.Sides = v,
            (SidesMode.OneSide, "One side"), (SidesMode.LongEdge, "Both sides, flip on long edge"), (SidesMode.ShortEdge, "Both sides, flip on short edge"));
        Enum(paper, "Fit", s => s.Fit, (s, v) => s.Fit = v,
            (FitMode.Fit, "Fit to page"), (FitMode.ShrinkOnly, "Shrink only (large pages)"), (FitMode.ActualSize, "Actual size"),
            (FitMode.Fill, "Fill page (may cut edges)"), (FitMode.Zoom, "Zoom %"));
        Int(paper, "Zoom %", 10, 400, s => s.ZoomPercent, (s, v) => s.ZoomPercent = v).EnabledWhen = s => s.Fit == FitMode.Zoom;
        Enum(paper, "Alignment", s => s.Alignment, (s, v) => s.Alignment = v,
            (Align9.Center, "Center"), (Align9.Top, "Top"), (Align9.Bottom, "Bottom"), (Align9.Left, "Left"), (Align9.Right, "Right"),
            (Align9.TopLeft, "Top left"), (Align9.TopRight, "Top right"), (Align9.BottomLeft, "Bottom left"), (Align9.BottomRight, "Bottom right"))
            .EnabledWhen = s => s.Layout != LayoutMode.Booklet;
        Enum(paper, "Color", s => s.Grayscale, (s, v) => s.Grayscale = v, (false, "Color"), (true, "Grayscale"));
        Enum(paper, "Quality", s => s.Dpi, (s, v) => s.Dpi = v, (150, "Draft (150 dpi)"), (300, "Normal (300 dpi)"), (600, "High (600 dpi)"));

        var layout = Page("Layout");
        _layout = Enum(layout, "Layout", s => s.Layout, (s, v) => s.Layout = v,
            (LayoutMode.Normal, "Normal (1 page per side)"), (LayoutMode.PagesPerSheet, "Several pages per sheet"), (LayoutMode.Booklet, "Booklet (fold in the middle)"));
        bool NUp(PrintSettings s) => s.Layout == LayoutMode.PagesPerSheet;
        bool Booklet(PrintSettings s) => s.Layout == LayoutMode.Booklet;
        Int(layout, "Columns", 1, 10, s => s.Columns, (s, v) => s.Columns = v).EnabledWhen = NUp;
        Int(layout, "Rows", 1, 10, s => s.Rows, (s, v) => s.Rows = v).EnabledWhen = NUp;
        Enum(layout, "Order", s => s.Order, (s, v) => s.Order = v,
            (NUpOrder.AcrossThenDown, "Across, then down"), (NUpOrder.DownThenAcross, "Down, then across")).EnabledWhen = NUp;
        Number(layout, "Gap (mm)", 0, 100, s => s.GapMm, (s, v) => s.GapMm = v).EnabledWhen = NUp;
        Check(layout, "Borders", "Draw a line around each page", s => s.Borders, (s, v) => s.Borders = v).EnabledWhen = NUp;
        Enum(layout, "Binding", s => s.Binding, (s, v) => s.Binding = v,
            (BindingEdge.Left, "Left (Khmer / English books)"), (BindingEdge.Right, "Right")).EnabledWhen = Booklet;
        Number(layout, "Middle gap (mm)", 0, 100, s => s.BookletGapMm, (s, v) => s.BookletGapMm = v).EnabledWhen = Booklet;
        layout.Children.Add(Row("", new TextBlock
        {
            Text = "Booklet: pages are put two per side in folding order (8|1, 2|7 …). Print both sides, flip on short edge, then fold.",
            Foreground = Brushes.Gray,
            TextWrapping = TextWrapping.Wrap,
        }));

        var numbers = Page("Page numbers");
        bool PnOn(PrintSettings s) => s.PageNumbers.Enabled;
        Check(numbers, "Page numbers", "Print page numbers", s => s.PageNumbers.Enabled, (s, v) => s.PageNumbers.Enabled = v);
        Position(numbers, "Position", s => s.PageNumbers.Position, (s, v) => s.PageNumbers.Position = v).EnabledWhen = PnOn;
        Text(numbers, "Format", s => s.PageNumbers.Format, (s, v) => s.PageNumbers.Format = v).EnabledWhen = PnOn;
        Enum(numbers, "Digits", s => s.PageNumbers.Digits, (s, v) => s.PageNumbers.Digits = v,
            (DigitStyle.Western, "1 2 3"), (DigitStyle.Khmer, "១ ២ ៣ (Khmer)")).EnabledWhen = PnOn;
        Int(numbers, "Start at", -999, 9999, s => s.PageNumbers.StartAt, (s, v) => s.PageNumbers.StartAt = v).EnabledWhen = PnOn;
        Font(numbers, "Font", s => s.PageNumbers.Font, (s, v) => s.PageNumbers.Font = v).EnabledWhen = PnOn;
        Number(numbers, "Size (pt)", 4, 72, s => s.PageNumbers.SizePt, (s, v) => s.PageNumbers.SizePt = v).EnabledWhen = PnOn;
        ColorText(numbers, "Color", s => s.PageNumbers.Color, (s, v) => s.PageNumbers.Color = v).EnabledWhen = PnOn;
        Number(numbers, "Margin (mm)", 0, 100, s => s.PageNumbers.MarginMm, (s, v) => s.PageNumbers.MarginMm = v).EnabledWhen = PnOn;
        numbers.Children.Add(Row("", Note("Format: {page} = page number, {pages} = total. e.g. \"ទំព័រ {page}\" or \"{page} / {pages}\".\n" +
                                          "Start at: number shown on page 1. Use 0 or less to leave cover pages without a number.")));

        var watermark = Page("Watermark");
        bool WmOn(PrintSettings s) => s.Watermark.Enabled;
        Check(watermark, "Text watermark", "Print a text watermark", s => s.Watermark.Enabled, (s, v) => s.Watermark.Enabled = v);
        Text(watermark, "Text", s => s.Watermark.Text, (s, v) => s.Watermark.Text = v).EnabledWhen = WmOn;
        Font(watermark, "Font", s => s.Watermark.Font, (s, v) => s.Watermark.Font = v).EnabledWhen = WmOn;
        Number(watermark, "Size (pt)", 4, 400, s => s.Watermark.SizePt, (s, v) => s.Watermark.SizePt = v).EnabledWhen = WmOn;
        ColorText(watermark, "Color", s => s.Watermark.Color, (s, v) => s.Watermark.Color = v).EnabledWhen = WmOn;
        Int(watermark, "See-through %", 0, 95, s => s.Watermark.SeeThroughPercent, (s, v) => s.Watermark.SeeThroughPercent = v).EnabledWhen = WmOn;
        Number(watermark, "Angle (°)", -180, 180, s => s.Watermark.Angle, (s, v) => s.Watermark.Angle = v).EnabledWhen = WmOn;
        Position(watermark, "Position", s => s.Watermark.Position, (s, v) => s.Watermark.Position = v).EnabledWhen = WmOn;
        Number(watermark, "Margin (mm)", 0, 100, s => s.Watermark.MarginMm, (s, v) => s.Watermark.MarginMm = v).EnabledWhen = WmOn;
        watermark.Children.Add(Row("", Note("Macros: {filename} {name} {date} {time} {page} {pages}")));

        var logo = Page("Logo");
        bool LogoOn(PrintSettings s) => s.Logo.Enabled;
        Check(logo, "Image watermark", "Print a picture (logo)", s => s.Logo.Enabled, (s, v) => s.Logo.Enabled = v);
        FilePick(logo, "Picture file", s => s.Logo.Path, (s, v) => s.Logo.Path = v).EnabledWhen = LogoOn;
        Int(logo, "Width (% of page)", 1, 100, s => s.Logo.WidthPercent, (s, v) => s.Logo.WidthPercent = v).EnabledWhen = LogoOn;
        Position(logo, "Position", s => s.Logo.Position, (s, v) => s.Logo.Position = v).EnabledWhen = LogoOn;
        Int(logo, "See-through %", 0, 95, s => s.Logo.SeeThroughPercent, (s, v) => s.Logo.SeeThroughPercent = v).EnabledWhen = LogoOn;
        Number(logo, "Margin (mm)", 0, 100, s => s.Logo.MarginMm, (s, v) => s.Logo.MarginMm = v).EnabledWhen = LogoOn;
    }

    private StackPanel Page(string title)
    {
        var panel = new StackPanel { Margin = new Thickness(10) };
        _tabs.Items.Add(new TabItem
        {
            Header = title,
            Content = new ScrollViewer { Content = panel, VerticalScrollBarVisibility = ScrollBarVisibility.Auto },
        });
        return panel;
    }

    private static Grid Row(string label, UIElement control, TextBlock? labelBlock = null)
    {
        var grid = new Grid { Margin = new Thickness(0, 3, 0, 3) };
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(130) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        var lb = labelBlock ?? new TextBlock { Text = label };
        lb.VerticalAlignment = VerticalAlignment.Center;
        grid.Children.Add(lb);
        Grid.SetColumn(control, 1);
        grid.Children.Add(control);
        return grid;
    }

    private static TextBlock Note(string text) => new() { Text = text, Foreground = Brushes.Gray, TextWrapping = TextWrapping.Wrap };

    private T Add<T>(Panel panel, T field) where T : Field
    {
        field.Changed += () => OnFieldChanged(field);
        _fields.Add(field);
        panel.Children.Add(Row("", field.Control, field.Label));
        return field;
    }

    private ChoiceField Choice(Panel p, string label, Func<PrintSettings, object> get, Action<PrintSettings, object> set) =>
        Add(p, new ChoiceField(label, get, set));

    private ChoiceField Enum<T>(Panel p, string label, Func<PrintSettings, T> get, Action<PrintSettings, T> set, params (T Value, string Text)[] items) where T : notnull
    {
        var f = Add(p, new ChoiceField(label, s => get(s), (s, v) => set(s, (T)v)));
        f.SetItems(items.Select(i => ((object)i.Value, i.Text)).ToList());
        return f;
    }

    private ChoiceField Position(Panel p, string label, Func<PrintSettings, StampPosition> get, Action<PrintSettings, StampPosition> set) =>
        Enum(p, label, get, set,
            (StampPosition.TopLeft, "Top left"), (StampPosition.TopCenter, "Top center"), (StampPosition.TopRight, "Top right"),
            (StampPosition.Center, "Center"),
            (StampPosition.BottomLeft, "Bottom left"), (StampPosition.BottomCenter, "Bottom center"), (StampPosition.BottomRight, "Bottom right"),
            (StampPosition.TopOutside, "Top outside (book)"), (StampPosition.BottomOutside, "Bottom outside (book)"));

    private TextField Text(Panel p, string label, Func<PrintSettings, string> get, Action<PrintSettings, string> set, Func<string, string?>? validate = null) =>
        Add(p, new TextField(label, get, set, validate));

    private TextField Int(Panel p, string label, int min, int max, Func<PrintSettings, int> get, Action<PrintSettings, int> set) =>
        Add(p, new TextField(label, s => get(s).ToString(), (s, v) => set(s, int.Parse(v)),
            v => int.TryParse(v, out var n) && n >= min && n <= max ? null : $"Enter a whole number from {min} to {max}", s => get(s)));

    private TextField Number(Panel p, string label, double min, double max, Func<PrintSettings, double> get, Action<PrintSettings, double> set) =>
        Add(p, new TextField(label, s => get(s).ToString("0.##"), (s, v) => set(s, double.Parse(v.Replace(',', '.'), System.Globalization.CultureInfo.InvariantCulture)),
            v => double.TryParse(v.Replace(',', '.'), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var n) && n >= min && n <= max
                ? null : $"Enter a number from {min} to {max}", s => get(s)));

    private TextField ColorText(Panel p, string label, Func<PrintSettings, string> get, Action<PrintSettings, string> set) =>
        Add(p, new TextField(label, get, set, v =>
        {
            try { return ColorConverter.ConvertFromString(v) is Color ? null : "Use a color like #FF0000 or Red"; }
            catch (FormatException) { return "Use a color like #FF0000 or Red"; }
        }));

    private ChoiceField Font(Panel p, string label, Func<PrintSettings, string> get, Action<PrintSettings, string> set)
    {
        var f = Add(p, new ChoiceField(label, s => get(s), (s, v) => set(s, (string)v), editable: true));
        var fonts = Fonts.SystemFontFamilies.Select(ff => ff.Source).OrderBy(n => n)
            .OrderByDescending(n => n.Contains("Khmer", StringComparison.OrdinalIgnoreCase)).ToList();
        f.SetItems(fonts.Select(n => ((object)n, n)).ToList());
        return f;
    }

    private TextField FilePick(Panel p, string label, Func<PrintSettings, string> get, Action<PrintSettings, string> set)
    {
        var f = new TextField(label, get, set, v => string.IsNullOrWhiteSpace(v) || File.Exists(v) ? null : "File not found");
        var browse = new Button { Content = "Browse…", Padding = new Thickness(8, 0, 8, 0), Margin = new Thickness(4, 0, 0, 0) };
        browse.Click += (_, _) =>
        {
            var dlg = new OpenFileDialog { Filter = "Pictures|*.png;*.jpg;*.jpeg;*.bmp;*.gif|All files|*.*" };
            if (dlg.ShowDialog() == true) f.Box.Text = dlg.FileName;
        };
        var dock = new DockPanel();
        DockPanel.SetDock(browse, Dock.Right);
        dock.Children.Add(browse);
        dock.Children.Add(f.Box);
        f.Control = dock;
        return Add(p, f);
    }

    private Field Check(Panel p, string label, string text, Func<PrintSettings, bool> get, Action<PrintSettings, bool> set) =>
        Add(p, new CheckField(label, text, get, set));

    // ---------------------------------------------------------------- field types

    private abstract class Field
    {
        protected Field(string label) { Label = new TextBlock { Text = label }; }

        public TextBlock Label { get; }
        public FrameworkElement Control { get; set; } = null!;
        public Func<PrintSettings, bool>? EnabledWhen { get; set; }
        public virtual bool IsValid => true;
        public event Action? Changed;

        public abstract void Load(PrintSettings s);
        public abstract void Save(PrintSettings s);
        /// <summary>The value this field shows, for the bold comparison.</summary>
        public abstract object? Value(PrintSettings s);

        public void SetEnabled(bool enabled)
        {
            Control.IsEnabled = enabled;
            Label.Opacity = enabled ? 1 : 0.5;
        }

        protected void RaiseChanged() => Changed?.Invoke();
    }

    private sealed class ChoiceField : Field
    {
        private readonly Func<PrintSettings, object> _get;
        private readonly Action<PrintSettings, object> _set;
        private readonly ComboBox _box;
        private readonly bool _editable;

        public ChoiceField(string label, Func<PrintSettings, object> get, Action<PrintSettings, object> set, bool editable = false) : base(label)
        {
            _get = get;
            _set = set;
            _editable = editable;
            _box = new ComboBox { IsEditable = editable, DisplayMemberPath = "Text", SelectedValuePath = "Value" };
            _box.SelectionChanged += (_, _) => RaiseChanged();
            if (editable) _box.AddHandler(System.Windows.Controls.Primitives.TextBoxBase.TextChangedEvent, new TextChangedEventHandler((_, _) => RaiseChanged()));
            Control = _box;
        }

        public void SetItems(IList<(object Value, string Text)> items)
        {
            var selected = _box.SelectedValue;
            _box.ItemsSource = items.Select(i => new Option(i.Value, i.Text)).ToList();
            if (selected is not null) _box.SelectedValue = selected;
        }

        public override void Load(PrintSettings s)
        {
            var v = _get(s);
            if (_editable) _box.Text = v?.ToString() ?? "";
            else _box.SelectedValue = v;
        }

        public override void Save(PrintSettings s)
        {
            if (_editable)
            {
                if (!string.IsNullOrWhiteSpace(_box.Text)) _set(s, _box.Text.Trim());
            }
            else if (_box.SelectedValue is { } v)
            {
                _set(s, v);
            }
        }

        public override object? Value(PrintSettings s) => _get(s);

        private sealed record Option(object Value, string Text);
    }

    private sealed class TextField : Field
    {
        private readonly Func<PrintSettings, string> _get;
        private readonly Action<PrintSettings, string> _set;
        private readonly Func<string, string?>? _validate;
        private readonly Func<PrintSettings, object?>? _value;
        private string? _hint;

        public TextField(string label, Func<PrintSettings, string> get, Action<PrintSettings, string> set,
            Func<string, string?>? validate = null, Func<PrintSettings, object?>? value = null) : base(label)
        {
            _get = get;
            _set = set;
            _validate = validate;
            _value = value;
            Box = new TextBox { VerticalContentAlignment = VerticalAlignment.Center, Padding = new Thickness(2) };
            Box.TextChanged += (_, _) => { Check(); RaiseChanged(); };
            Control = Box;
        }

        public TextBox Box { get; }

        public string? Hint
        {
            get => _hint;
            set { _hint = value; Box.ToolTip = value; }
        }

        public override bool IsValid => !Box.IsEnabled || _validate?.Invoke(Box.Text) is null;

        private void Check()
        {
            var error = _validate?.Invoke(Box.Text);
            Box.BorderBrush = error is null ? SystemColors.ControlDarkBrush : Brushes.Red;
            Box.ToolTip = error ?? _hint;
        }

        public override void Load(PrintSettings s) => Box.Text = _get(s);

        public override void Save(PrintSettings s)
        {
            // Invalid text keeps the old value; the red border tells the user.
            if (_validate?.Invoke(Box.Text) is null) _set(s, Box.Text);
        }

        public override object? Value(PrintSettings s) => _value is null ? _get(s) : _value(s);
    }

    private sealed class CheckField : Field
    {
        private readonly Func<PrintSettings, bool> _get;
        private readonly Action<PrintSettings, bool> _set;
        private readonly CheckBox _box;

        public CheckField(string label, string text, Func<PrintSettings, bool> get, Action<PrintSettings, bool> set) : base(label)
        {
            _get = get;
            _set = set;
            _box = new CheckBox { Content = text, VerticalAlignment = VerticalAlignment.Center };
            _box.Checked += (_, _) => RaiseChanged();
            _box.Unchecked += (_, _) => RaiseChanged();
            Control = _box;
        }

        public override void Load(PrintSettings s) => _box.IsChecked = _get(s);
        public override void Save(PrintSettings s) => _set(s, _box.IsChecked == true);
        public override object? Value(PrintSettings s) => _get(s);
    }
}
