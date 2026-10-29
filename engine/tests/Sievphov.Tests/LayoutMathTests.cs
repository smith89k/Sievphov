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
    public void NUpReversedOrdersStartOnTheRight()
    {
        var s = new PrintSettings { Layout = LayoutMode.PagesPerSheet, Columns = 2, Rows = 2, GapMm = 0, Order = NUpOrder.AcrossThenDownReversed };
        var a = LayoutMath.Slots(Box, s);
        Assert.Equal(new PointF(400, 0), a[0].Location);     // page 1 top right
        Assert.Equal(new PointF(0, 0), a[1].Location);
        Assert.Equal(new PointF(400, 500), a[2].Location);
        s.Order = NUpOrder.DownThenAcrossReversed;
        var d = LayoutMath.Slots(Box, s);
        Assert.Equal(new PointF(400, 0), d[0].Location);
        Assert.Equal(new PointF(400, 500), d[1].Location);   // page 2 below page 1
        Assert.Equal(new PointF(0, 0), d[2].Location);
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
    public void NUpGridTurnsWithTheSheet()
    {
        // as Sastra PDF: upright sheet = fewer columns than rows; landscape = the other way round
        var two = new PrintSettings { Layout = LayoutMode.PagesPerSheet, Columns = 2, Rows = 1 };
        Assert.Equal((1, 2), LayoutMath.Grid(two, false));
        Assert.Equal((2, 1), LayoutMath.Grid(two, true));
        var six = new PrintSettings { Layout = LayoutMode.PagesPerSheet, Columns = 3, Rows = 2 };
        Assert.Equal((2, 3), LayoutMath.Grid(six, false));
        Assert.Equal((3, 2), LayoutMath.Grid(six, true));
        two.GapMm = 0;
        var up = LayoutMath.Slots(new RectangleF(0, 0, 800, 1000), two);       // upright: stacked
        Assert.Equal(new RectangleF(0, 500, 800, 500), up[1]);
        var land = LayoutMath.Slots(new RectangleF(0, 0, 1000, 800), two);     // landscape: side by side
        Assert.Equal(new RectangleF(500, 0, 500, 800), land[1]);
    }

    [Fact]
    public void NUpAutoOrientationShowsPagesLargest()
    {
        var a4 = new SizeF(827, 1169);
        var two = new PrintSettings { Layout = LayoutMode.PagesPerSheet, Columns = 2, Rows = 1 };
        Assert.False(LayoutMath.SheetIsLandscape(two, new SizeF(842, 595), a4));   // 2 wide pages: stacked, upright
        var four = new PrintSettings { Layout = LayoutMode.PagesPerSheet, Columns = 2, Rows = 2 };
        Assert.False(LayoutMath.SheetIsLandscape(four, new SizeF(595, 842), a4));
        Assert.True(LayoutMath.SheetIsLandscape(four, new SizeF(842, 595), a4));
        var six = new PrintSettings { Layout = LayoutMode.PagesPerSheet, Columns = 3, Rows = 2 };
        Assert.True(LayoutMath.SheetIsLandscape(six, new SizeF(595, 842), a4));
        var nine = new PrintSettings { Layout = LayoutMode.PagesPerSheet, Columns = 3, Rows = 3 };
        Assert.False(LayoutMath.SheetIsLandscape(nine, new SizeF(595, 842), a4));
    }

    [Fact]
    public void NUpNeverTurnsPages()
    {
        var s = new PrintSettings { Layout = LayoutMode.PagesPerSheet };
        Assert.False(LayoutMath.ShouldRotate(new SizeF(842, 595), Box, s));
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
