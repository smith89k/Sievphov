// Sievphov — What's new: what changed in each version, newest first, and when the window shows by itself
// (as in Sastra PDF and Bohpum). Written by hand at release time, in plain words: what someone can now do. Text only.
// The newest entry must be package.json's version: scripts/check-notes.js stops `pnpm run dist` otherwise.
// Loaded by index.html before its main script; the window is openNotes in app.js.
(() => {
'use strict';

const KINDS = Object.freeze(['new', 'improved', 'fixed', 'removed']);   // the window lists them in this order, each tagged
const N = (version, date, notes) => Object.freeze({ version, date, notes: Object.freeze(notes.map(([kind, text]) => Object.freeze({ kind, text }))) });

const NOTES = Object.freeze([
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
