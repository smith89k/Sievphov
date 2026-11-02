using System.Drawing;
using Sievphov.Models;

namespace Sievphov.Services;

/// <summary>
/// Where pages go on a sheet. All sizes are in 1/100 inch (the unit Windows printing uses),
/// except PDF page sizes, which come in points (1/72 inch).
/// </summary>
public static class LayoutMath
{
    public static float MmToUnits(double mm) => (float)(mm / 25.4 * 100);
    public static SizeF PointsToUnits(SizeF pt) => new(pt.Width * 100f / 72f, pt.Height * 100f / 72f);

    /// <summary>Kept clear inside the edge a printer reports (about 2 mm): paper feeds a little off, and a frame on the very edge would lose a side.</summary>
    public const float EdgeSafety = 8;

    /// <summary>
    /// A small dot for blank paper (0.25 mm, smaller than a full stop), near the corner of the print area: printers can skip a page that looks
    /// empty once it is ready to print, and a white mark still looks empty (pale grey can vanish too, as printers build grey out of dots).
    /// </summary>
    public static RectangleF BlankSheetMark(RectangleF printable) =>
        new(printable.Right - 11, printable.Bottom - 11, 1, 1);

    /// <summary>The printer's area as the sheet lies:.NET's PrintableArea gives a landscape sheet's the portrait way round.</summary>
    public static RectangleF UprightArea(RectangleF printableArea, bool landscape) =>
        landscape ? new RectangleF(printableArea.Y, printableArea.X, printableArea.Height, printableArea.Width) : printableArea;

    /// <summary>
    /// Where Sievphov prints on a sheet, in paper coordinates, from the printer's real area (<see cref="UprightArea"/>).
    /// Both sides get the wider margin, so what prints stays in the middle of the paper and a booklet's fold on its centre line.
    /// A printer with no margin (a PDF printer) keeps the whole sheet.
    /// </summary>
    public static RectangleF PrintArea(SizeF sheet, RectangleF printer)
    {
        static float Margin(float a, float b) { float m = Math.Max(a, b); return m < 1 ? 0 : m + EdgeSafety; }
        float x = Margin(printer.Left, sheet.Width - printer.Right), y = Margin(printer.Top, sheet.Height - printer.Bottom);
        return new RectangleF(x, y, sheet.Width - 2 * x, sheet.Height - 2 * y);
    }

    /// <summary>Should the sheet be landscape for these settings and this first page (in points)?</summary>
    public static bool SheetIsLandscape(PrintSettings s, SizeF firstPage, SizeF portraitSheet)
    {
        if (s.Layout == LayoutMode.Booklet) return true;
        if (s.Orientation == OrientationMode.Portrait) return false;
        if (s.Orientation == OrientationMode.Landscape) return true;
        if (firstPage.Width <= 0 || firstPage.Height <= 0) return false;

        if (s.Layout == LayoutMode.PagesPerSheet)
        {
            // As Sastra PDF: the way round whose cells show the first page larger (upright when equal).
            var page = PointsToUnits(firstPage);
            float gap = MmToUnits(s.GapMm);
            double Fit(bool land)
            {
                var (cols, rows) = Grid(s, land);
                float w = land ? portraitSheet.Height : portraitSheet.Width, h = land ? portraitSheet.Width : portraitSheet.Height;
                return Math.Min((w - gap * (cols - 1)) / cols / page.Width, (h - gap * (rows - 1)) / rows / page.Height);
            }
            return Fit(true) > Fit(false) + 1e-9;
        }
        return firstPage.Width > firstPage.Height;
    }

    /// <summary>
    /// Pages per sheet as in Sastra PDF: the grid turns with the sheet. Upright: the smaller of Columns / Rows across,
    /// landscape: the larger (2 → 1 × 2 upright, 2 × 1 landscape; 6 → 2 × 3, 3 × 2).
    /// </summary>
    public static (int Cols, int Rows) Grid(PrintSettings s, bool landscape)
    {
        int a = Math.Max(1, Math.Min(s.Columns, s.Rows)), b = Math.Max(1, Math.Max(s.Columns, s.Rows));
        return landscape ? (b, a) : (a, b);
    }

    /// <summary>The places on one side where pages are drawn, in slot order.</summary>
    public static RectangleF[] Slots(RectangleF area, PrintSettings s)
    {
        switch (s.Layout)
        {
            case LayoutMode.Booklet:
            {
                float gap = MmToUnits(s.BookletGapMm);
                float w = (area.Width - gap) / 2;
                return new[]
                {
                    new RectangleF(area.Left, area.Top, w, area.Height),
                    new RectangleF(area.Left + w + gap, area.Top, w, area.Height),
                };
            }
            case LayoutMode.PagesPerSheet:
            {
                var (cols, rows) = Grid(s, area.Width > area.Height);
                float gap = MmToUnits(s.GapMm);
                float w = (area.Width - gap * (cols - 1)) / cols;
                float h = (area.Height - gap * (rows - 1)) / rows;
                var slots = new RectangleF[cols * rows];
                for (int i = 0; i < slots.Length; i++)
                {
                    int col, row;
                    if (s.Order is NUpOrder.AcrossThenDown or NUpOrder.AcrossThenDownReversed) { col = i % cols; row = i / cols; }
                    else { row = i % rows; col = i / rows; }
                    if (s.Order is NUpOrder.AcrossThenDownReversed or NUpOrder.DownThenAcrossReversed) col = cols - 1 - col;
                    slots[i] = new RectangleF(area.Left + col * (w + gap), area.Top + row * (h + gap), w, h);
                }
                return slots;
            }
            default:
                return new[] { area };
        }
    }

