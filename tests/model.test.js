// The list and preset rules (app/model.js) — `pnpm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../app/model.js');

const item = (n, extra = {}) => ({ id: 'f' + n, path: `/x/${n}.pdf`, name: `${n}.pdf`, pageCount: 10, settings: M.defaults(), presetId: null, presetName: null, modified: false, checked: true, ...extra });
function twoPresets() {
  const a = { Id: 'a', Name: 'A', Settings: M.normalize({ PrinterName: 'HP 4303', Tray: 'Tray 2', Copies: 2 }) };
  const b = { Id: 'b', Name: 'B', Settings: M.normalize({ PrinterName: 'Tally 1330', Copies: 5 }) };
  return { lib: { DefaultPresetId: 'a', Presets: [a, b] }, a, b };
}

test('apply a preset to 3 of 5 files, change one by hand, edit the preset', () => {
  const { lib, a } = twoPresets();
  const items = [1, 2, 3, 4, 5].map(n => item(n));
  M.applyPreset(items.slice(0, 3), a);
  for (const it of items.slice(0, 3)) {
    assert.equal(it.presetName, 'A');
    assert.equal(it.settings.PrinterName, 'HP 4303');
    assert.equal(it.settings.Tray, 'Tray 2');
    assert.equal(it.modified, false);
  }
  for (const it of items.slice(3)) assert.equal(M.presetLabel(it), '—');
  assert.notEqual(items[0].settings, items[1].settings, 'each file has its own copy');

  M.setField([items[2]], 'Copies', 9, lib);
  assert.equal(items[2].modified, true, 'changed by hand → *');
  assert.equal(items[2].presetName, 'A');

  const edited = M.clone(lib);
  edited.Presets[0].Settings.Copies = 3;
  edited.Presets[0].Settings.Tray = 'Tray 1';
  edited.Presets[0].Name = 'A renamed';
  M.libraryChanged(items, edited);
  assert.equal(items[0].settings.Copies, 3, 'unchanged files follow the preset');
  assert.equal(items[1].settings.Tray, 'Tray 1');
  assert.equal(items[2].settings.Copies, 9, 'the * file keeps its own change');
  assert.equal(items[2].presetName, 'A renamed');
  assert.equal(items[2].modified, true);

  M.resetToPreset([items[2]], edited);
  assert.equal(items[2].modified, false);
  assert.equal(items[2].settings.Copies, 3);

  // set back by hand to the preset's value: no *
  M.setField([items[1]], 'Copies', 7, edited);
  M.setField([items[1]], 'Copies', 3, edited);
  assert.equal(items[1].modified, false);

  edited.Presets.shift();
  M.libraryChanged(items, edited);
  assert.equal(items[0].presetId, null, 'deleted preset: unlinked');
  assert.equal(items[0].settings.Copies, 3, '... but the settings stay');
  assert.equal(M.presetLabel(items[0]), 'Own settings');
});

test('a change in the panel touches only that setting, on every selected file', () => {
  const { lib, a, b } = twoPresets();
  const x = item(1), y = item(2);
  M.applyPreset([x], a); M.applyPreset([y], b);
  M.setField([x, y], 'Sides', 'LongEdge', lib);
  assert.equal(x.settings.Sides, 'LongEdge');
  assert.equal(y.settings.Sides, 'LongEdge');
  assert.equal(x.settings.Copies, 2, 'other settings stay as they were');
  assert.equal(y.settings.Copies, 5);
  assert.deepEqual(M.shared([x, y], 'Copies'), { value: 2, mixed: true });
  assert.deepEqual(M.shared([x, y], 'Sides'), { value: 'LongEdge', mixed: false });
  assert.equal(M.differsFromPreset([x, y], 'Sides', lib), true);
  assert.equal(M.differsFromPreset([x, y], 'Copies', lib), false);
  M.setField([x], 'PageNumbers.Enabled', true, lib);
  assert.equal(x.settings.PageNumbers.Enabled, true);
  assert.equal(y.settings.PageNumbers.Enabled, false);
});

test('choosing a booklet switches on two-sided and landscape', () => {
  const lib = { DefaultPresetId: null, Presets: [] };
  const x = item(1);
  M.setField([x], 'Layout', 'Booklet', lib);
  assert.equal(x.settings.Sides, 'ShortEdge');
  assert.equal(x.settings.Orientation, 'Landscape');
  assert.equal(M.isTwoSided(x.settings), true);
});

