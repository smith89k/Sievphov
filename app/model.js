// Sievphov — the list and preset rules, with no screen in them (loaded by index.html, and by node for tests).
// Settings use the engine's names (PascalCase, enum values as words), the same as .svpv jobs and presets.json from
// version 1, so old files keep working. An item = one PDF in the list:
//   { id, path, name, folder, pageCount, pageSizes, password, settings, presetId, presetName, modified, checked,
//     status: 'wait'|'printing'|'printed'|'error'|'stopped'|'locked', message }
(function (root) {
'use strict';

// The engine's defaults (engine/src/Sievphov.Core/Models/PrintSettings.cs). KEEP IN SYNC.
const DEFAULTS = Object.freeze({
  PrinterName: '', Copies: 1, Collate: 'ByDocument',
  Pages: 'All', PageRange: '', Reverse: false,
  PaperSize: '', Tray: '', Orientation: 'Auto', Sides: 'OneSide',
  Fit: 'Fit', ZoomPercent: 100, Alignment: 'Center',
  Grayscale: false, Dpi: 300,
  Layout: 'Normal', Columns: 2, Rows: 1, Order: 'AcrossThenDown', GapMm: 5, Borders: false, Binding: 'Left', BookletGapMm: 10,
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

/** 'PageNumbers.Enabled' style paths. */
const get = (s, p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), s);
function set(s, p, v) {
  const keys = p.split('.'), last = keys.pop();
  const parent = keys.reduce((o, k) => o[k], s);
  parent[last] = v;
}

const isTwoSided = s => s.Layout === 'Booklet' || s.Sides !== 'OneSide';

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
  if (p) { it.presetName = p.Name; it.modified = !equal(it.settings, p.Settings); }
  else { it.presetId = null; it.presetName = null; it.modified = true; }
}

/**
 * One setting changed in the panel: only that setting changes, on every selected item. Choosing a booklet also
 * switches on two-sided printing (flip on the short edge) and landscape, as booklets need.
 */
function setField(items, p, value, lib) {
  for (const it of items) {
    const wasBooklet = it.settings.Layout === 'Booklet';
    set(it.settings, p, value);
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
function toJob(items) {
  return {
    Version: 1,
    Items: items.map(it => ({
      FilePath: it.path, Checked: !!it.checked, PresetId: it.presetId ?? null, PresetName: it.presetName ?? null,
      Modified: !!it.modified, Settings: clone(it.settings)
    }))
  };
}

/** Job entries → what each new item starts with; presets are found by id, else by name (a job from another PC). */
function fromJob(data, lib) {
  if (!isObj(data) || !Array.isArray(data.Items)) throw new Error('This is not a Sievphov job file.');
  return data.Items.filter(e => isObj(e) && typeof e.FilePath === 'string').map(e => {
    const settings = normalize(e.Settings);
    const p = findPreset(lib, e.PresetId) || findPresetByName(lib, e.PresetName);
    return {
      path: e.FilePath, relativePath: typeof e.RelativePath === 'string' ? e.RelativePath : null, checked: e.Checked !== false, settings,
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

/** Western digits → Khmer digits ០-៩ (for showing numbers the way page numbers will print). */
const khmerDigits = s => String(s).replace(/[0-9]/g, d => String.fromCharCode(0x17E0 + +d));

const M = {
  DEFAULTS, defaults, normalize, clone, equal, get, set, isTwoSided, newId,
  starterLibrary, readLibrary, findPreset, findPresetByName, defaultPreset, uniqueName, importInto,
  applyPreset, markModified, setField, setAll, resetToPreset, libraryChanged, presetLabel, shared, differsFromPreset,
  toJob, fromJob, reportCsv, byPrinter, khmerDigits
};
if (typeof module === 'object' && module.exports) module.exports = M; else root.SievphovModel = M;
})(this);
