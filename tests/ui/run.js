// Drives the real Sievphov window with the stand-in engine (nothing is printed) and saves screenshots:
//   pnpm run test:ui            (Linux: xvfb-run -a pnpm run test:ui)
// SIEVPHOV_SHOTS=<folder> says where the pictures go (default: %TEMP%/sievphov-shots). Exit code 0 = every check passed.
process.env.SIEVPHOV_FAKE_ENGINE = '1';
process.env.SIEVPHOV_TEST = '1';
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pdf } = require('../helpers/pdf.js');

// no GPU on a build server or under Xvfb: draw in software so screenshots work
app.disableHardwareAcceleration();

const user = fs.mkdtempSync(path.join(os.tmpdir(), 'sievphov-ui-'));
app.setPath('userData', user);
const shots = process.env.SIEVPHOV_SHOTS || path.join(os.tmpdir(), 'sievphov-shots');
fs.mkdirSync(shots, { recursive: true });

// sample files: books, an invoice, a label, a broken file
const docs = path.join(user, 'ឯកសារ Documents');
fs.mkdirSync(docs);
const file = (name, pages) => { const p = path.join(docs, name); fs.writeFileSync(p, Buffer.isBuffer(pages) ? pages : pdf(pages)); return p; };
const files = [
  file('Sastra_Book1.pdf', Array(120).fill([420, 595])),
  file('សៀវភៅ ធម៌ ភាគ១.pdf', Array(96).fill([420, 595])),
  file('Invoice-2026-10.pdf', Array(3).fill([595, 842])),
  file('Label.pdf', [[283, 425]]),
  file('Broken.pdf', Buffer.from('not a pdf'))
];

require('../../main.js');

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, what, ms = 8000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('timed out waiting for ' + what);
    await sleep(60);
  }
}
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failures++; };