test('normalize fills gaps from older files and drops wrong types', () => {
  const s = M.normalize({ Copies: 4, Tray: 'Tray 3', PageNumbers: { Enabled: true, Digits: 'Khmer' }, Bogus: 1, Dpi: 'high' });
  assert.equal(s.Copies, 4);
  assert.equal(s.Tray, 'Tray 3');
  assert.equal(s.PageNumbers.Enabled, true);
  assert.equal(s.PageNumbers.Digits, 'Khmer');
  assert.equal(s.PageNumbers.Format, '{page}');
  assert.equal(s.Dpi, 300);
  assert.equal('Bogus' in s, false);
  assert.deepEqual(Object.keys(s), Object.keys(M.DEFAULTS), 'same key order as the engine, so equal settings compare equal');
});

test('presets.json from version 1 loads; starter presets; unique names; import', () => {
  const v1 = { DefaultPresetId: 'p1', Presets: [{ Id: 'p1', Name: 'Book', Settings: { Layout: 'Booklet', Tray: 'Tray 2' } }, { Id: 'p2', Name: 'Label', Settings: { Copies: 5 } }] };
  const lib = M.readLibrary(v1);
  assert.equal(lib.Presets.length, 2);
  assert.equal(M.defaultPreset(lib).Name, 'Book');
  assert.equal(lib.Presets[0].Settings.Tray, 'Tray 2');
  assert.equal(lib.Presets[1].Settings.Sides, 'OneSide');
  assert.equal(M.readLibrary({ nope: 1 }), null);

  const s = M.starterLibrary();
  assert.equal(s.Presets.length, 3);
  assert.equal(M.defaultPreset(s).Name, 'Normal – 1 side');
  assert.equal(s.Presets[2].Settings.Layout, 'Booklet');

  assert.equal(M.uniqueName(lib, 'book'), 'book (2)');
  assert.equal(M.uniqueName(lib, 'Other'), 'Other');
  const n = M.importInto(lib, { Presets: v1.Presets });
  assert.equal(n, 2);
  assert.deepEqual(lib.Presets.map(p => p.Name), ['Book', 'Label', 'Book (2)', 'Label (2)']);
  assert.equal(new Set(lib.Presets.map(p => p.Id)).size, 4, 'imported presets get their own ids');
  assert.throws(() => M.importInto(lib, { x: 1 }), /not a Sievphov presets file/);
});

test('job files: same shape as version 1, presets found by id or by name', () => {
  const { lib, a } = twoPresets();
  const x = item(1), y = item(2, { checked: false });
  M.applyPreset([x], a);
  M.setField([y], 'Copies', 4, lib);
  const job = M.toJob([x, y]);
  assert.equal(job.Version, 1);
  assert.equal(job.Items[0].FilePath, '/x/1.pdf');
  assert.equal(job.Items[0].PresetId, 'a');
  assert.equal(job.Items[1].Checked, false);
  assert.equal(job.Items[1].Modified, true);

  const back = M.fromJob(JSON.parse(JSON.stringify(job)), lib);
  assert.equal(back[0].presetName, 'A');
  assert.equal(back[0].modified, false);
  assert.equal(back[1].checked, false);
  assert.equal(back[1].settings.Copies, 4);

  // the same job on another PC: preset ids differ, names match
  const other = { DefaultPresetId: 'z', Presets: [{ Id: 'z', Name: 'a', Settings: M.clone(a.Settings) }] };
  const moved = M.fromJob(job, other);
  assert.equal(moved[0].presetId, 'z');
  assert.equal(moved[0].modified, false);
  assert.throws(() => M.fromJob({ Items: 3 }, lib), /not a Sievphov job file/);
  // Repeat: kept in the job only when the list prints more than once
  assert.equal('Repeat' in job, false);
  assert.equal(M.jobRepeat(job), 1);
  assert.equal(M.jobRepeat(M.toJob([x, y], 30)), 30);
  assert.equal(M.jobRepeat({ Repeat: 'x' }), 1);
  assert.equal(M.jobRepeat({ Repeat: 5000 }), 999);
});

test('job files keep blank paper rows (no file) in their place', () => {
  const { lib, a } = twoPresets();
  const x = item(1), blank = { ...item(2), blank: true, path: '' };
  M.applyPreset([x, blank], a);
  const job = M.toJob([x, blank, item(3)]);
  assert.equal(job.Items[1].Blank, true);
  assert.equal(job.Items[1].FilePath, '');
  assert.equal('Blank' in job.Items[0], false, 'file rows look as in version 1');
  const back = M.fromJob(JSON.parse(JSON.stringify(job)), lib);
  assert.deepEqual(back.map(e => e.blank), [false, true, false]);
  assert.equal(back[1].presetName, 'A');
});

