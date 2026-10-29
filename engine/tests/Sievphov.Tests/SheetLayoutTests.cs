using Sievphov.Models;
using Sievphov.Services;

namespace Sievphov.Tests;

public class SheetLayoutTests
{
    private static List<int> Pages(int n) => Enumerable.Range(1, n).ToList();

    [Fact]
    public void BookletOfEightPages()
    {
        var sides = SheetLayout.Booklet(Pages(8), BindingEdge.Left);
        Assert.Equal(4, sides.Count);
        Assert.Equal(new int?[] { 8, 1 }, sides[0].Slots);  // sheet 1 front
        Assert.Equal(new int?[] { 2, 7 }, sides[1].Slots);  // sheet 1 back
        Assert.Equal(new int?[] { 6, 3 }, sides[2].Slots);
        Assert.Equal(new int?[] { 4, 5 }, sides[3].Slots);
        Assert.False(sides[0].IsBack);
        Assert.True(sides[1].IsBack);
        Assert.Equal(1, sides[3].Sheet);
    }

    [Fact]
    public void BookletPadsWithBlankPages()
    {
        var sides = SheetLayout.Booklet(Pages(6), BindingEdge.Left);
        Assert.Equal(new int?[] { null, 1 }, sides[0].Slots);
        Assert.Equal(new int?[] { 2, null }, sides[1].Slots);
        Assert.Equal(new int?[] { 6, 3 }, sides[2].Slots);
        Assert.Equal(new int?[] { 4, 5 }, sides[3].Slots);
    }

    [Fact]
    public void BookletRightBindingSwapsSides()
    {
        var sides = SheetLayout.Booklet(Pages(8), BindingEdge.Right);
        Assert.Equal(new int?[] { 1, 8 }, sides[0].Slots);
        Assert.Equal(new int?[] { 7, 2 }, sides[1].Slots);
    }

    [Fact]
    public void BookletUsesSelectedPages()
    {
        // Pages 3..6 only: a 4-page booklet.
        var sides = SheetLayout.Booklet(new[] { 3, 4, 5, 6 }, BindingEdge.Left);
        Assert.Equal(new int?[] { 6, 3 }, sides[0].Slots);
        Assert.Equal(new int?[] { 4, 5 }, sides[1].Slots);
    }

    [Fact]
    public void BookletFrontsOnlyAndBacksOnly()
    {
        var fronts = SheetLayout.Booklet(Pages(8), BindingEdge.Left, BookletSidesMode.Front);
        Assert.Equal(2, fronts.Count);
        Assert.Equal(new int?[] { 8, 1 }, fronts[0].Slots);
        Assert.Equal(new int?[] { 6, 3 }, fronts[1].Slots);
        Assert.Equal(new[] { 0, 1 }, fronts.Select(x => x.Sheet));
        var backs = SheetLayout.Booklet(Pages(8), BindingEdge.Left, BookletSidesMode.Back);
        Assert.Equal(new int?[] { 2, 7 }, backs[0].Slots);
        Assert.Equal(new int?[] { 4, 5 }, backs[1].Slots);
        Assert.All(backs, b => Assert.True(b.IsBack));
    }

    [Fact]
    public void BookletFrontOnlyIsOneSidedWithCopies()
    {
        var s = new PrintSettings { Layout = LayoutMode.Booklet, BookletSides = BookletSidesMode.Front, Copies = 2 };
        Assert.False(s.IsTwoSided);
        var sides = SheetLayout.Build(Pages(8), s);
        Assert.Equal(4, SheetLayout.WithCopies(sides, s).Count);
        Assert.Equal(2, SheetLayout.SheetsPerCopy(sides, s));
    }

    [Fact]
    public void BookletReversePrintsTheLastSheetFirst()
    {
        var s = new PrintSettings { Layout = LayoutMode.Booklet, Reverse = true };
        var sides = SheetLayout.Build(PageRangeParser.SelectPages(s, 8), s);
        Assert.Equal(new int?[] { 6, 3 }, sides[0].Slots);   // sheet 2 front, printed first
        Assert.Equal(new int?[] { 4, 5 }, sides[1].Slots);
        Assert.Equal(new int?[] { 8, 1 }, sides[2].Slots);
        Assert.Equal(0, sides[0].Sheet);
        Assert.Equal(new int?[] { 6, 3 }, SheetLayout.WithCopies(sides, s)[0].Slots);   // the order stays with copies
    }

    [Fact]
    public void FourUpPutsFourPagesPerSide()
    {
        var s = new PrintSettings { Layout = LayoutMode.PagesPerSheet, Columns = 2, Rows = 2 };
        var sides = SheetLayout.Build(Pages(10), s);
        Assert.Equal(3, sides.Count);
        Assert.Equal(new int?[] { 1, 2, 3, 4 }, sides[0].Slots);
        Assert.Equal(new int?[] { 9, 10, null, null }, sides[2].Slots);
        Assert.Equal(new[] { 0, 1, 2 }, sides.Select(x => x.Sheet));
    }

    [Fact]
    public void TwoSidedPairsSidesOnSheets()
    {
        var s = new PrintSettings { Sides = SidesMode.LongEdge };
        var sides = SheetLayout.Build(Pages(5), s);
        Assert.Equal(new[] { 0, 0, 1, 1, 2 }, sides.Select(x => x.Sheet));
        Assert.Equal(new[] { false, true, false, true, false }, sides.Select(x => x.IsBack));
        Assert.Equal(3, SheetLayout.SheetsPerCopy(sides, s));
    }

    [Fact]
    public void CopiesInTwoSidedStartOnNewSheet()
    {
        var s = new PrintSettings { Sides = SidesMode.LongEdge, Copies = 2 };
        var seq = SheetLayout.WithCopies(SheetLayout.Build(Pages(3), s), s);
        // copy 1: 1|2, 3|blank   copy 2: 1|2, 3 (last blank back left off)
        Assert.Equal(new int?[] { 1, 2, 3, null, 1, 2, 3 }, seq.Select(x => x.Slots[0]));
    }

    [Fact]
    public void CollateByPageRepeatsEachSheet()
    {
        var s = new PrintSettings { Copies = 3, Collate = CollateMode.ByPage };
        var seq = SheetLayout.WithCopies(SheetLayout.Build(Pages(2), s), s);
        Assert.Equal(new int?[] { 1, 1, 1, 2, 2, 2 }, seq.Select(x => x.Slots[0]));

        s = new PrintSettings { Copies = 2, Collate = CollateMode.ByDocument };
        seq = SheetLayout.WithCopies(SheetLayout.Build(Pages(2), s), s);
        Assert.Equal(new int?[] { 1, 2, 1, 2 }, seq.Select(x => x.Slots[0]));
    }

    [Fact]
    public void EstimateCountsSheets()
    {
        var booklet = new PrintSettings { Layout = LayoutMode.Booklet, Copies = 2 };
        var e = Estimator.ForItem(booklet, 120);
        Assert.Equal(30, e.SheetsPerCopy);
        Assert.Equal(60, e.Sheets);
        Assert.Equal(240, e.PagesPrinted);

        var duplex = new PrintSettings { Sides = SidesMode.LongEdge, Pages = PageSelection.Range, PageRange = "1-5" };
        Assert.Equal(3, Estimator.ForItem(duplex, 100).Sheets);

        var bad = new PrintSettings { Pages = PageSelection.Range, PageRange = "x" };
        Assert.NotNull(Estimator.ForItem(bad, 10).Error);
    }
}
