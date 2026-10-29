// Sievphov — the list and preset rules, with no screen in them (loaded by index.html, and by node for tests).
// Settings use the engine's names (PascalCase, enum values as words), the same as .svpv jobs and presets.json from
// version 1, so old files keep working. An item = one PDF in the list:
//   { id, path, name, folder, pageCount, pageSizes, password, settings, presetId, presetName, modified, checked,
//     status: 'wait'|'printing'|'printed'|'error'|'stopped'|'locked', message, blank }
// blank: true = Blank paper, a row with no file (path ''), put between files as a separator. It has a file's settings
// (printer, tray, paper, sides …) and prints one empty page, Copies times.
(function (root) {
'use strict';

// The engine's defaults (engine/src/Sievphov.Core/Models/PrintSettings.cs). KEEP IN SYNC.
const DEFAULTS = Object.freeze({
  PrinterName: '', Copies: 1, Collate: 'ByDocument',
  Pages: 'All', PageRange: '', Reverse: false,
  PaperSize: '', Tray: '', TrayPrinter: '', Orientation: 'Auto', Sides: 'OneSide',
  Fit: 'Fit', ZoomPercent: 100, Alignment: 'Center',
  Grayscale: false, Dpi: 300,
  Layout: 'Normal', Columns: 2, Rows: 1, Order: 'AcrossThenDown', GapMm: 5, Borders: false, Binding: 'Left', BookletGapMm: 10, BookletSides: 'Both',
  PageNumbers: Object.freeze({ Enabled: false, Position: 'BottomCenter', Font: 'Khmer UI', SizePt: 11, Color: '#000000', StartAt: 1, Format: '{page}', Digits: 'Western', MarginMm: 8 }),
  Watermark: Object.freeze({ Enabled: false, Text: '{filename}', Font: 'Khmer UI', SizePt: 48, Color: '#FF0000', SeeThroughPercent: 70, Angle: 45, Position: 'Center', MarginMm: 10 }),
  Logo: Object.freeze({ Enabled: false, Path: '', WidthPercent: 20, Position: 'TopRight', SeeThroughPercent: 0, MarginMm: 10 })
});

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = v => JSON.parse(JSON.stringify(v));

/** Settings with every key, in the defaults' order: missing keys from older files get the default. */
function normalize(s) {
  const out = {};
  for (const [k, d] of Object.entries(DEFAULTS)) {
    const v = isObj(s) ? s[k] : undefined;
    if (isObj(d)) {
      out[k] = {};
      for (const [k2, d2] of Object.entries(d)) out[k][k2] = isObj(v) && typeof v[k2] === typeof d2 ? v[k2] : d2;
    } else {
      out[k] = typeof v === typeof d ? v : d;
    }
  }
  if (out.Tray && !out.TrayPrinter) out.TrayPrinter = out.PrinterName;   // saved before trays knew their printer
  return out;
}
const defaults = () => normalize({});

function equal(a, b) {
  if (a === b) return true;
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every(k => equal(a[k], b[k]));
  }
  return false;
}

// Settings the panel shows as one value: PerSheet = Columns × Rows ("3x2").
const VIRTUAL = {
  PerSheet: {
    get: s => `${s.Columns}x${s.Rows}`,
    set: (s, v) => { const [c, r] = String(v).split('x').map(Number); if (c >= 1 && r >= 1) { s.Columns = c; s.Rows = r; } }
  }
};
/** Multiple pages per sheet: the numbers offered (as in Sastra PDF) and their Columns × Rows. */
const PER_SHEET = Object.freeze([[2, '2x1'], [4, '2x2'], [6, '3x2'], [9, '3x3'], [16, '4x4']]);

/** 'PageNumbers.Enabled' style paths, and the VIRTUAL ones. */
const get = (s, p) => VIRTUAL[p] ? VIRTUAL[p].get(s) : p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), s);
function set(s, p, v) {
  if (VIRTUAL[p]) { VIRTUAL[p].set(s, v); return; }
  const keys = p.split('.'), last = keys.pop();
  const parent = keys.reduce((o, k) => o[k], s);
  parent[last] = v;
}

