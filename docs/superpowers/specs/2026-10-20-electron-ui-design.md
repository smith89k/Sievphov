# Electron UI, like Bohpum and Sastra PDF: design

Date: 2026-10-20 · Status: approach approved by the user in chat ("Electron, like the others"; accent "Purple, from the logo")

## Goal
The WPF window looked old next to the user's other apps. Sievphov becomes an Electron app with the same look and
habits as Bohpum and Sastra PDF; printing keeps the C# engine, which can choose trays and is already checked on Windows.

## What stays, what moves
- **C# engine** (`engine/`): `Sievphov.Core` (settings, page ranges, booklet / N-up order, estimates, PDF reading with
  PDFium) and `Sievphov.Engine`, a console helper replacing the WPF app. It keeps the sheet drawing, Khmer text
  stamps (WPF text engine), per-file printer / tray / paper / sides / colour and the self-test.
- **Electron** (root): `main.js` (window, title bar, ☰ menu, dialogs, files, the engine process), `preload.js`
  (`window.sievphov`), `app/` (the screens). Presets, job files (`.svpv`, same JSON as before), app settings and the
  report CSV are handled in JS. Preset sync (apply / `*` / edit follows) moves to `app/model.js` with node tests.
- Removed: the WPF windows, `FileAssociation.cs` (electron-builder's file association does it), C# `PresetSync` and
  `Storage` (JS owns those files now).

## Engine protocol
One JSON object per line on stdin / stdout. Request `{ id, cmd, ... }` → reply `{ id, ok: true, result }` or
`{ id, ok: false, error }`; while printing, events `{ event: "progress" | "item" | "done", ... }`.
- `printers` → `[{ name, isDefault }]`; `caps { name }` → `{ papers, trays, canDuplex, color, exists }`
- `open { path, passwords }` → `{ pageCount, pageSizes, password }` or error with `reason` = `password` | `damaged` | …
- `estimate { items: [{ settings, pageCount }] }` → per item `{ pagesPrinted, sheets, error }` (page-range errors here)
- `preview { item, side, maxPx }` → `{ png (base64), sides, label, sheetW, sheetH }`
- `print { items, after }` → events per side / file, then `done` with the report rows; `pause`, `resume`, `stop`
- `Sievphov.Engine.exe --selftest <folder>`: as before (prints sample books to Microsoft Print to PDF).

## Look (as Bohpum / Sastra PDF)
- Tokens of Sastra PDF (warm neutral chrome, `--panel`, `--line`, …), IBM Plex Sans / Mono + Noto Sans Khmer shipped
  in `app/fonts`, light / dark / system theme (button in the title row, ☰ › View › Theme).
- Accent purple from the logo: light `#6a3fd8` on white text (≈ 6.2 : 1), dark theme `#a58bff` with near-black text.
- Title row = window title bar (`titleBarStyle: 'hidden'` + overlay, 45 px): ☰, brand (logo · Sievphov · សៀវភៅ,
  opens About), Add files, Add folder, Open job, Save job ▾, | Remove, ▲ ▼ | Preview, Estimate, spacer, Theme.
- Work area: the **file list** (table with tick, #, file, pages, preset chip with `*`, printer, tray, sides, copies,
  status pill; sort by column header, drag rows to reorder, Ctrl / Shift click, Ctrl+A) and an empty state
  "Drop PDF files or folders here".
- Right panel (Sastra's Tools panel style, folding sections): **Presets** (preset big dropdown, Apply to selected,
  Save as preset, Manage presets…), **File settings** for the selected file(s) in Bohpum's print-screen style (big
  dropdowns: Printer, Pages, Paper, **Tray**, Sides, Layout, Fit, Color, Quality; Copies), **Page numbers**,
  **Watermark**, **Logo**; values that differ from the file's preset are bold with a dot, "Reset to preset".
  A change applies at once to every selected file, only for the field changed; mixed values say "Mixed".
  At the bottom: After printing (nothing / move / copy + folder) and the big **Print N files** button.
- Status bar: "3 files · 124 pages · about 34 sheets" and the printing progress; Pause / Stop while printing.
- Preview screen: fills the window under the title row like the print screen; sheet picture from the engine, ‹ ›,
  "Side 3 of 60 · sheet 2, back · pages 4 | 5".
- App's own boxes only (no Windows message boxes): ask, password, report (with Save as CSV), Manage presets,
  About (author as in Sastra PDF), What's new, progress while reading files, toasts, right-click menu.
- Keys: Ctrl+O add files, Ctrl+Shift+O add folder, Ctrl+S / Ctrl+Shift+S save job, Ctrl+P print, Ctrl+A, Delete,
  Ctrl+1…9 presets, Ctrl+Shift+C / V copy / paste settings, Alt or F10 menu, F5 preview.

## Testing
- `engine`: `dotnet test` (as before).
- `pnpm test`: node tests of `app/model.js` (presets, `*`, edits follow, mixed values, job file round trip) and an
  Electron run under Xvfb with a fake engine (`SIEVPHOV_FAKE_ENGINE=1`) that drives the window and takes screenshots
  in light and dark.
- Real printing: `Sievphov.Engine.exe --selftest`, and the user's own printer.

## Out of scope for now
Automatic updates, Microsoft Store package, Explorer right-click menu (all three exist in the other apps and can come
later), Khmer interface.

## Change (same day): laid out like Bohpum, not Sastra PDF
The user: "keep layout similar to bohpum, instead of sastra pdf". So:
- Bohpum's tokens (`--chrome #f7f5f1`, `--chrome-2`, `--line`/`--line-2`/`--line-3`, `--ink`/`--ink-2`/`--ink-3`,
  `--field`, `--surface`, `--surface-2`, `--pasteboard`, …) with the purple accent instead of its green.
- Title row 36 px (main.js `BAR_H` 36, colours `#f7f5f1` / `#23201b`): brand (opens About) · menu words File Edit
  Presets View Help (each pops up its own menu under it: `show-menu(index, x, y)`, as Bohpum; Alt+F/E/P/V/H, F10 and
  Alt alone open them) · the job name in the middle ("Untitled job •"). No ☰.
- Toolbar row as Bohpum's `#topbar`: groups with dividers (Add files, Add folder | Open job, Save job, Print | Remove,
  ▲, ▼ | Preview, Estimate | … Theme); words hide below 1320 px. Save ▾ is gone (Save job as… is in File, Ctrl+Shift+S).
- Three columns like Bohpum's Pages | page | properties: the **Presets panel** on the left (`.panel-h` "Presets 3"
  with + = save the selected file's settings as a preset, ✎ = Manage presets; one card per preset with name, what it
  does, Default, how many files use it, Ctrl+N; click picks, double-click or Enter applies to the selected files,
  right-click: apply, update from the selected file, edit, rename, duplicate, set default, delete; Apply to selected at
  its foot; drag its right edge 170–380 px), the file list in the middle on white, the settings on the right as
  Bohpum's properties panel (300–520 px), with the print bar at its foot.
- Boxes as Bohpum's modals (white, header line, footer band); Preview as Bohpum's print screen (white header and left
  column, the sheet on the pasteboard grey).
