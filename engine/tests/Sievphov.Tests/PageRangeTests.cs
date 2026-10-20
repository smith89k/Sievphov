using Sievphov.Models;
using Sievphov.Services;

namespace Sievphov.Tests;

public class PageRangeTests
{
    [Theory]
    [InlineData("1,3,5", 10, new[] { 1, 3, 5 })]
    [InlineData("1-5, 8", 10, new[] { 1, 2, 3, 4, 5, 8 })]
    [InlineData("1-3,20-22", 21, new[] { 1, 2, 3, 20, 21 })]
    [InlineData("last", 7, new[] { 7 })]
    [InlineData("5-last", 7, new[] { 5, 6, 7 })]
    [InlineData("odd", 5, new[] { 1, 3, 5 })]
    [InlineData("even", 5, new[] { 2, 4 })]
    [InlineData("3-1", 5, new[] { 3, 2, 1 })]
    [InlineData(" 2 ; 4 ", 5, new[] { 2, 4 })]
    [InlineData("12", 5, new int[0])]
    [InlineData("", 3, new[] { 1, 2, 3 })]
    public void Parses(string text, int count, int[] expected)
    {
        Assert.Equal(expected, PageRangeParser.Parse(text, count));
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("0")]
    [InlineData("1-")]
    [InlineData("-3")]
    [InlineData("1-x")]
    public void RejectsBadText(string text)
    {
        Assert.Throws<FormatException>(() => PageRangeParser.Parse(text, 10));
        Assert.False(PageRangeParser.IsValid(text, out var error));
        Assert.NotNull(error);
    }

    [Fact]
    public void SelectPagesHonorsModeAndReverse()
    {
        var s = new PrintSettings { Pages = PageSelection.Odd, Reverse = true };
        Assert.Equal(new[] { 5, 3, 1 }, PageRangeParser.SelectPages(s, 6));

        s = new PrintSettings { Pages = PageSelection.Range, PageRange = "2-4" };
        Assert.Equal(new[] { 2, 3, 4 }, PageRangeParser.SelectPages(s, 6));
    }
}
