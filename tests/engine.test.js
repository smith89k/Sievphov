// The engine client (engine.js) — its stand-in answers the same questions the C# engine does.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createEngine, _fake } = require('../engine.js');
const { pdf } = require('./helpers/pdf.js');
const M = require('../app/model.js');

test('stand-in engine: open, estimate, preview, booklet order', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sievphov-'));
  const file = path.join(dir, 'book.pdf');
  fs.writeFileSync(file, pdf(Array(8).fill([420, 595])));
  const e = createEngine({ fake: true });
  const info = await e.request('open', { path: file });
  assert.equal(info.pageCount, 8);
  assert.deepEqual(info.pageSizes[0], [420, 595]);

  const booklet = M.normalize({ Layout: 'Booklet', Copies: 2 });
  const [est] = await e.request('estimate', { items: [{ settings: booklet, pageCount: 8 }] });
  assert.equal(est.sheets, 4);
  assert.equal(est.pagesPrinted, 16);
  const { sides } = _fake.fakeSides(booklet, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(sides.map(s => s.slots), [[8, 1], [2, 7], [6, 3], [4, 5]]);

  const pv = await e.request('preview', { item: { path: file, pageCount: 8, pageSizes: info.pageSizes, settings: booklet }, side: 1 });
  assert.equal(pv.sides, 4);
  assert.equal(pv.isBack, true);
  assert.deepEqual(pv.slots, [2, 7]);

  const [bad] = await e.request('estimate', { items: [{ settings: M.normalize({ Pages: 'Range', PageRange: '1-x' }), pageCount: 8 }] });
  assert.match(bad.error, /not a page or range/);
  await assert.rejects(e.request('nope'), /Unknown command/);
});

test('stand-in engine: printing sends progress and a report', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sievphov-'));
  const file = path.join(dir, 'a.pdf');
  fs.writeFileSync(file, pdf([[595, 842], [595, 842]]));
  const e = createEngine({ fake: true });
  const events = [];
  const done = new Promise(res => e.onEvent(ev => { events.push(ev); if (ev.event === 'done') res(ev); }));
  await e.request('print', { items: [{ id: 'f1', path: file, pageCount: 2, pageSizes: [[595, 842], [595, 842]], settings: M.defaults() }] });
  const end = await done;
  assert.equal(end.report.length, 1);
  assert.equal(end.report[0].status, 'Printed');
  assert.ok(events.some(ev => ev.event === 'progress' && ev.progress.status === 'printing'));
});

test('real engine missing: a clear error, not a crash', async () => {
  const e = createEngine({ exe: path.join(os.tmpdir(), 'no-such-engine.exe') });
  await assert.rejects(e.request('printers'), err => err.reason === 'engine' && /missing/.test(err.message));
});
