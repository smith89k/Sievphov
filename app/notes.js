// Sievphov — What's new: what changed in each version, newest first, and when the window shows by itself
// (as in Sastra PDF and Bohpum). Written by hand at release time, in plain words: what someone can now do. Text only.
// The newest entry must be package.json's version: scripts/check-notes.js stops `pnpm run dist` otherwise.
// Loaded by index.html before its main script; the window is openNotes in app.js.
(() => {
'use strict';

const KINDS = Object.freeze(['new', 'improved', 'fixed', 'removed']);   // the window lists them in this order, each tagged
const N = (version, date, notes) => Object.freeze({ version, date, notes: Object.freeze(notes.map(([kind, text]) => Object.freeze({ kind, text }))) });

const NOTES = Object.freeze([
  N('2.2.0', '2026-10-29', [
    ['new', 'Manage presets fills the window, like Sastra PDF\'s print screen: the settings on the left in tabs (Printer, Paper, Layout, Numbers, Watermark, Logo), a sample sheet in the middle printed with the chosen preset, and your presets on the right. Step through the sample sheets with ‹ ›, zoom with − Fit +, and switch between upright and wide sample pages.'],
    ['improved', 'Multiple pages per sheet places pages as Sastra PDF does: the grid turns with the sheet and pages are never turned sideways (2 wide pages per sheet now stack on an upright sheet). Print page border goes round each page.'],
    ['improved', 'Previews show a thin grey edge round each page on a sheet, so you can see where one page ends. It is never printed.'],
    ['improved', 'Swap trays shows where each tray comes from: printer A · Tray 1 → printer B · the tray you pick, one row per tray, with the files under it. It lists every file each time; a tray you chose before is already picked (As last time).'],
    ['fixed', 'Swap trays no longer leaves out files whose tray swap was remembered.']
  ]),
  N('2.1.0', '2026-10-29', [
    ['new', 'Swap trays: when a file prints on a printer that does not have its paper tray (for example a preset made for another printer), Print first asks which of that printer\'s trays to use. Tick Remember for next time and it is done by itself afterwards; the print question then says which trays were swapped, and Change trays… picks again.'],
    ['new', 'Booklets can print the front sides only or the back sides only, for printers that cannot print on both sides: print the fronts, put the stack back in the tray, then print the backs.'],
    ['improved', 'Layout reads like Sastra PDF: One page per sheet, Multiple pages per sheet or Booklet, with only the chosen layout\'s settings in a box under it. Multiple pages per sheet: pick 2, 4, 6, 9 or 16 and the page order (horizontal, vertical, or reversed).'],
    ['improved', 'Reverse order on a booklet now prints the last sheet first, as in Sastra PDF (before, it swapped the left and right pages).']
  ]),
  N('2.0.0', '2026-10-20', [
    ['new', 'A new look, laid out like Bohpum: the title row with the File, Edit, Presets, View and Help menus and the job\'s name, a toolbar under it, the files in the middle and their settings on the right. The same fonts, boxes and light and dark theme as Bohpum and Sastra PDF (the button at the top right, or View › Theme).'],
    ['new', 'Presets sit at the top of the panel on the right: pick one, then Apply to selected. Save as preset, Update preset and Manage presets are next to it.'],
    ['new', 'File settings are now a panel on the right. Select one or more files and change anything there: it applies at once to every selected file, only for the setting you changed. Values that differ from the file\'s preset are bold, and Reset to preset puts them back.'],
    ['new', 'Repeat: print the whole list several times, one complete set after another (file 1, 2, 3 … then again). Set it next to the Print button: for 30 books made of several files, set 30. Each file is moved or copied after its last set, and saved jobs keep the number.'],
    ['new', 'Ctrl+1 … Ctrl+9 apply the first nine presets. Each preset keeps the printer, paper tray, paper, sides, copies, pages, layout, page numbers and watermark.'],
    ['new', 'Drag files in the list to put them in another order, or click a column heading to sort.'],
    ['improved', 'Preview fills the window and shows every ticked file one after the other, each with its preset, printer, tray and sides, and every sheet exactly as it will print (a book shows the front and back of each sheet side by side, with the fold — the spine — marked and where it is bound). Pick another preset above a file\'s sheets to see how it would print. Click a sheet to see it large; ← → go on into the next file.'],
    ['improved', 'Print only asks a short question — how many files, how many times, about how many sheets on which printer — then prints. What happens to the PDFs afterwards is in File › After Printing….'],
    ['improved', 'Every message is now in Sievphov\'s own boxes, never a Windows message box.']
  ]),
  N('1.0.0', '2026-10-19', [
    ['new', 'The first version: print many PDF files in one go, each with its own printer, tray, paper, sides, copies and pages; presets; booklets; several pages per sheet; page numbers in Khmer digits; text and picture watermarks; preview, estimate and a report after printing; saved jobs (.svpv).']
  ])
]);

// Order in the list is the only notion of "older": nothing compares version numbers.
const noteFor = v => NOTES.find(e => e.version === v) || null;
// the versions before v; all of them when v has no entry, so the menu always has something to show
const earlierNotes = v => { const i = NOTES.findIndex(e => e.version === v); return i < 0 ? NOTES.slice() : NOTES.slice(i + 1); };
// inequality, not "newer": a downgrade or a lost memory shows the notes once, then repairs itself
const shouldShow = (v, lastSeen) => !!noteFor(v) && lastSeen !== v;

window.SievphovNotes = { KINDS, NOTES, noteFor, earlierNotes, shouldShow };
})();