app.whenReady().then(async () => {
  try {
    const win = await waitFor(() => BrowserWindow.getAllWindows()[0], 'window');
    win.setSize(1440, 900); win.center();
    const wc = win.webContents;
    const js = code => wc.executeJavaScript(code);
    const shot = async name => { await sleep(350); const img = await wc.capturePage(); fs.writeFileSync(path.join(shots, name + '.png'), img.toPNG()); console.log('shot ' + name); };
    const key = async (keyCode, modifiers = []) => { wc.sendInputEvent({ type: 'keyDown', keyCode, modifiers }); wc.sendInputEvent({ type: 'char', keyCode, modifiers }); wc.sendInputEvent({ type: 'keyUp', keyCode, modifiers }); await sleep(150); };
    const click = sel => js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`);
    const pickRow = (i, mods = {}) => js(`(() => { const r = document.querySelectorAll('.row')[${i}]; r.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, ctrlKey: ${!!mods.ctrl}, shiftKey: ${!!mods.shift} })); r.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 })); })()`);
    const rowText = i => js(`document.querySelectorAll('.row')[${i}]?.innerText || ''`);

    await waitFor(() => js(`document.documentElement.dataset.ready === '1'`), 'app ready');
    check(await js(`document.documentElement.dataset.notes`) === 'shown', "What's new opens by itself on the first start");
    await shot('00-whats-new');
    await click('.modal [data-close]');
    await shot('01-empty');

    // add the files (as if dropped from Explorer)
    wc.send('open-paths', files);
    await waitFor(() => js(`document.querySelectorAll('.row').length === 5`), '5 rows');
    await sleep(400);
    check((await rowText(0)).includes('Normal – 1 side'), 'new files get the default preset');
    check((await rowText(4)).includes("Can't read"), "a broken file says Can't read");
    check(await js(`document.querySelectorAll('.row')[4].querySelector('.tick').disabled`), 'a broken file cannot be ticked');

    // select the two books (click, Ctrl+click) and apply preset 3 with Ctrl+3
    await pickRow(0); await pickRow(1, { ctrl: true });
    check(await js(`document.querySelectorAll('.row.sel').length`) === 2, 'Ctrl+click selects two files');
    await js(`document.getElementById('list').focus()`);
    await key('3', ['control']);
    await sleep(300);
    check((await rowText(0)).includes('Book – booklet') && (await rowText(1)).includes('Book – booklet'), 'Ctrl+3 applies the booklet preset to both');
    check((await rowText(2)).includes('Normal – 1 side'), 'files not selected keep their preset');
    check((await rowText(0)).includes('Booklet'), 'Sides column says Booklet');
    await shot('02-booklet-preset-two-selected');

    // one file: change the tray and copies → bold label and *
    await pickRow(0);
    await sleep(200);
    const traySet = await js(`(() => {
      const f = [...document.querySelectorAll('#settingsBox .field')].find(f => f.querySelector('.flabel')?.textContent.startsWith('Paper tray'));
      const s = f.querySelector('select'); const o = [...s.options].find(o => o.value === 'Tray 2'); if (!o) return false;
      s.value = 'Tray 2'; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    check(traySet, 'the Paper tray list shows the printer\'s trays');
    await js(`(() => { const i = document.querySelector('.copies-row input'); i.value = '2'; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await sleep(300);
    const r0 = await rowText(0);
    check(r0.includes('Tray 2') && r0.includes('*'), 'changed by hand: Tray column and * in the Preset column');
    check(await js(`[...document.querySelectorAll('#settingsBox .flabel.changed')].map(l => l.textContent).join('|')`).then(t => t.includes('Paper tray') && t.includes('Copies')), 'changed settings are bold');
    await shot('03-file-settings-changed');

    // Page numbers section: switch on, Khmer digits
    await js(`(() => { const s = document.querySelector('#settingsBox .tsec[data-sec="numbers"]'); s.classList.remove('folded'); const c = s.querySelector('.chkf input'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await sleep(200);
    await js(`(() => { const b = [...document.querySelectorAll('#settingsBox .seg button')].find(b => b.textContent === '១ ២ ៣'); b.click(); })()`);
    await js(`document.querySelector('#settingsBox .tsec[data-sec="numbers"]').scrollIntoView()`);
    await shot('04-page-numbers');
    await js(`document.getElementById('toolsScroll').scrollTop = 0`);

    // mixed values over two files
    await pickRow(0); await pickRow(1, { ctrl: true });
    await sleep(200);
    check(await js(`document.querySelector('.copies-row input').placeholder`) === 'Mixed', 'two files with different copies show Mixed');

    // preview of the booklet
    await pickRow(0);
    await key('F5');
    await waitFor(() => js(`!!document.querySelector('.modal.preview img')`), 'preview image');
    check((await js(`document.getElementById('pvInfo').textContent`)).includes('Sheet 1, front · pages 120 | 1'), 'booklet sheet 1 front = pages 120 | 1');
    await shot('05-preview');
    await key('Right');
    await waitFor(() => js(`document.getElementById('pvInfo').textContent.includes('back')`), 'back side');
    check((await js(`document.getElementById('pvInfo').textContent`)).includes('pages 2 | 119'), 'booklet sheet 1 back = pages 2 | 119');
    await key('Escape');

    // the Bohpum layout: menu words in the title row, the Presets panel on the left
    check(await js(`[...document.querySelectorAll('#menus .menu-btn')].map(b => b.textContent).join(',')`) === 'File,Edit,Presets,View,Help', 'title row has the menu words File Edit Presets View Help');
    check(await js(`document.querySelectorAll('#presetList .preset').length`) === 3 && await js(`document.getElementById('presetCount').textContent`) === '3', 'Presets panel lists the 3 presets with a count');
    await pickRow(3);
    await js(`document.querySelectorAll('#presetList .preset')[1].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
    await sleep(250);
    check((await rowText(3)).includes('Both sides (long edge)') && (await rowText(3)).includes('2-sided'), 'double-clicking a preset applies it to the selected file');
    await shot('05b-presets-panel');

    // manage presets
    await click('#pManage');
    await waitFor(() => js(`!!document.querySelector('.modal.presets')`), 'presets box');
    await shot('06-manage-presets');
    await key('Escape');

    // dark theme
    await click('#bTheme'); await click('#bTheme');   // system → light → dark
    check(await js(`document.documentElement.dataset.theme`) === 'dark', 'theme button reaches dark');
    await shot('07-dark');
    await click('#bTheme');   // back to system

    // print only the invoice and the label: untick the books
    // (the list redraws after each change: find the box again each time)
    for (const i of [0, 1]) await js(`(() => { const t = document.querySelectorAll('.row')[${i}].querySelector('.tick'); t.checked = false; t.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await sleep(300);
    check((await js(`document.getElementById('printLbl').textContent`)) === 'Print 2 files', 'Print button counts the ticked files');
    await key('P', ['control']);
    await waitFor(() => js(`!!document.querySelector('.modal.wide .est')`), 'print box');
    await shot('08-print-confirm');
    await click('.modal.wide [data-r="1"]');
    await waitFor(() => js(`!!document.querySelector('.modal.report')`), 'report', 20000);
    check((await js(`document.querySelector('.modal.report').innerText`)).includes('2 printed'), 'report: 2 printed');
    await shot('09-report');
    await click('.modal.report [data-a="close"]');
    check((await rowText(2)).includes('Printed'), 'printed files say Printed');

    await click('#bAbout');
    await waitFor(() => js(`!!document.querySelector('.modal.about')`), 'about');
    await shot('10-about');
    await key('Escape');

    // presets were saved to the settings folder
    const saved = JSON.parse(fs.readFileSync(path.join(user, 'presets.json'), 'utf8'));
    check(saved.Presets.length === 3 && saved.Presets[2].Settings.Layout === 'Booklet', 'presets.json written in the same shape as version 1');
  } catch (e) {
    console.error('FAIL ' + (e.stack || e));
    failures++;
  }
  console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
  app.exit(failures ? 1 : 0);
});