// a booklet prints both sides unless only its fronts or only its backs are printed
const isTwoSided = s => s.Layout === 'Booklet' ? s.BookletSides === 'Both' : s.Sides !== 'OneSide';
// Pages per sheet as in Sastra PDF (LayoutMath.Grid / SheetIsLandscape, KEEP IN SYNC): the grid turns with the sheet,
// upright = the smaller of Columns / Rows across; Auto = the way round that shows the first page (points) larger.
const nUpGrid = (s, land) => { const a = Math.max(1, Math.min(s.Columns, s.Rows)), b = Math.max(1, Math.max(s.Columns, s.Rows)); return land ? [b, a] : [a, b]; };
function sheetLandscape(s, page = [595, 842], sheet = [595.3, 841.9]) {
  if (s.Layout === 'Booklet' || s.Orientation === 'Landscape') return true;
  if (s.Orientation === 'Portrait') return false;
  if (s.Layout !== 'PagesPerSheet') return page[0] > page[1];
  const gap = (s.GapMm || 0) * 72 / 25.4, fit = land => {
    const [c, r] = nUpGrid(s, land), w = land ? sheet[1] : sheet[0], h = land ? sheet[0] : sheet[1];
    return Math.min((w - gap * (c - 1)) / c / page[0], (h - gap * (r - 1)) / r / page[1]);
  };
  return fit(true) > fit(false) + 1e-9;
}

/* ---------------------------------------------------------------- presets */
let idCounter = 0;
const newId = () => (Date.now().toString(36) + (idCounter++).toString(36) + Math.random().toString(36).slice(2, 8));

function starterLibrary() {
  const normal = { Id: newId(), Name: 'Normal – 1 side', Settings: defaults() };
  const both = { Id: newId(), Name: 'Both sides (long edge)', Settings: normalize({ Sides: 'LongEdge' }) };
  const book = { Id: newId(), Name: 'Book – booklet 2-sided', Settings: normalize({ Layout: 'Booklet', Sides: 'ShortEdge', Orientation: 'Landscape' }) };
  return { DefaultPresetId: normal.Id, Presets: [normal, both, book] };
}

/** A library from presets.json (version 1 wrote the same shape); null when it is not one. */
function readLibrary(data) {
  if (!isObj(data) || !Array.isArray(data.Presets)) return null;
  const presets = data.Presets.filter(p => isObj(p) && typeof p.Name === 'string')
    .map(p => ({ Id: typeof p.Id === 'string' && p.Id ? p.Id : newId(), Name: p.Name, Settings: normalize(p.Settings) }));
  const def = presets.some(p => p.Id === data.DefaultPresetId) ? data.DefaultPresetId : presets[0]?.Id ?? null;
  return { DefaultPresetId: def, Presets: presets };
}

const findPreset = (lib, id) => (id == null ? null : lib.Presets.find(p => p.Id === id) || null);
const findPresetByName = (lib, name) => (name == null ? null : lib.Presets.find(p => p.Name.toLowerCase() === String(name).toLowerCase()) || null);
const defaultPreset = lib => findPreset(lib, lib.DefaultPresetId);

/** name, or "name (2)", "name (3)"… when it is taken (by another preset than `except`). */
function uniqueName(lib, name, except = null) {
  const taken = n => lib.Presets.some(p => p !== except && p.Name.toLowerCase() === n.toLowerCase());
  if (!taken(name)) return name;
  for (let i = 2; ; i++) if (!taken(`${name} (${i})`)) return `${name} (${i})`;
}

/** Adds the presets of an exported file; returns how many. */
function importInto(lib, data) {
  const incoming = readLibrary(data);
  if (!incoming) throw new Error('This is not a Sievphov presets file.');
  for (const p of incoming.Presets) {
    lib.Presets.push({ Id: findPreset(lib, p.Id) ? newId() : p.Id, Name: uniqueName(lib, p.Name.trim() || 'Imported'), Settings: p.Settings });
  }
  return incoming.Presets.length;
}

/* ---------------------------------------------------------------- items and presets */

/** Gives every item a copy of the preset's settings and links it to the preset (no *). */
function applyPreset(items, preset) {
  for (const it of items) {
    it.settings = clone(preset.Settings);
    it.presetId = preset.Id;
    it.presetName = preset.Name;
    it.modified = false;
  }
}

