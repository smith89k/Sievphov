using System.Text.Json;
using System.Text.Json.Serialization;

namespace Sievphov.Models;

public enum PageSelection { All, Odd, Even, Range }
public enum CollateMode { ByDocument, ByPage }
public enum SidesMode { OneSide, LongEdge, ShortEdge }
public enum OrientationMode { Auto, Portrait, Landscape }
public enum FitMode { Fit, ShrinkOnly, ActualSize, Fill, Zoom }
public enum Align9 { TopLeft, Top, TopRight, Left, Center, Right, BottomLeft, Bottom, BottomRight }
public enum LayoutMode { Normal, PagesPerSheet, Booklet }
public enum NUpOrder { AcrossThenDown, DownThenAcross }
public enum BindingEdge { Left, Right }
public enum DigitStyle { Western, Khmer }

public enum StampPosition
{
    TopLeft, TopCenter, TopRight,
    Center,
    BottomLeft, BottomCenter, BottomRight,
    /// <summary>Odd pages right, even pages left (outer edge of a book).</summary>
    TopOutside,
    BottomOutside,
}

/// <summary>
/// Everything that decides how one PDF file is printed. A preset holds one of these,
/// and every file in the list holds its own copy.
/// </summary>
public sealed class PrintSettings
{
    /// <summary>Empty = the Windows default printer.</summary>
    public string PrinterName { get; set; } = "";
    public int Copies { get; set; } = 1;
    public CollateMode Collate { get; set; } = CollateMode.ByDocument;

    public PageSelection Pages { get; set; } = PageSelection.All;
    /// <summary>Used when <see cref="Pages"/> is Range, e.g. "1-5, 8, 12-last".</summary>
    public string PageRange { get; set; } = "";
    public bool Reverse { get; set; }

    /// <summary>Empty = the printer's default paper.</summary>
    public string PaperSize { get; set; } = "";
    /// <summary>Paper tray (paper source). Empty = as set in the printer.</summary>
    public string Tray { get; set; } = "";
    public OrientationMode Orientation { get; set; } = OrientationMode.Auto;
    public SidesMode Sides { get; set; } = SidesMode.OneSide;

    public FitMode Fit { get; set; } = FitMode.Fit;
    public int ZoomPercent { get; set; } = 100;
    public Align9 Alignment { get; set; } = Align9.Center;

    public bool Grayscale { get; set; }
    /// <summary>Resolution the PDF pages are rendered at.</summary>
    public int Dpi { get; set; } = 300;

    public LayoutMode Layout { get; set; } = LayoutMode.Normal;
    public int Columns { get; set; } = 2;
    public int Rows { get; set; } = 1;
    public NUpOrder Order { get; set; } = NUpOrder.AcrossThenDown;
    public double GapMm { get; set; } = 5;
    public bool Borders { get; set; }
    public BindingEdge Binding { get; set; } = BindingEdge.Left;
    public double BookletGapMm { get; set; } = 10;

    public PageNumberSettings PageNumbers { get; set; } = new();
    public TextWatermarkSettings Watermark { get; set; } = new();
    public ImageWatermarkSettings Logo { get; set; } = new();

    [JsonIgnore]
    public bool IsTwoSided => Layout == LayoutMode.Booklet || Sides != SidesMode.OneSide;

    [JsonIgnore]
    public int SlotsPerSide => Layout switch
    {
        LayoutMode.PagesPerSheet => Math.Max(1, Columns) * Math.Max(1, Rows),
        LayoutMode.Booklet => 2,
        _ => 1,
    };

    public PrintSettings Clone() =>
        JsonSerializer.Deserialize<PrintSettings>(JsonSerializer.Serialize(this, Json.Options), Json.Options)!;

    public bool ContentEquals(PrintSettings? other) =>
        other is not null &&
        JsonSerializer.Serialize(this, Json.Options) == JsonSerializer.Serialize(other, Json.Options);
}

public sealed class PageNumberSettings
{
    public bool Enabled { get; set; }
    public StampPosition Position { get; set; } = StampPosition.BottomCenter;
    public string Font { get; set; } = "Khmer UI";
    public double SizePt { get; set; } = 11;
    public string Color { get; set; } = "#000000";
    /// <summary>Number shown on page 1 of the PDF. Pages whose number would be below 1 get no number.</summary>
    public int StartAt { get; set; } = 1;
    /// <summary>Text with {page} and {pages}, e.g. "{page} / {pages}".</summary>
    public string Format { get; set; } = "{page}";
    public DigitStyle Digits { get; set; } = DigitStyle.Western;
    public double MarginMm { get; set; } = 8;
}

public sealed class TextWatermarkSettings
{
    public bool Enabled { get; set; }
    /// <summary>Text with macros {filename}, {name}, {date}, {time}, {page}, {pages}.</summary>
    public string Text { get; set; } = "{filename}";
    public string Font { get; set; } = "Khmer UI";
    public double SizePt { get; set; } = 48;
    public string Color { get; set; } = "#FF0000";
    public int SeeThroughPercent { get; set; } = 70;
    public double Angle { get; set; } = 45;
    public StampPosition Position { get; set; } = StampPosition.Center;
    public double MarginMm { get; set; } = 10;
}

public sealed class ImageWatermarkSettings
{
    public bool Enabled { get; set; }
    public string Path { get; set; } = "";
    /// <summary>Logo width as a percent of the page width.</summary>
    public int WidthPercent { get; set; } = 20;
    public StampPosition Position { get; set; } = StampPosition.TopRight;
    public int SeeThroughPercent { get; set; } = 0;
    public double MarginMm { get; set; } = 10;
}

public static class Json
{
    public static readonly JsonSerializerOptions Options = new()
    {
        WriteIndented = true,
        Converters = { new JsonStringEnumConverter() },
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };
}
