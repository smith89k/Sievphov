using System.Drawing;
using Sievphov.Models;
using Sievphov.Services;

namespace Sievphov.Tests;

public class LayoutMathTests
{
    private static readonly RectangleF Box = new(0, 0, 800, 1000);

    [Fact]
    public void FitKeepsShapeAndCenters()
    {
        var r = LayoutMath.FitPage(new SizeF(400, 400), Box, FitMode.Fit, 100, Align9.Center);
        Assert.Equal(new RectangleF(0, 100, 800, 800), r);
    }

    [Fact]
    public void ShrinkOnlyDoesNotEnlarge()
    {
        var r = LayoutMath.FitPage(new SizeF(400, 400), Box, FitMode.ShrinkOnly, 100, Align9.TopLeft);
        Assert.Equal(new RectangleF(0, 0, 400, 400), r);
    }

    [Fact]
    public void FillAndZoom()
    {
        var fill = LayoutMath.FitPage(new SizeF(400, 400), Box, FitMode.Fill, 100, Align9.Center);
        Assert.Equal(1000, fill.Width, 3);
        var zoom = LayoutMath.FitPage(new SizeF(400, 400), Box, FitMode.Zoom, 50, Align9.BottomRight);
        Assert.Equal(new RectangleF(600, 800, 200, 200), zoom);
    }

    [Fact]
    public void NUpSlotsInBothOrders()
    {
        var s = new PrintSettings { Layout = LayoutMode.PagesPerSheet, Columns = 2, Rows = 2, GapMm = 0 };
        var across = LayoutMath.Slots(Box, s);
        Assert.Equal(new PointF(400, 0), across[1].Location);   // page 2 to the right
        s.Order = NUpOrder.DownThenAcross;
        var down = LayoutMath.Slots(Box, s);
        Assert.Equal(new PointF(0, 500), down[1].Location);     // page 2 below
    }

    [Fact]
    public void BookletHalvesWithGapAndPagesAgainstFold()
    {
        var s = new PrintSettings { Layout = LayoutMode.Booklet, BookletGapMm = 25.4 }; // 100 units
        var slots = LayoutMath.Slots(new RectangleF(0, 0, 1100, 800), s);
        Assert.Equal(new RectangleF(0, 0, 500, 800), slots[0]);
        Assert.Equal(new RectangleF(600, 0, 500, 800), slots[1]);
        Assert.Equal(Align9.Right, LayoutMath.SlotAlignment(s, 0));
        Assert.Equal(Align9.Left, LayoutMath.SlotAlignment(s, 1));
    }

    [Fact]
    public void AutoOrientation()
    {
        var a4 = new SizeF(827, 1169);
        Assert.True(LayoutMath.SheetIsLandscape(new PrintSettings(), new SizeF(842, 595), a4));
        Assert.False(LayoutMath.SheetIsLandscape(new PrintSettings(), new SizeF(595, 842), a4));
        // 2 portrait pages side by side fit best on landscape paper.
        var twoUp = new PrintSettings { Layout = LayoutMode.PagesPerSheet, Columns = 2, Rows = 1 };
        Assert.True(LayoutMath.SheetIsLandscape(twoUp, new SizeF(595, 842), a4));
        Assert.True(LayoutMath.SheetIsLandscape(new PrintSettings { Layout = LayoutMode.Booklet, Orientation = OrientationMode.Portrait }, new SizeF(595, 842), a4));
        Assert.False(LayoutMath.SheetIsLandscape(new PrintSettings { Orientation = OrientationMode.Portrait }, new SizeF(842, 595), a4));
    }

    [Fact]
    public void RotatesOnlyWhenShapesDiffer()
    {
        var s = new PrintSettings();
        Assert.True(LayoutMath.ShouldRotate(new SizeF(842, 595), Box, s));
        Assert.False(LayoutMath.ShouldRotate(new SizeF(595, 842), Box, s));
        s.Orientation = OrientationMode.Portrait;
        Assert.False(LayoutMath.ShouldRotate(new SizeF(842, 595), Box, s));
    }

    [Fact]
    public void OutsideStampAlternates()
    {
        var page = new RectangleF(0, 0, 1000, 1000);
        var stamp = new SizeF(100, 50);
        Assert.Equal(890, LayoutMath.PlaceStamp(stamp, page, StampPosition.BottomOutside, 10, 1).X);  // odd → right
        Assert.Equal(10, LayoutMath.PlaceStamp(stamp, page, StampPosition.BottomOutside, 10, 2).X);   // even → left
        Assert.Equal(940, LayoutMath.PlaceStamp(stamp, page, StampPosition.BottomCenter, 10, 2).Y);
    }

    [Fact]
    public void RenderDpiScalesWithDrawnSize()
    {
        var a4 = new SizeF(595, 842);
        Assert.InRange(LayoutMath.RenderDpi(300, 826.4f, a4), 299, 301);   // drawn at full size
        Assert.InRange(LayoutMath.RenderDpi(300, 413.2f, a4), 148, 152); // drawn at half size
    }
}
