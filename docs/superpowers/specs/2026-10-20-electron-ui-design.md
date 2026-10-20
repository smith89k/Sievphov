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

## Change (same day): presets back in the panel; Preview of every file
The user: "the panel should be the same before, and preview should have preview all the file with the preset for user
to see how their file look when printed". So:
- No Presets panel on the left. The settings panel on the right starts again with the folding **Presets** section
  (preset big dropdown, Apply to selected, Manage presets…, Save as preset…, Update preset), then the file settings.
  The title row and toolbar stay as Bohpum's.
- **Preview** (F5, Preview button, double-click a row) shows every ticked file (all readable files when none is ticked,
  or when the file it was opened from is not ticked), one after the other on the pasteboard grey:
  - left column: a card per file (number, name, preset chip with `*`, printer · tray · paper · sides, sheets · pages ·
    copies); click scrolls to it; the file in view is marked;
  - each file: a sticky header with the same facts and a **Preset** dropdown — picking a preset there gives it to the
    file (as Apply) and redraws its sheets, so the user can try presets and see the result;
  - every sheet side drawn by the engine at thumbnail size when scrolled near (one request at a time, the ones on
    screen first; replies cached per file, side and size); two-sided files show front and back side by side with
    "Sheet 1 · front 120 | 1 · back 2 | 119" under them; a size slider (4 steps, remembered);
  - **One sheet** (click a sheet, or the switch in the header): that side large, click = actual size, ← → / PgUp / PgDn
    go on across files; Esc returns to all sheets, Esc again closes.
  - Sides per file come from `estimate` (`sides` per copy), so the engine protocol is unchanged.

## Change (same day): the fold in previews; Repeat
- "since it have binding why in preview not show the binding": a booklet's previews (engine `Preview`, `DrawFold`, and
  the stand-in engine) draw the fold — the book's spine — as a purple dash-dot line over the whole sheet with a "Fold ·
  spine" tag at the top edge; preview only, never printed (like the dashed printable edge). The Preview's words say
  "Booklet, bound on the left / right".
- "should have option for repeat printing, coz we want how many book": **Repeat** = print the whole list N times
  (1–999), set after set in list order. Print bar: "Repeat [− N +] times" above the Print button ("Print 2 files × 3",
  totals × N); the Print box has the same field with the total. `print { items, after, repeat }`: `PrintEngine.RunAll`
  loops the sets; a file that fails or is stopped is skipped in later sets; the after-printing move / copy runs after a
  file's last set only (a move after set 1 would lose the file for set 2); between sets a file says "1 of 3 sets
  printed"; the report has one row per file (pages and sheets of all sets, `Sets`, message "3 sets"). Saved in the job
  as `Repeat` (only when > 1, so version 1 files are unchanged); `M.jobRepeat(data)` reads it.
- "click print just show confirm window … keep it clean since repeat is already set from the outside": the Print box is
  now only the app's question box (`askChoice`): "Print 2 files, 3 times?", "About 9 sheets on HP LaserJet Pro 4303. The
  whole list 3 times, one set after another." (+ where the PDFs go afterwards, + files that will stop with an error),
  Cancel / Print. No Repeat field and no estimate table in it; After printing moved to File › After Printing….
