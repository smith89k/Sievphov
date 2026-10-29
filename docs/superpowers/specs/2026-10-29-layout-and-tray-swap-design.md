# Layout as in Sastra PDF; Swap trays: design

Date: 2026-10-29 · Status: approved by the user in chat ("ok")

The user: "in layout selection should be the sastra pdf, it easy to understand" and "when print different printer
from preset, i need function ask for swap tray. each printer have different tray."

## 1. Layout, as in Sastra PDF's print screen

### Panel (Layout section)
- The Layout big dropdown names Sastra's choices: **One page per sheet** (`Normal`), **Multiple pages per sheet**
  (`PagesPerSheet`), **Booklet** (`Booklet`). Setting values stay the same, so presets and `.svpv` jobs keep working.
- Under it, one box (Sastra's `.pr-box`: line, 8 px radius, chrome background) with only the chosen layout's settings:
  - **One page per sheet**: Size on the paper (`Fit`), Zoom % (when `Fit` = `Zoom`), Position (`Alignment`).
  - **Multiple pages per sheet**:
    - **Pages per sheet** select: 2, 4, 6, 9, 16 → `Columns × Rows` = 2×1, 2×2, 3×2, 3×3, 4×4 (Auto orientation
      already turns the sheet for 2 and 6). A grid not in the list (e.g. 3×1 from an old preset) shows as an extra
      option "3 × 1 (custom)" and stays until another number is picked.
    - **Page order** select: Horizontal (`AcrossThenDown`), Horizontal reversed (`AcrossThenDownReversed`), Vertical
      (`DownThenAcross`), Vertical reversed (`DownThenAcrossReversed`). Reversed = columns from the right.
    - Gap (mm) and **Print page border** (`Borders`).
  - **Booklet**:
    - **Print** select: Both sides / Front side only / Back side only (`BookletSides` = `Both` | `Front` | `Back`).
    - Binding (left / right) and Gap at the fold (mm), as now.
    - Hint: "Fold the printed stack in half to make the booklet. If the printer can't print on both sides, print
      Front side only, put the stack back in the tray, then print Back side only."
    - When the printer cannot print on both sides and Print is Both sides, the box says so and points to front /
      back only (instead of the Sides note).
- `Fit` / `ZoomPercent` still apply in every layout in the engine; only the panel moves them into the box. For
  Multiple and Booklet the box shows Size on the paper too, so nothing that affects printing is hidden. Position shows
  for One page and Multiple (as now: hidden for Booklet).
- **Sides** hides for Booklet (the booklet decides: short edge for Both, one side for Front / Back).
- File list Sides column: "Booklet", "Booklet · fronts", "Booklet · backs".

### Engine and model
- `PrintSettings.BookletSides` (enum `BookletSidesMode { Both, Front, Back }`, default `Both`); `NUpOrder` gets
  `AcrossThenDownReversed`, `DownThenAcrossReversed`. `model.js` DEFAULTS gets `BookletSides: 'Both'` (KEEP IN SYNC).
- `IsTwoSided` (C# and `M.isTwoSided`): Booklet → `BookletSides == Both`; else `Sides != OneSide`.
- `SheetLayout.Booklet`: Front / Back keep only that side of each sheet, as one-sided sheets in sheet order (sheet 1
  first), so copies, estimate, preview and printing follow without other changes. Printing uses simplex for them.
- **Reverse order with a booklet** reverses the sheets (last sheet first), as in Sastra PDF, instead of reversing the
  pages (which only swapped left and right). Other layouts unchanged.
- `LayoutMath.Slots`: reversed orders mirror the column (`col = cols - 1 - col`).
- The stand-in engine (`engine.js`) follows the same rules for tests.
- Choosing Booklet still sets Sides = ShortEdge and Orientation = Landscape (unchanged).

## 2. Swap trays

- On **Print**, after the estimate and before the print question: for every ticked item with a `Tray`, get its
  printer's caps (actual printer: `PrinterName` or the default printer; wait for caps when not cached). A tray is
  **missing** when the printer exists and its `trays` do not include `Tray`. Printers that don't exist are left to
  the error they already give.
- Missing trays are grouped by (printer, tray). For each group with a remembered swap whose target is still on that
  printer (or is "As in printer"), the swap is applied without asking.
- If any group has no remembered answer, the **Swap trays** box opens (app's own box, `wide`):
  "These files print on a printer that does not have their tray. Pick the tray to use instead."
  One row per group: printer · their tray · files (count, names in the tooltip) · dropdown with that printer's trays
  and "As in printer" (pre-picked: the remembered answer, else As in printer). Tick **Remember for next time**
  (on). Cancel = nothing prints; **Continue** applies and goes on to the print question.
- Applying = `settings.Tray = to` on each file of the group, then `M.markModified` (the file shows `*` when it now
  differs from its preset), the job is marked changed, the list redraws.
- Remembered swaps: `settings.json` `TraySwaps: [{ Printer, From, To }]` (one per Printer + From; a new answer
  replaces the old one).
- The print question lists swaps made by themselves: "Tray 3 → Tray 2 on HP LaserJet M507 (3 files)", with a
  **Change trays…** button that opens the Swap trays box for those groups (the change is applied and remembered as
  above) and then asks the print question again.
- Pure parts in `model.js` with node tests: `missingTrays(items, capsOf, defaultPrinter)` → groups,
  `rememberedSwap(swaps, printer, from, trays)`, `rememberSwap(swaps, printer, from, to)`.

## Testing
- `dotnet test`: booklet Front / Back sides and copies, booklet Reverse = sheets reversed, reversed N-up slots,
  `IsTwoSided`.
- `pnpm test`: pages-per-sheet mapping, `isTwoSided` with `BookletSides`, `missingTrays`, remembered swaps, normalize
  of old settings (no `BookletSides` → `Both`).
- `pnpm run test:ui`: screenshots of the three layout boxes and the Swap trays box (fake engine: HP 4303 Tray 3 sent
  to HP M507).
- What's new: an entry for the next version (2.1.0).

## Out of scope
Poster layout; asking about trays when the printer is changed in the panel; a separate screen to manage remembered
swaps.
