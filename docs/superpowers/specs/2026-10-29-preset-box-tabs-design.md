# Manage presets: sample on top, settings in tabs: design

Date: 2026-10-29 · Status: approved by the user in chat ("ok")

The user: "it difficult to use for layout, polish the preset management". Asked what is hard, they picked all four:
Layout is buried (one long list), the sample is too small, the box is too crowded (three columns), and the sample is
far from the controls.

## Shape

Two columns instead of three (`.modal.presets` grid: `240px minmax(0,1fr)`; rows: head, body, actions).

- **Left:** the preset list and its tools, unchanged except the width (260 → 240 px).
- **Right** (`.pmain`, a flex column):
  1. **Name row** (`.pname`), as now.
  2. **Sample paper strip** (`.psample`): the head ("Sample paper" + "8 pages → N sheets, both sides") and the
     sheets in **one row** (`.ps-body`: `flex-direction:row`, `overflow-x:auto`, no wrap). Each sheet is a figure
     with its sides (front and back side by side for two-sided) and its caption, as now. Side height 220 px
     (was 150). Pasteboard background, line under it.
  3. **Tab bar** (`.ptabs`, `role="tablist"`): one button per settings section — Printer & pages, Paper & tray,
     Layout, Page numbers, Watermark, Logo — with the section icon. Sections with an on/off switch (Page numbers,
     Watermark, Logo) show a small accent dot on the tab when switched on.
  4. **Tab body** (`.pedit`): only the chosen section, scrolls on its own (`overflow:auto`, `flex:1`,
     `min-height:0`). The section's own fold header is hidden in tab mode.
- The box opens on the **Layout** tab the first time; the last tab used is remembered in `localStorage`
  (`sievphov-preset-tab`, read and written with the existing `lsGet` / `lsSet`, so it fails quietly).
- Changing a setting redraws the sample (as now, after 300 ms).

## Short screens

`@media (max-height:820px)`: side height 150 px. `@media (max-height:680px)`: side height 110 px. The tab body keeps
at least 200 px (`min-height:200px`). The width media query for three columns (1180 px) goes away.

## Code

- `buildEditor(root, ctx, { sections, folded, tabs })`: new option `tabs` (default `false`). When `true`:
  - builds the tab bar in `tabs.bar` (an element the caller gives) and puts the sections in `root` as now;
  - shows only the chosen section (`hidden` on the others), adds the class `tabbed` to each section so CSS hides its
    `h3`;
  - the `on` sync also toggles the dot on the tab (`.ptab .dot`, `hidden`);
  - tab buttons: `role="tab"`, `aria-selected`, `data-sec`; Left / Right arrow keys move between tabs.
  - `tabs.key` names the `localStorage` key; `tabs.first` the default section (`'layout'`).
- The side panel in the main window calls `buildEditor` as before (no `tabs`), so it does not change.
- `openPresetManager`: new markup (`.pmain` holding name, sample, tab bar, tab body); `drawEditor` passes
  `{ folded: false, tabs: { bar, key: 'sievphov-preset-tab', first: 'layout' } }`. The tab stays the same when another
  preset is picked.
- CSS: replace the three-column rules and the 1180 px media query; add `.pmain`, `.ptabs`, `.ptab`, `.ptab .dot`,
  `.tsec.tabbed>h3{display:none}`, row layout for `.ps-body`.

## Not changed

Preset buttons (New, Duplicate, Default, Move up / down, Delete, Import, Export), Save / Cancel, the drawing of the
sample (`drawSample`), the main window's settings panel.

## Tests

- `tests/ui/run.js` (Manage presets part): the box opens on the Layout tab; clicking the Paper & tray tab shows that
  section and hides Layout; the sample still reads "8 pages → 2 sheets, both sides" for the booklet preset and
  "8 pages → 1 sheet, both sides" after picking 4 per sheet; the Watermark tab shows its dot when the preset has a
  watermark switched on; screenshots 06 / 06a.
- The window test is run only with the user's OK. `pnpm test` (node) must still pass.