/** After a change by hand: the item keeps its preset and gets a * when it now differs from it. */
function markModified(it, lib) {
  const p = findPreset(lib, it.presetId);
  // TrayPrinter is only a note (where the tray was picked): it alone does not make a file "changed by hand"
  if (p) { it.presetName = p.Name; it.modified = !equal({ ...it.settings, TrayPrinter: '' }, { ...p.Settings, TrayPrinter: '' }); }
  else { it.presetId = null; it.presetName = null; it.modified = true; }
}

/**
 * One setting changed in the panel: only that setting changes, on every selected item. Choosing a booklet also
 * switches on two-sided printing (flip on the short edge) and landscape, as booklets need. A tray notes the printer
 * it is picked on (TrayPrinter; `defaultPrinter` names "Default printer"), so Swap trays can say where it came from.
 */
function setField(items, p, value, lib, defaultPrinter = '') {
  for (const it of items) {
    const wasBooklet = it.settings.Layout === 'Booklet';
    set(it.settings, p, value);
    if (p === 'Tray') it.settings.TrayPrinter = it.settings.PrinterName || defaultPrinter;
    if (p === 'Layout' && value === 'Booklet' && !wasBooklet) {
      it.settings.Sides = 'ShortEdge';
      it.settings.Orientation = 'Landscape';
    }
    markModified(it, lib);
  }
}

/** Paste settings / settings from another item: all of them, kept as "changed by hand" if they differ from the preset. */
function setAll(items, settings, lib) {
  for (const it of items) { it.settings = normalize(clone(settings)); markModified(it, lib); }
}

function resetToPreset(items, lib) {
  for (const it of items) { const p = findPreset(lib, it.presetId); if (p) applyPreset([it], p); }
}

/**
 * After presets were edited, renamed or deleted: items with no * take the new settings, items with a * keep theirs
 * (and lose the * if they now match), renamed presets show the new name, deleted ones unlink.
 */
function libraryChanged(items, lib) {
  for (const it of items) {
    if (it.presetId == null) continue;
    const p = findPreset(lib, it.presetId);
    if (!p) { it.presetId = null; it.presetName = null; it.modified = true; continue; }
    it.presetName = p.Name;
    if (!it.modified) it.settings = clone(p.Settings);
    else it.modified = !equal(it.settings, p.Settings);
  }
}

const presetLabel = it => it.presetName == null ? (it.modified ? 'Own settings' : '—') : it.presetName;

/** The value shown for a setting over several items: { value, mixed }. */
function shared(items, p) {
  if (!items.length) return { value: undefined, mixed: false };
  const v = get(items[0].settings, p);
  return { value: v, mixed: items.some(it => !equal(get(it.settings, p), v)) };
}

/** Does this setting differ from the item's preset (for the bold label)? Over several items: any of them. */
function differsFromPreset(items, p, lib) {
  return items.some(it => { const pr = findPreset(lib, it.presetId); return pr ? !equal(get(it.settings, p), get(pr.Settings, p)) : false; });
}

/* ---------------------------------------------------------------- jobs (.svpv) */
function toJob(items, repeat = 1) {
  return {
    Version: 1,
    ...(repeat > 1 ? { Repeat: repeat } : {}),   // print the whole list this many times; left out at 1 (as version 1 files)
    Items: items.map(it => ({
      ...(it.blank ? { Blank: true } : {}),
      FilePath: it.blank ? '' : it.path, Checked: !!it.checked, PresetId: it.presetId ?? null, PresetName: it.presetName ?? null,
      Modified: !!it.modified, Settings: clone(it.settings)
    }))
  };
}

/** How many times a job prints its whole list (1 for files without Repeat, and for nonsense). */
const jobRepeat = data => { const n = isObj(data) ? data.Repeat : 1; return Number.isInteger(n) && n >= 1 ? Math.min(n, 999) : 1; };

/** Job entries → what each new item starts with; presets are found by id, else by name (a job from another PC). */
function fromJob(data, lib) {
  if (!isObj(data) || !Array.isArray(data.Items)) throw new Error('This is not a Sievphov job file.');
  return data.Items.filter(e => isObj(e) && typeof e.FilePath === 'string').map(e => {
    const settings = normalize(e.Settings);
    const p = findPreset(lib, e.PresetId) || findPresetByName(lib, e.PresetName);
    return {
      blank: e.Blank === true, path: e.Blank === true ? '' : e.FilePath, relativePath: typeof e.RelativePath === 'string' ? e.RelativePath : null, checked: e.Checked !== false, settings,
      presetId: p ? p.Id : null, presetName: p ? p.Name : null,
      modified: p ? !equal(settings, p.Settings) : (e.PresetId != null || !!e.Modified)
    };
  });
}

