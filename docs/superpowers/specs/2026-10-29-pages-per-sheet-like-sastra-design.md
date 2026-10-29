# Pages per sheet like Sastra PDF; Manage presets like Sastra's print screen: design

Date: 2026-10-29 · Status: approved by the user in chat ("ok")

The user: "multiple page per sheet preview, should be the same function like sastra pdf". Asked what, they picked all
of: one big sheet with Previous / Next and zoom, see each page's edge, the main Preview window, pages look wrong.
For the box shape they picked "Like Sastra": preset drop-down on top, settings left, one big sheet right.
Replaces the "sample on top" shape of `2026-10-29-preset-box-tabs-design.md` (the tabs stay).

## 1. Placing pages (engine, stand-in engine) — as Sastra's `planMultiple`

- **The grid turns with the sheet.** From `Columns × Rows` take a = the smaller, b = the larger. Upright sheet:
  a columns × b rows; landscape sheet: b columns × a rows (Sastra's `GRIDS` 2:[1,2] 4:[2,2] 6:[2,3] 9:[3,3] 16:[4,4]).
  `LayoutMath.Grid(s, landscape)`; `Slots` takes landscape from the area's shape.
- **Auto orientation:** the way round whose cells show the first page larger (gap counted); upright when equal.
- **Pages are never turned** in Pages per sheet (`ShouldRotate` → false). Other layouts unchanged.
- **Print page border** is drawn round each page itself (as Sastra), not round its cell.
- Upright pages come out as before (2 and 6 → landscape; 4, 9, 16 → upright). Wide pages now: 2 → stacked on an
  upright sheet; 6 → landscape 3 × 2 without turning.
- Stand-in engine (`engine.js`) and the app's sheet-shape guess use the same rule from `app/model.js`:
  `M.nUpGrid(s, landscape)` → `[cols, rows]`, `M.sheetLandscape(s, firstPage)` (page in points, A4 sheet).

## 2. Page edges in previews

Preview only (like the dashed printable edge): in Pages per sheet, a thin grey line round each page when Print page
border is off. `SheetRenderer.PageEdges` (set by `Program.Preview`, never when printing). Stand-in engine draws the
same. Main Preview window and the sample both get it.

## 3. Manage presets like Sastra's print screen

- **Top bar** (under the title): Preset drop-down (name; "· Default"; "Ctrl+N"), New preset, then the icon buttons
  Duplicate, Make default, Move up, Move down, Delete, then Import…, Export…. The list column is gone.
- **Left column** (400 px): name field, tab bar, the chosen section (as now; opens on Layout, remembers the tab).
- **Right** (pasteboard): head "Sample paper" + summary ("8 pages → 2 sheets, both sides") + a two-button switch
  **Upright pages / Wide pages** (A4 595 × 842 or 842 × 595, remembered in `sievphov-sample-wide`). Stage: one side,
  fitted to the space, scrolls when zoomed. Bottom row: ‹ "Sheet 1 of 2 · front" › · "pages 1 | 2 | 3 | 4" ·
  zoom − / Fit / + (Fit, then 150 / 200 / 300 %). ← / → keys turn sides when focus is not in a field.
- The side shown stays (clamped) when settings change; it goes back to the first when another preset is picked.
- The main window's settings panel is unchanged.

## Tests

- xUnit: `Grid`, Slots on a landscape area, Auto orientation for wide pages (2-up upright, 6-up landscape), no turning
  in Pages per sheet.
- node: `M.nUpGrid`, `M.sheetLandscape`; stand-in `slotCell` with the turned grid; `sample({ wide })`.
- Window test: the Manage presets part rewritten for the drop-down and the sheet navigation (run only with the
  user's OK).
