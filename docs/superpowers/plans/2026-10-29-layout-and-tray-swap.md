# Layout as in Sastra PDF, Swap trays — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Layout section reads like Sastra PDF's (three named layouts, the chosen one's settings boxed under it,
2/4/6/9/16 pages per sheet, booklet front / back only), and Print asks which tray to use when a file's tray is not
on its printer, remembering the answer.

**Architecture:** Engine (C#) gets `BookletSides`, two reversed N-up orders and "Reverse = sheets reversed" for
booklets; `app/model.js` gets the same `isTwoSided` rule, a virtual `PerSheet` path (Columns × Rows as one value) and
pure tray-swap helpers; the stand-in engine (`engine.js`) follows the engine; `app/app.js` changes the Layout section
fields and adds the Swap trays box in `printCmd`.

**Tech Stack:** Electron (plain JS, no bundler), node:test, C# .NET 8 + xUnit.

Spec: `docs/superpowers/specs/2026-10-29-layout-and-tray-swap-design.md`.

## Global Constraints
- Setting names and values stay compatible: old presets / `.svpv` without `BookletSides` read as `Both`; `Columns`,
  `Rows`, `Order` values `AcrossThenDown` / `DownThenAcross` keep their meaning.
- `model.js` DEFAULTS must stay in sync with `PrintSettings.cs` (comment says KEEP IN SYNC).
- Plain words in the window; the app's own boxes only (no Windows message boxes).
- Version 2.1.0 with a What's new entry (`scripts/check-notes.js` checks it).

---

### Task 1: Engine — booklet front / back, booklet reverse, reversed N-up orders

**Files:**
- Modify: `engine/src/Sievphov.Core/Models/PrintSettings.cs` (enums, `BookletSides`, `IsTwoSided`)
- Modify: `engine/src/Sievphov.Core/Services/SheetLayout.cs` (`Build`, `Booklet`)
- Modify: `engine/src/Sievphov.Core/Services/PageRangeParser.cs:87` (no page reverse for booklets)
- Modify: `engine/src/Sievphov.Core/Services/LayoutMath.cs:60` (reversed columns)
- Test: `engine/tests/Sievphov.Tests/SheetLayoutTests.cs`, `LayoutMathTests.cs`, `PageRangeTests.cs`

**Interfaces:**
- Produces: `enum BookletSidesMode { Both, Front, Back }`, `PrintSettings.BookletSides` (default `Both`),
  `NUpOrder.AcrossThenDownReversed`, `NUpOrder.DownThenAcrossReversed`,
  `SheetLayout.Booklet(IReadOnlyList<int> pages, BindingEdge binding, BookletSidesMode only = Both, bool reverse = false)`.

- [ ] **Step 1: failing tests**

```csharp
// SheetLayoutTests
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
    Assert.Equal(new int?[] { 6, 3 }, SheetLayout.WithCopies(sides, s)[0].Slots);   // order kept with copies
}

// LayoutMathTests
[Fact]
public void NUpReversedOrdersStartOnTheRight()
{
    var s = new PrintSettings { Layout = LayoutMode.PagesPerSheet, Columns = 2, Rows = 2, GapMm = 0, Order = NUpOrder.AcrossThenDownReversed };
    var a = LayoutMath.Slots(Box, s);
    Assert.Equal(new PointF(400, 0), a[0].Location);   // page 1 top right
    Assert.Equal(new PointF(0, 0), a[1].Location);
    Assert.Equal(new PointF(400, 500), a[2].Location);
    s.Order = NUpOrder.DownThenAcrossReversed;
    var d = LayoutMath.Slots(Box, s);
    Assert.Equal(new PointF(400, 0), d[0].Location);
    Assert.Equal(new PointF(400, 500), d[1].Location);   // page 2 below page 1
    Assert.Equal(new PointF(0, 0), d[2].Location);
}
```

(`Box` in LayoutMathTests is the existing 800 × 1000 test area; check its definition and adjust the points.)

- [ ] **Step 2:** `cd engine && dotnet test` → compile errors (no `BookletSidesMode`).

- [ ] **Step 3: implementation**

```csharp
// PrintSettings.cs
public enum NUpOrder { AcrossThenDown, DownThenAcross, AcrossThenDownReversed, DownThenAcrossReversed }
public enum BookletSidesMode { Both, Front, Back }
// after Binding:
/// <summary>Booklet: both sides, or only the fronts / only the backs (for printers that print one side).</summary>
public BookletSidesMode BookletSides { get; set; } = BookletSidesMode.Both;
[JsonIgnore]
public bool IsTwoSided => Layout == LayoutMode.Booklet ? BookletSides == BookletSidesMode.Both : Sides != SidesMode.OneSide;

// PageRangeParser.cs:87 — a booklet reverses its sheets instead (SheetLayout.Booklet)
if (settings.Reverse && settings.Layout != LayoutMode.Booklet) pages.Reverse();

// SheetLayout.Build
LayoutMode.Booklet => Booklet(pages, s.Binding, s.BookletSides, s.Reverse),

// SheetLayout.Booklet: sheets in printing order (Sheet = position printed, so WithCopies keeps the order)
public static List<SheetSide> Booklet(IReadOnlyList<int> pages, BindingEdge binding, BookletSidesMode only = BookletSidesMode.Both, bool reverse = false)
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
        if (binding == BindingEdge.Right) { Array.Reverse(front); Array.Reverse(back); }
        if (only != BookletSidesMode.Back) sides.Add(new SheetSide(k, false, front));
        if (only != BookletSidesMode.Front) sides.Add(new SheetSide(k, true, back));
    }
    return sides;
}

// LayoutMath.Slots
bool down = s.Order is NUpOrder.DownThenAcross or NUpOrder.DownThenAcrossReversed;
if (!down) { col = i % cols; row = i / cols; } else { row = i % rows; col = i / rows; }
if (s.Order is NUpOrder.AcrossThenDownReversed or NUpOrder.DownThenAcrossReversed) col = cols - 1 - col;
```

Also update the doc comment of `Booklet` and of `Reverse` in PrintSettings ("booklets: last sheet first").

- [ ] **Step 4:** `cd engine && dotnet test` → all pass.
- [ ] **Step 5:** commit "Engine: booklet front / back only, booklet Reverse = sheets, reversed N-up orders".

### Task 2: model.js — BookletSides, isTwoSided, PerSheet, tray swaps

**Files:** Modify `app/model.js`; Test `tests/model.test.js`.

**Interfaces (produces):**
- `DEFAULTS.BookletSides = 'Both'` (after `BookletGapMm`).
- `M.isTwoSided(s)`: Booklet → `s.BookletSides === 'Both'`; else `s.Sides !== 'OneSide'`.
- Virtual path `'PerSheet'`: `M.get(s,'PerSheet')` → `"2x2"`; `M.set(s,'PerSheet','3x2')` sets Columns 3, Rows 2.
- `M.PER_SHEET = [[2,'2x1'],[4,'2x2'],[6,'3x2'],[9,'3x3'],[16,'4x4']]`.
- `M.missingTrays(items, capsOf, defaultPrinter)` → `[{ printer, tray, trays, items }]` where `capsOf(name)` returns
  `{ trays, exists }` or null; only items with a `Tray`, an existing printer and a tray not in `trays`.
- `M.rememberedSwap(swaps, printer, from, trays)` → the remembered `To` when it is `''` or in `trays`, else `null`.
- `M.rememberSwap(swaps, printer, from, to)` → new array, one entry per Printer + From.

- [ ] **Step 1: failing tests**

```js
test('booklet front or back only prints one-sided; old files read as both sides', () => {
  assert.equal(M.normalize({ Layout: 'Booklet' }).BookletSides, 'Both');
  assert.equal(M.isTwoSided(M.normalize({ Layout: 'Booklet' })), true);
  assert.equal(M.isTwoSided(M.normalize({ Layout: 'Booklet', BookletSides: 'Front' })), false);
  assert.equal(M.isTwoSided(M.normalize({ Sides: 'LongEdge' })), true);
});

test('pages per sheet is Columns × Rows as one value', () => {
  const s = M.defaults();
  assert.equal(M.get(s, 'PerSheet'), '2x1');
  M.set(s, 'PerSheet', '3x2');
  assert.equal(s.Columns, 3); assert.equal(s.Rows, 2);
  const { lib, a } = twoPresets(), x = item(1);
  M.applyPreset([x], a);
  M.setField([x], 'PerSheet', '2x2', lib);
  assert.equal(x.settings.Columns, 2); assert.equal(x.settings.Rows, 2); assert.equal(x.modified, true);
  assert.equal(M.differsFromPreset([x], 'PerSheet', lib), true);
});

test('missing trays are grouped by printer and tray', () => {
  const caps = { 'HP 4303': { trays: ['Tray 1', 'Tray 2', 'Tray 3'], exists: true }, 'HP M507': { trays: ['Tray 1', 'Tray 2'], exists: true }, 'Gone': { trays: [], exists: false } };
  const capsOf = n => caps[n] || null;
  const it = (n, PrinterName, Tray) => item(n, { settings: M.normalize({ PrinterName, Tray }) });
  const list = [it(1, 'HP M507', 'Tray 3'), it(2, 'HP M507', 'Tray 3'), it(3, 'HP 4303', 'Tray 3'), it(4, '', 'Tray 3'), it(5, 'Gone', 'Tray 3'), it(6, 'HP M507', '')];
  const g = M.missingTrays(list, capsOf, 'HP M507');
  assert.equal(g.length, 1);
  assert.deepEqual([g[0].printer, g[0].tray, g[0].items.map(x => x.id)], ['HP M507', 'Tray 3', ['f1', 'f2', 'f4']]);
  assert.deepEqual(g[0].trays, ['Tray 1', 'Tray 2']);
});

test('remembered tray swaps', () => {
  let sw = M.rememberSwap([], 'HP M507', 'Tray 3', 'Tray 2');
  sw = M.rememberSwap(sw, 'HP M507', 'Tray 3', 'Tray 1');
  assert.equal(sw.length, 1);
  assert.equal(M.rememberedSwap(sw, 'HP M507', 'Tray 3', ['Tray 1', 'Tray 2']), 'Tray 1');
  assert.equal(M.rememberedSwap(sw, 'HP M507', 'Tray 3', ['Tray 2']), null, 'the tray is gone');
  assert.equal(M.rememberedSwap(M.rememberSwap([], 'P', 'T', ''), 'P', 'T', []), '', 'As in printer');
  assert.equal(M.rememberedSwap(sw, 'Other', 'Tray 3', ['Tray 1']), null);
});
```

- [ ] **Step 2:** `pnpm test` → the four fail.
- [ ] **Step 3: implementation**

```js
// DEFAULTS: … Binding: 'Left', BookletGapMm: 10, BookletSides: 'Both',
// get / set: a few settings shown as one value
const VIRTUAL = {
  PerSheet: { get: s => `${s.Columns}x${s.Rows}`, set: (s, v) => { const [c, r] = String(v).split('x').map(Number); if (c >= 1 && r >= 1) { s.Columns = c; s.Rows = r; } } }
};
const get = (s, p) => VIRTUAL[p] ? VIRTUAL[p].get(s) : p.split('.').reduce(…);
function set(s, p, v) { if (VIRTUAL[p]) { VIRTUAL[p].set(s, v); return; } … }
const PER_SHEET = Object.freeze([[2, '2x1'], [4, '2x2'], [6, '3x2'], [9, '3x3'], [16, '4x4']]);
const isTwoSided = s => s.Layout === 'Booklet' ? s.BookletSides === 'Both' : s.Sides !== 'OneSide';

function missingTrays(items, capsOf, defaultPrinter) {
  const groups = new Map();
  for (const it of items) {
    const tray = it.settings.Tray, printer = it.settings.PrinterName || defaultPrinter;
    if (!tray || !printer) continue;
    const caps = capsOf(printer);
    if (!caps || !caps.exists || caps.trays.includes(tray)) continue;
    const key = printer + '\u0000' + tray;
    if (!groups.has(key)) groups.set(key, { printer, tray, trays: caps.trays.slice(), items: [] });
    groups.get(key).items.push(it);
  }
  return [...groups.values()];
}
function rememberedSwap(swaps, printer, from, trays) {
  const m = (swaps || []).find(x => x.Printer === printer && x.From === from);
  return m && (m.To === '' || trays.includes(m.To)) ? m.To : null;
}
const rememberSwap = (swaps, printer, from, to) =>
  [...(swaps || []).filter(x => !(x.Printer === printer && x.From === from)), { Printer: printer, From: from, To: to }];
```
Export `PER_SHEET, missingTrays, rememberedSwap, rememberSwap`.

- [ ] **Step 4:** `pnpm test` → pass. **Step 5:** commit "Rules: booklet sides, pages per sheet, tray swaps".

### Task 3: PrintSettings.cs ↔ model.js and the stand-in engine

**Files:** Modify `engine.js` (`fakePages`, `fakeSides`, `fakePreview` cell order); Test `tests/engine.test.js`.

- [ ] **Step 1: failing test** (in `tests/engine.test.js`, using `_fake`):

```js
test('stand-in: booklet fronts only, reverse = sheets, reversed order', () => {
  const s = { Layout: 'Booklet', Binding: 'Left', BookletSides: 'Front', Sides: 'ShortEdge' };
  const r = _fake.fakeSides(s, _fake.fakePages(s, 8));
  assert.equal(r.twoSided, false);
  assert.deepEqual(r.sides.map(x => x.slots), [[8, 1], [6, 3]]);
  const rev = { Layout: 'Booklet', Binding: 'Left', BookletSides: 'Both', Reverse: true };
  assert.deepEqual(_fake.fakeSides(rev, _fake.fakePages(rev, 8)).sides.map(x => x.slots), [[6, 3], [4, 5], [8, 1], [2, 7]]);
  assert.equal(_fake.fakeEstimate({ ...s, Copies: 2 }, 8).sheets, 4);
});
```

- [ ] **Step 3: implementation** — `fakePages`: `if (s.Reverse && s.Layout !== 'Booklet') pages.reverse();`.
  `fakeSides` booklet: `twoSided = (s.BookletSides || 'Both') === 'Both'`; loop `k` over sheets, `sh = s.Reverse ?
  count-1-k : k`, push front unless `Back`, back unless `Front`, `sheet: k`. `fakePreview`: cell position
  `c`/`r` from `s.Order` (down orders: `r = k % rows, c = floor(k / rows)`; reversed: `c = cols-1-c`).
- [ ] **Step 4:** `pnpm test` pass. **Step 5:** commit "Stand-in engine follows the booklet and order rules".

### Task 4: Layout section as in Sastra PDF

**Files:** Modify `app/app.js` (SECTIONS `paper` and `layout`, `sidesText`, `sidesNote`, ICONS), maybe `app/app.css`.

- Paper section: remove `Fit`, `ZoomPercent`, `Alignment`; `Sides` gets `show: s => s.Layout !== 'Booklet'`.
- Layout section:

```js
{ path: 'Layout', kind: 'big', label: 'Layout', opts: () => [
  { v: 'Normal', t: 'One page per sheet', s: 'Fit, actual size or your own zoom', ic: 'normal' },
  { v: 'PagesPerSheet', t: 'Multiple pages per sheet', s: '2, 4, 6, 9 or 16 on each side', ic: 'nup' },
  { v: 'Booklet', t: 'Booklet', s: 'Folded sheets, pages in reading order', ic: 'booklet' }] },
{ group: 'lay', show: yes, fields: [
  { path: 'PerSheet', kind: 'select', label: 'Pages per sheet', show: s => s.Layout === 'PagesPerSheet', opts: (ctx, s) => perSheetOpts(s) },
  { path: 'Order', kind: 'select', label: 'Page order', show: s => s.Layout === 'PagesPerSheet', opts: () => [
    { v: 'AcrossThenDown', t: 'Horizontal' }, { v: 'AcrossThenDownReversed', t: 'Horizontal reversed' },
    { v: 'DownThenAcross', t: 'Vertical' }, { v: 'DownThenAcrossReversed', t: 'Vertical reversed' }] },
  { path: 'BookletSides', kind: 'select', label: 'Print', show: s => s.Layout === 'Booklet', note: s => bookletNote(s), opts: () => [
    { v: 'Both', t: 'Both sides' }, { v: 'Front', t: 'Front side only' }, { v: 'Back', t: 'Back side only' }] },
  { path: 'Binding', kind: 'seg', …as now, show: booklet },
  { path: 'Fit', kind: 'select', label: 'Size on the paper', …as now },
  { path: 'ZoomPercent', … show: s => s.Fit === 'Zoom' },
  { path: 'Alignment', … show: s => s.Layout !== 'Booklet' },
  { row: [Gap (mm), Print page border], show: nup }   // rows need `show` → wrap in a group with show
  { path: 'BookletGapMm', show: booklet },
  { hint for booklet } ] }
```
  `addFields` rows / hints get `show` support (row: `bound.push` hide like groups; hint: same).
  `perSheetOpts(s)`: `M.PER_SHEET` → `{ v:'2x1', t:'2' }…`, plus `{ v: 'CxR', t: 'C × R (custom)' }` when not listed.
  `bookletNote(s)`: Both on a printer that can't duplex → "This printer cannot print on both sides: print Front
  side only, put the stack back in the tray, then Back side only."; Front → "Then put the printed stack back in the
  tray and print Back side only."; else ''.
  Hint: "Fold the printed stack in half to make the booklet. If the printer can't print on both sides, print Front
  side only, put the stack back in the tray, then print Back side only. Reverse order prints the last sheet first."
- `sidesText`: Booklet → 'Booklet' / 'Booklet · fronts' / 'Booklet · backs'; `sidesNote` drops the booklet line.
- `describe()` of presets, Manage presets use the same SECTIONS: check they still render.
- Check: `pnpm run test:ui` passes; look at screenshots of the panel for each layout.
- Commit "Layout section as in Sastra PDF".

### Task 5: Swap trays on Print

**Files:** Modify `app/app.js` (`state.settings.TraySwaps`, `capsAsync`, `swapTraysBox`, `printCmd`), `app/app.css`
(table in the box).

```js
/** A printer's caps, waiting for the engine when they are not cached. */
async function capsAsync(name) {
  const key = name || defaultPrinter();
  if (!key) return null;
  if (!state.caps.has(key)) { capsFor(key); await capsWaiting.get(key); }
  return state.caps.get(key) || null;
}
/** Files whose tray is not on their printer: remembered swaps are applied; the rest are asked. → [{printer, from, to, n}] made, or null = cancelled. */
async function swapTrays(list, { ask = false } = {}) {
  const printers = [...new Set(list.map(it => it.settings.PrinterName || defaultPrinter()).filter(Boolean))];
  for (const p of printers) await capsAsync(p);
  const groups = M.missingTrays(list, n => state.caps.get(n) || null, defaultPrinter());
  …for each group: to = M.rememberedSwap(state.settings.TraySwaps, g.printer, g.tray, g.trays)
  …if any to == null (or ask): open the box; Cancel → null
  …apply: for (const it of g.items) it.settings.Tray = to; M.markModified(it, state.lib); state.jobDirty = true;
  …remember when ticked: state.settings.TraySwaps = M.rememberSwap(...); saveSettings();
  return made;
}
```
- Box (`openBox('wide')`): h2 "Swap trays", detail "These files print on a printer that does not have their tray.
  Pick the tray to use instead.", table Printer · Their tray · Use this tray · Files, `<select>` per row (printer's
  trays + "As in printer"), tick "Remember for next time" (checked), Cancel / Continue.
