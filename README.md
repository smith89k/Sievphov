# Sievphov (សៀវភៅ)

Print many PDF files in one go on Windows. Each file has its own printer settings, and **presets** apply a saved set of settings to many selected files with one click.
Made for printing books (Khmer books, sastra): two-sided, booklets, page numbers with Khmer digits, and watermarks.

## Get the program

1. Open the repository on GitHub → **Actions** → the latest green **Build Windows app** run.
2. Download **Sievphov-win-x64** and unzip it. You get one file, `Sievphov.exe`.
3. Copy `Sievphov.exe` anywhere and double-click it. Nothing needs to be installed; it runs on 64-bit Windows 10 and 11.

Windows may show "Windows protected your PC" the first time, because the program is not signed. Click **More info → Run anyway**.

## How to use

| To do this | Do this |
|---|---|
| Add files | Drag PDFs or folders onto the list, or use **+ Files** / **+ Folder** (choose "Include subfolders" and a preset) |
| Choose what to print | Tick the files in the ✓ column. Only ticked files print. |
| Use a preset | Select files (click, Ctrl+click, Shift+click, Ctrl+A) → pick a preset → **Apply to selected**. Or right-click → **Apply preset ▸**, or press **Ctrl+1 … Ctrl+9**. |
| Change one file | Double-click it (or Enter) → **File settings**. Values that differ from its preset are **bold**; the Preset column then shows `*`. |
| Change many files | Select them → **File settings…** → **Apply to all selected**, or use **Back / Next** to go through them one by one. |
| Make or edit presets | **Manage presets…** New, Duplicate, Rename, Delete, ▲▼, **Set as default** (given to new files), **Import / Export** to copy presets to another PC. |
| Save a preset from a file | Right-click the file → **Save as preset…** |
| Check before printing | **Preview** shows every sheet as it will print. **Estimate** shows pages and paper per printer. |
| Print | **▶ PRINT** (Ctrl+P). **Pause** and **■ Stop** work while printing. At the end you get a report you can save for Excel. |
| Reuse a list | **Save job…** saves the list with every file's own settings as a `.svpv` file. **More ▾ → Open .svpv files with Sievphov** makes double-clicking a job open it. |

When you edit a preset, every file using it **without** a `*` gets the new settings. Files with a `*` keep their own changes.

### Settings in a preset (and per file)

- **Printer & pages:** printer, copies, collate, all / odd / even / range (`1-5, 8, 12-last`), reverse order
- **Paper & tray:** paper size, **paper tray**, orientation (auto turns pages to fit), one side / both sides (long or short edge), fit / shrink / actual size / fill / zoom, alignment, color or grayscale, quality (150 / 300 / 600 dpi)
- **Layout:** normal, several pages per sheet (columns × rows, order, gap, borders), **booklet** (bind left/right, middle gap)
- **Page numbers:** position (including "outside" for books), format such as `ទំព័រ {page}` or `{page} / {pages}`, Khmer digits ១ ២ ៣, start number, font, size, color
- **Watermark:** text with `{filename} {name} {date} {time} {page} {pages}`, font, size, color, see-through %, angle, position
- **Logo:** a PNG/JPG picture, width, position, see-through %

Booklets: pages are put two per side in folding order (8|1, 2|7, …). Print on both sides, flipping on the short edge, then fold the stack in the middle.

### Where things are saved

Presets and options are kept in `%AppData%\Sievphov` (**More ▾ → Open settings folder**). Saved passwords for locked PDFs are stored there in plain text.

## For developers

- `src/Sievphov.Core`: settings, presets, page ranges, booklet/N-up order, estimates, job files, PDF reading (PDFium via PDFtoImage). Runs on any OS.
- `src/Sievphov`: the WPF app and the print engine (System.Drawing printing, one print job per file).
- `tests/Sievphov.Tests`: `dotnet test`

Build the exe on Windows with `build\publish.ps1`, or anywhere with
`dotnet publish src/Sievphov -p:PublishProfile=win-x64` (output: `dist/Sievphov/Sievphov.exe`).
`Sievphov.exe --selftest <folder>` prints sample books to "Microsoft Print to PDF" without using paper; the GitHub build runs it.
