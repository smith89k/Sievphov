// The real C# engine over its stdin/stdout channel. Windows only: runs when engine-dist/Sievphov.Engine.exe exists
// (pnpm run engine), or SIEVPHOV_ENGINE_EXE points at one; skipped elsewhere. Nothing is printed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createEngine } = require('../engine.js');
const { pdf } = require('./helpers/pdf.js');
const M = require('../app/model.js');

const exe = process.env.SIEVPHOV_ENGINE_EXE || path.join(__dirname, '..', 'engine-dist', 'Sievphov.Engine.exe');
const skip = process.platform !== 'win32' || !fs.existsSync(exe) ? 'needs Windows and engine-dist/Sievphov.Engine.exe' : false;

test('real engine: printers, caps, open, estimate, preview', { skip }, async () => {
  const e = createEngine({ exe, log: line => console.log(line) });
  try {
    const printers = await e.request('printers');
    assert.ok(Array.isArray(printers));
    console.log('printers: ' + printers.map(p => p.name + (p.isDefault ? ' (default)' : '')).join(' | '));
    if (printers.length) {
      const caps = await e.request('caps', { name: printers[0].name });
      assert.ok(Array.isArray(caps.paperSizes) && Array.isArray(caps.trays));
      console.log(`caps of ${printers[0].name}: ${caps.trays.length} trays, ${caps.paperSizes.length} papers, duplex ${caps.canDuplex}`);
    }

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sievphov-real-'));
    const file = path.join(dir, 'សៀវភៅ book.pdf');   // a Khmer name through the channel
    fs.writeFileSync(file, pdf(Array(8).fill([420, 595])));
    const info = await e.request('open', { path: file, passwords: [] });
    assert.equal(info.pageCount, 8);
    assert.equal(Math.round(info.pageSizes[0][0]), 420);

    const booklet = M.normalize({ Layout: 'Booklet', Copies: 2, PageNumbers: { Enabled: true, Digits: 'Khmer', Format: 'ទំព័រ {page}' } });
    const [est, bad] = await e.request('estimate', { items: [{ settings: booklet, pageCount: 8 }, { settings: M.normalize({ Pages: 'Range', PageRange: '1-x' }), pageCount: 8 }] });
    assert.equal(est.sheets, 4);
    assert.equal(est.pagesPrinted, 16);
    assert.match(bad.error, /not a page or range/);

    const pv = await e.request('preview', { item: { id: 'f1', path: file, pageCount: 8, pageSizes: info.pageSizes, settings: booklet }, side: 0, maxPx: 800 });
    assert.equal(pv.sides, 4);
    assert.deepEqual(pv.slots, [8, 1]);
    assert.ok(pv.png.length > 1000, 'a PNG came back');
    fs.writeFileSync(path.join(dir, 'preview.png'), Buffer.from(pv.png, 'base64'));
    console.log('preview saved: ' + path.join(dir, 'preview.png'));

    const broken = path.join(dir, 'broken.pdf');
    fs.writeFileSync(broken, 'not a pdf');
    await assert.rejects(e.request('open', { path: broken }), err => err.reason === 'damaged');
  } finally {
    e.stop();
  }
});