test('report CSV quotes commas and quotes; per-printer totals; Khmer digits', () => {
  const csv = M.reportCsv([{ fileName: 'a, b.pdf', folder: 'C:\\x', printer: 'HP', preset: 'Book "2"', status: 'Printed', message: '', pages: 3, sheets: 2, copies: 1 }]);
  assert.match(csv, /^File,Folder,Printer,Preset,Status/);
  assert.match(csv, /"a, b.pdf"/);
  assert.match(csv, /"Book ""2"""/);
  const items = [item(1), item(2, { settings: M.normalize({ PrinterName: 'Tally' }) }), item(3)];
  const rows = M.byPrinter(items, [{ pagesPrinted: 10, sheets: 5 }, { pagesPrinted: 4, sheets: 4 }, { pagesPrinted: 2, sheets: 1 }], 'HP');
  assert.deepEqual(rows, [{ printer: 'HP', files: 2, pages: 12, sheets: 6 }, { printer: 'Tally', files: 1, pages: 4, sheets: 4 }]);
  assert.equal(M.khmerDigits('Page 120'), 'Page ១២០');
});

test('booklet front or back only prints one-sided; old files read as both sides', () => {
  assert.equal(M.normalize({ Layout: 'Booklet' }).BookletSides, 'Both');
  assert.equal(M.isTwoSided(M.normalize({ Layout: 'Booklet' })), true);
  assert.equal(M.isTwoSided(M.normalize({ Layout: 'Booklet', BookletSides: 'Front' })), false);
  assert.equal(M.isTwoSided(M.normalize({ Sides: 'LongEdge' })), true);
});

test('pages per sheet as Sastra PDF: the grid turns with the sheet, Auto shows pages largest', () => {
  const two = M.normalize({ Layout: 'PagesPerSheet', Columns: 2, Rows: 1 }), six = M.normalize({ Layout: 'PagesPerSheet', Columns: 3, Rows: 2 });
  assert.deepEqual(M.nUpGrid(two, false), [1, 2]);
  assert.deepEqual(M.nUpGrid(two, true), [2, 1]);
  assert.deepEqual(M.nUpGrid(six, false), [2, 3]);
  assert.equal(M.sheetLandscape(two, [595, 842]), true);    // 2 upright pages side by side
  assert.equal(M.sheetLandscape(two, [842, 595]), false);   // 2 wide pages stacked
  assert.equal(M.sheetLandscape(six, [595, 842]), true);
  assert.equal(M.sheetLandscape(six, [842, 595]), false);
  assert.equal(M.sheetLandscape(M.normalize({ Layout: 'PagesPerSheet', Columns: 2, Rows: 2 }), [595, 842]), false);
  assert.equal(M.sheetLandscape(M.normalize({ Layout: 'Booklet' }), [595, 842]), true);
  assert.equal(M.sheetLandscape(M.normalize({}), [842, 595]), true);
  assert.equal(M.sheetLandscape(M.normalize({ Orientation: 'Portrait' }), [842, 595]), false);
});

test('pages per sheet is Columns × Rows as one value', () => {
  const s = M.defaults();
  assert.equal(M.get(s, 'PerSheet'), '2x1');
  M.set(s, 'PerSheet', '3x2');
  assert.equal(s.Columns, 3); assert.equal(s.Rows, 2);
  const { lib, a } = twoPresets(), x = item(1);
  M.applyPreset([x], a);
  M.setField([x], 'PerSheet', '2x2', lib);
  assert.equal(x.settings.Columns, 2); assert.equal(x.settings.Rows, 2); assert.equal(x.modified, true);
  assert.equal(M.differsFromPreset([x], 'PerSheet', lib), true);
  assert.deepEqual(M.shared([x, item(2)], 'PerSheet'), { value: '2x2', mixed: true });
});