- `printCmd`: after `runEstimate()`: `const swaps = await swapTrays(list); if (!swaps) return;` → `refresh()`.
  Swaps made without asking are listed in the print question (`html`: "Tray swaps: Tray 3 → Tray 2 on HP M507 (3
  files)") and the buttons are Cancel / Change trays… / Print; Change trays… = `swapTrays(list-with-original-trays,
  { ask: true })` then ask again. To allow that, `swapTrays` returns the groups with their original tray, and Change
  trays… first puts the original trays back on those files (kept in the returned groups).
- UI test: fake HP LaserJet Pro 4303 file with Tray 3 sent to HP LaserJet M507 → the box shows, Continue sets Tray.
- Commit "Swap trays: ask which tray when a file's tray is not on its printer".

### Task 6: Version, What's new, README, UI test

- `package.json` version 2.1.0; `app/notes.js` N('2.1.0', '2026-10-29', …) new: Swap trays; improved: Layout as in
  Sastra PDF; new: booklet front / back only; improved: booklet Reverse; README table rows (Layout, Swap trays).
- `tests/ui/run.js`: screenshots of the layout boxes and the Swap trays box.
- `pnpm test`, `cd engine && dotnet test`, `pnpm run test:ui` all pass. Commit "2.1.0: What's new, README".
