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