test('missing trays are grouped by printer and tray', () => {
  const caps = { 'HP 4303': { trays: ['Tray 1', 'Tray 2', 'Tray 3'], exists: true }, 'HP M507': { trays: ['Tray 1', 'Tray 2'], exists: true }, Gone: { trays: [], exists: false } };
  const capsOf = n => caps[n] || null;
  const it = (n, PrinterName, Tray) => item(n, { settings: M.normalize({ PrinterName, Tray }) });
  const list = [it(1, 'HP M507', 'Tray 3'), it(2, 'HP M507', 'Tray 3'), it(3, 'HP 4303', 'Tray 3'), it(4, '', 'Tray 3'), it(5, 'Gone', 'Tray 3'), it(6, 'HP M507', ''), it(7, 'Unknown', 'Tray 3')];
  const g = M.missingTrays(list, capsOf, 'HP M507');
  assert.equal(g.length, 1);
  assert.deepEqual([g[0].printer, g[0].tray, g[0].items.map(x => x.id)], ['HP M507', 'Tray 3', ['f1', 'f2', 'f4']]);
  assert.deepEqual(g[0].trays, ['Tray 1', 'Tray 2']);
});

test('a tray remembers its printer: Swap trays asks printer A tray → printer B tray', () => {
  const caps = { 'Canon': { trays: ['Drawer 1', 'Drawer 2'], exists: true }, 'HP': { trays: ['Tray 1', 'Tray 2'], exists: true } };
  const lib = { Presets: [], DefaultPresetId: null };
  const a = item(1, { settings: M.normalize({ PrinterName: 'HP' }) }), b = item(2, { settings: M.normalize({ PrinterName: 'HP' }) });
  M.setField([a], 'Tray', 'Tray 1', lib); M.setField([b], 'Tray', 'Tray 2', lib);
  assert.equal(a.settings.TrayPrinter, 'HP', 'picking a tray notes its printer');
  M.setField([a, b], 'PrinterName', 'Canon', lib);
  assert.equal(a.settings.TrayPrinter, 'HP', 'changing the printer keeps it');
  const g = M.missingTrays([a, b], n => caps[n], 'HP');
  assert.deepEqual(g.map(x => [x.from, x.tray, x.printer, x.items.length]), [['HP', 'Tray 1', 'Canon', 1], ['HP', 'Tray 2', 'Canon', 1]]);
  M.setField([a], 'Tray', 'Drawer 2', lib, 'HP');
  assert.equal(a.settings.TrayPrinter, 'Canon');
  const d = item(3, { settings: M.normalize({ Tray: 'Tray 1' }) });   // on the default printer
  M.setField([d], 'Tray', 'Tray 2', lib, 'HP');
  assert.equal(d.settings.TrayPrinter, 'HP', 'the default printer by name');
  // presets and jobs saved before: the tray belongs to their printer
  assert.equal(M.normalize({ PrinterName: 'Canon', Tray: 'Drawer 1' }).TrayPrinter, 'Canon');
  assert.equal(M.normalize({ Tray: 'Drawer 1' }).TrayPrinter, '');
});

test('remembered tray swaps', () => {
  let sw = M.rememberSwap([], 'HP M507', 'Tray 3', 'Tray 2');
  sw = M.rememberSwap(sw, 'HP M507', 'Tray 3', 'Tray 1');
  assert.equal(sw.length, 1, 'one answer per printer and tray');
  assert.equal(M.rememberedSwap(sw, 'HP M507', 'Tray 3', ['Tray 1', 'Tray 2']), 'Tray 1');
  assert.equal(M.rememberedSwap(sw, 'HP M507', 'Tray 3', ['Tray 2']), null, 'that tray is gone');
  assert.equal(M.rememberedSwap(M.rememberSwap([], 'P', 'T', ''), 'P', 'T', []), '', 'As in printer');
  assert.equal(M.rememberedSwap(sw, 'Other', 'Tray 3', ['Tray 1']), null);
  assert.equal(M.rememberedSwap(undefined, 'P', 'T', []), null);
  // with the printer the tray came from: Tray 1 of the HP and Tray 1 of another printer can go to different drawers
  let s2 = M.rememberSwap([], 'Canon', 'Tray 1', 'Drawer 2', 'HP');
  s2 = M.rememberSwap(s2, 'Canon', 'Tray 1', 'Drawer 1', 'Epson');
  assert.equal(s2.length, 2);
  assert.equal(M.rememberedSwap(s2, 'Canon', 'Tray 1', ['Drawer 1', 'Drawer 2'], 'HP'), 'Drawer 2');
  assert.equal(M.rememberedSwap(s2, 'Canon', 'Tray 1', ['Drawer 1', 'Drawer 2'], 'Epson'), 'Drawer 1');
  assert.equal(M.rememberedSwap(sw, 'HP M507', 'Tray 3', ['Tray 1', 'Tray 2'], 'HP 4303'), 'Tray 1', 'an answer saved before (no printer) still counts');
});