/* ---------------------------------------------------------------- report */
function reportCsv(rows) {
  const cell = v => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const when = v => v ? new Date(v).toISOString().slice(0, 19).replace('T', ' ') : '';
  const head = ['File', 'Folder', 'Printer', 'Preset', 'Status', 'Message', 'Pages', 'Sheets', 'Copies', 'Started', 'Finished'];
  const lines = rows.map(r => [r.fileName, r.folder, r.printer, r.preset, r.status, r.message, r.pages, r.sheets, r.copies, when(r.started), when(r.finished)].map(cell).join(','));
  return [head.join(','), ...lines].join('\r\n') + '\r\n';
}

/** Per-printer totals for the Estimate box: [{ printer, files, pages, sheets }]. */
function byPrinter(items, estimates, defaultPrinter) {
  const map = new Map();
  items.forEach((it, i) => {
    const e = estimates[i] || {}, name = it.settings.PrinterName || defaultPrinter || 'Default printer';
    const row = map.get(name) || { printer: name, files: 0, pages: 0, sheets: 0 };
    row.files++; row.pages += e.pagesPrinted || 0; row.sheets += e.sheets || 0;
    map.set(name, row);
  });
  return [...map.values()].sort((a, b) => a.printer.localeCompare(b.printer));
}

/* ---------------------------------------------------------------- tray swaps */

/**
 * Files whose tray is not on the printer they print on, grouped by the printer the tray came from, the tray and the
 * printer: [{ from, tray, printer, trays, items }].
 * capsOf(name) → { trays, exists } or null (not known). Printers that are not installed are left to their own error.
 */
function missingTrays(items, capsOf, defaultPrinter) {
  const groups = new Map();
  for (const it of items) {
    const tray = it.settings.Tray, printer = it.settings.PrinterName || defaultPrinter;
    if (!tray || !printer) continue;
    const caps = capsOf(printer);
    if (!caps || !caps.exists || caps.trays.includes(tray)) continue;
    // from: the printer the tray was picked on ('' when not known, or when it is this printer)
    const from = it.settings.TrayPrinter === printer ? '' : it.settings.TrayPrinter || '';
    const key = [from, tray, printer].join('\u0000');
    if (!groups.has(key)) groups.set(key, { from, tray, printer, trays: caps.trays.slice(), items: [] });
    groups.get(key).items.push(it);
  }
  return [...groups.values()];
}
/** The remembered tray for `from` on `printer`, when it is still there ('' = as in printer); else null. */
// fromPrinter: the printer the tray came from; answers saved before trays knew their printer count for any printer
function rememberedSwap(swaps, printer, from, trays, fromPrinter = '') {
  const all = (swaps || []).filter(x => x.Printer === printer && x.From === from);
  const m = all.find(x => (x.FromPrinter || '') === fromPrinter) || all.find(x => !x.FromPrinter);
  return m && (m.To === '' || trays.includes(m.To)) ? m.To : null;
}
/** Remembers an answer (one per printer and tray): a new array. */
const rememberSwap = (swaps, printer, from, to, fromPrinter = '') =>
  [...(swaps || []).filter(x => !(x.Printer === printer && x.From === from && (x.FromPrinter || '') === fromPrinter)),
    { Printer: printer, From: from, FromPrinter: fromPrinter, To: to }];

/** Western digits → Khmer digits ០-៩ (for showing numbers the way page numbers will print). */
const khmerDigits = s => String(s).replace(/[0-9]/g, d => String.fromCharCode(0x17E0 + +d));

const M = {
  DEFAULTS, PER_SHEET, defaults, normalize, clone, equal, get, set, isTwoSided, nUpGrid, sheetLandscape, newId,
  starterLibrary, readLibrary, findPreset, findPresetByName, defaultPreset, uniqueName, importInto,
  applyPreset, markModified, setField, setAll, resetToPreset, libraryChanged, presetLabel, shared, differsFromPreset,
  toJob, fromJob, jobRepeat, reportCsv, byPrinter, missingTrays, rememberedSwap, rememberSwap, khmerDigits
};
if (typeof module === 'object' && module.exports) module.exports = M; else root.SievphovModel = M;
})(this);
