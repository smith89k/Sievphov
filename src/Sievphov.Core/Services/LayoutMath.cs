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

    /// <summary>Should the sheet be landscape for these settings and this first page (in points)?</summary>
    public static bool SheetIsLandscape(PrintSettings s, SizeF firstPage, SizeF portraitSheet)
    {
        if (s.Layout == LayoutMode.Booklet) return true;
        if (s.Orientation == OrientationMode.Portrait) return false;
        if (s.Orientation == OrientationMode.Landscape) return true;
        if (firstPage.Width <= 0 || firstPage.Height <= 0) return false;

        if (s.Layout == LayoutMode.PagesPerSheet)
        {
            // Pick the orientation whose slots are closest in shape to the page.
            double page = firstPage.Width / firstPage.Height;
            double cols = Math.Max(1, s.Columns), rows = Math.Max(1, s.Rows);
            double portraitSlot = (portraitSheet.Width / cols) / (portraitSheet.Height / rows);
            double landscapeSlot = (portraitSheet.Height / cols) / (portraitSheet.Width / rows);
            return Math.Abs(Math.Log(landscapeSlot / page)) < Math.Abs(Math.Log(portraitSlot / page));
        }
        return firstPage.Width > firstPage.Height;
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
                int cols = Math.Max(1, s.Columns), rows = Math.Max(1, s.Rows);
                float gap = MmToUnits(s.GapMm);
                float w = (area.Width - gap * (cols - 1)) / cols;
                float h = (area.Height - gap * (rows - 1)) / rows;
                var slots = new RectangleF[cols * rows];
                for (int i = 0; i < slots.Length; i++)
                {
                    int col, row;
                    if (s.Order == NUpOrder.AcrossThenDown) { col = i % cols; row = i / cols; }
                    else { row = i % rows; col = i / rows; }
                    slots[i] = new RectangleF(area.Left + col * (w + gap), area.Top + row * (h + gap), w, h);
                }
                return slots;
            }
            default:
                return new[] { area };
        }
    }

    /// <summary>Turn the page 90° when its shape does not match the slot (Auto orientation only).</summary>
    public static bool ShouldRotate(SizeF page, RectangleF slot, PrintSettings s)
    {
        if (s.Orientation != OrientationMode.Auto) return false;
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