    /// <summary>Turn the page 90° when its shape does not match the slot (Auto orientation only; never in pages per sheet, as Sastra PDF).</summary>
    public static bool ShouldRotate(SizeF page, RectangleF slot, PrintSettings s)
    {
        if (s.Orientation != OrientationMode.Auto || s.Layout == LayoutMode.PagesPerSheet) return false;
        bool pageWide = page.Width > page.Height * 1.02f;
        bool pageTall = page.Height > page.Width * 1.02f;
        bool slotWide = slot.Width > slot.Height;
        return (pageWide && !slotWide) || (pageTall && slotWide);
    }

    /// <summary>Alignment for a slot: booklet pages sit against the fold.</summary>
    public static Align9 SlotAlignment(PrintSettings s, int slotIndex)
    {
        if (s.Layout != LayoutMode.Booklet) return s.Alignment;
        return slotIndex == 0 ? Align9.Right : Align9.Left;
    }

    /// <summary>The rectangle a page of <paramref name="pageSize"/> (1/100 inch) takes in <paramref name="slot"/>.</summary>
    public static RectangleF FitPage(SizeF pageSize, RectangleF slot, FitMode fit, int zoomPercent, Align9 align)
    {
        if (pageSize.Width <= 0 || pageSize.Height <= 0) return slot;
        float fitScale = Math.Min(slot.Width / pageSize.Width, slot.Height / pageSize.Height);
        float scale = fit switch
        {
            FitMode.ShrinkOnly => Math.Min(1f, fitScale),
            FitMode.ActualSize => 1f,
            FitMode.Fill => Math.Max(slot.Width / pageSize.Width, slot.Height / pageSize.Height),
            FitMode.Zoom => Math.Max(1, zoomPercent) / 100f,
            _ => fitScale,
        };
        float w = pageSize.Width * scale, h = pageSize.Height * scale;
        return Align(new SizeF(w, h), slot, align);
    }

    public static RectangleF Align(SizeF size, RectangleF box, Align9 align)
    {
        float x = align switch
        {
            Align9.TopLeft or Align9.Left or Align9.BottomLeft => box.Left,
            Align9.TopRight or Align9.Right or Align9.BottomRight => box.Right - size.Width,
            _ => box.Left + (box.Width - size.Width) / 2,
        };
        float y = align switch
        {
            Align9.TopLeft or Align9.Top or Align9.TopRight => box.Top,
            Align9.BottomLeft or Align9.Bottom or Align9.BottomRight => box.Bottom - size.Height,
            _ => box.Top + (box.Height - size.Height) / 2,
        };
        return new RectangleF(x, y, size.Width, size.Height);
    }

    /// <summary>Where a stamp (page number, watermark, logo) goes on a page.</summary>
    public static RectangleF PlaceStamp(SizeF stamp, RectangleF page, StampPosition pos, float margin, int pageNumber)
    {
        var box = RectangleF.Inflate(page, -margin, -margin);
        bool odd = pageNumber % 2 == 1;
        Align9 align = pos switch
        {
            StampPosition.TopLeft => Align9.TopLeft,
            StampPosition.TopCenter => Align9.Top,
            StampPosition.TopRight => Align9.TopRight,
            StampPosition.BottomLeft => Align9.BottomLeft,
            StampPosition.BottomCenter => Align9.Bottom,
            StampPosition.BottomRight => Align9.BottomRight,
            StampPosition.TopOutside => odd ? Align9.TopRight : Align9.TopLeft,
            StampPosition.BottomOutside => odd ? Align9.BottomRight : Align9.BottomLeft,
            _ => Align9.Center,
        };
        return Align(stamp, box, align);
    }

    /// <summary>
    /// Render resolution for a page drawn at <paramref name="drawnWidth"/> (1/100 inch) when the page
    /// is <paramref name="pageWidthPt"/> points wide, kept under ~60 megapixels.
    /// </summary>
    public static int RenderDpi(int wantedDpi, float drawnWidth, SizeF pagePt)
    {
        if (pagePt.Width <= 0 || pagePt.Height <= 0) return wantedDpi;
        double pageWidthIn = pagePt.Width / 72.0;
        double dpi = wantedDpi * (drawnWidth / 100.0) / pageWidthIn;
        double maxDpi = Math.Sqrt(60_000_000 / ((pagePt.Width / 72.0) * (pagePt.Height / 72.0)));
        return (int)Math.Clamp(Math.Min(dpi, maxDpi), 36, 1200);
    }
}
