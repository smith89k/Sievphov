using Sievphov.Models;

namespace Sievphov.Services;

/// <summary>One side of one sheet of paper.</summary>
/// <param name="Sheet">0-based sheet number within one copy.</param>
/// <param name="IsBack">True for the back side.</param>
/// <param name="Slots">1-based PDF page in each place on the side (left to right for booklets); null = empty.</param>
public sealed record SheetSide(int Sheet, bool IsBack, int?[] Slots)
{
    public bool IsBlank => Slots.All(s => s is null);

    public static SheetSide Blank(int sheet, bool isBack, int slots) => new(sheet, isBack, new int?[slots]);
}

public static class SheetLayout
{
    /// <summary>Puts the selected pages onto sheet sides (one copy).</summary>
    public static List<SheetSide> Build(IReadOnlyList<int> pages, PrintSettings s)
    {
        return s.Layout switch
        {
            LayoutMode.Booklet => Booklet(pages, s.Binding, s.BookletSides, s.Reverse),
            LayoutMode.PagesPerSheet => Chunked(pages, s.SlotsPerSide, s.IsTwoSided),
            _ => Chunked(pages, 1, s.IsTwoSided),
        };
    }

    private static List<SheetSide> Chunked(IReadOnlyList<int> pages, int perSide, bool twoSided)
    {
        var sides = new List<SheetSide>();
        for (int i = 0, side = 0; i < pages.Count; i += perSide, side++)
        {
            var slots = new int?[perSide];
            for (int k = 0; k < perSide && i + k < pages.Count; k++) slots[k] = pages[i + k];
            sides.Add(twoSided ? new SheetSide(side / 2, side % 2 == 1, slots) : new SheetSide(side, false, slots));
        }
        return sides;
    }

    /// <summary>
    /// Booklet order: pad to a multiple of 4 (N). Sheet s front = [N−2s, 2s+1], back = [2s+2, N−2s−1]
    /// (left, right), for left binding. Right binding swaps left and right. <paramref name="only"/> keeps only the
    /// fronts or only the backs (printed one-sided); <paramref name="reverse"/> prints the last sheet first.
    /// Sheet numbers follow the printing order, so copies keep it.
    /// </summary>
    public static List<SheetSide> Booklet(IReadOnlyList<int> pages, BindingEdge binding,
        BookletSidesMode only = BookletSidesMode.Both, bool reverse = false)
    {
        var sides = new List<SheetSide>();
        if (pages.Count == 0) return sides;
        int n = (pages.Count + 3) / 4 * 4, count = n / 4;
        int? At(int pos) => pos <= pages.Count ? pages[pos - 1] : null;

        for (int k = 0; k < count; k++)
        {
            int s = reverse ? count - 1 - k : k;
            var front = new[] { At(n - 2 * s), At(2 * s + 1) };
            var back = new[] { At(2 * s + 2), At(n - 2 * s - 1) };
            if (binding == BindingEdge.Right)
            {
                Array.Reverse(front);
                Array.Reverse(back);
            }
            if (only != BookletSidesMode.Back) sides.Add(new SheetSide(k, false, front));
            if (only != BookletSidesMode.Front) sides.Add(new SheetSide(k, true, back));
        }
        return sides;
    }

    /// <summary>
    /// The full list of sides sent to the printer, with copies. In two-sided printing every copy
    /// starts on a new sheet (a blank back is added when a copy ends on a front).
    /// </summary>
    public static List<SheetSide> WithCopies(IReadOnlyList<SheetSide> sides, PrintSettings s)
    {
        int copies = Math.Max(1, s.Copies);
        int slots = s.SlotsPerSide;
        var result = new List<SheetSide>();
        if (sides.Count == 0) return result;

        if (!s.IsTwoSided)
        {
            if (s.Collate == CollateMode.ByDocument)
                for (int c = 0; c < copies; c++) result.AddRange(sides);
            else
                foreach (var side in sides)
                    for (int c = 0; c < copies; c++) result.Add(side);
            return result;
        }

        var sheets = sides.GroupBy(x => x.Sheet).OrderBy(g => g.Key)
            .Select(g =>
            {
                var front = g.FirstOrDefault(x => !x.IsBack) ?? SheetSide.Blank(g.Key, false, slots);
                var back = g.FirstOrDefault(x => x.IsBack) ?? SheetSide.Blank(g.Key, true, slots);
                return new[] { front, back };
            })
            .ToList();

        if (s.Collate == CollateMode.ByDocument)
        {
            for (int c = 0; c < copies; c++)
                foreach (var sheet in sheets)
                {
                    result.Add(sheet[0]);
                    // The last back side of the last copy can be left off when it is empty.
                    bool lastSide = c == copies - 1 && sheet == sheets[^1];
                    if (!(lastSide && sheet[1].IsBlank)) result.Add(sheet[1]);
                }
        }
        else
        {
            foreach (var sheet in sheets)
                for (int c = 0; c < copies; c++)
                {
                    result.Add(sheet[0]);
                    bool lastSide = c == copies - 1 && sheet == sheets[^1];
                    if (!(lastSide && sheet[1].IsBlank)) result.Add(sheet[1]);
                }
        }
        return result;
    }

    /// <summary>Sheets of paper one copy uses.</summary>
    public static int SheetsPerCopy(IReadOnlyList<SheetSide> sides, PrintSettings s) =>
        s.IsTwoSided ? sides.Select(x => x.Sheet).Distinct().Count() : sides.Count;
}
