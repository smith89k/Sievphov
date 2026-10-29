// Drives the real Sievphov window with the stand-in engine (nothing is printed) and saves screenshots:
//   pnpm run test:ui            (Linux: xvfb-run -a -s "-screen 0 1600x1000x24" pnpm run test:ui — the window is 1440 × 900)
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
    // a dropdown in the settings panel, found by its label (only shown ones) → false when it or the value is missing
    const setSel = (label, value) => js(`(() => {
      const f = [...document.querySelectorAll('#settingsBox .field')].find(f => !f.closest('[hidden]') && f.querySelector('.flabel span')?.textContent === ${JSON.stringify(label)});
      const s = f?.querySelector('select'); if (!s || ![...s.options].some(o => o.value === ${JSON.stringify(value)})) return false;
      s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    const shownLabels = () => js(`[...document.querySelectorAll('#settingsBox .tsec[data-sec="layout"] .field')].filter(f => !f.closest('[hidden]')).map(f => f.querySelector('.flabel span')?.textContent || f.innerText.trim()).join('|')`);

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
    check(await js(`(() => { const l = document.querySelector('.preset-line'), r = document.getElementById('pReset'); return !r.hidden && l.offsetHeight < 46 && Math.abs(r.getBoundingClientRect().top - l.querySelector('.chip').getBoundingClientRect().top) < 8; })()`), 'Preset line: preset and Reset stay on one line');
    await js(`(() => { document.documentElement.style.setProperty('--tools-w', '300px'); })()`); await sleep(200);
    check(await js(`document.querySelector('.preset-line').offsetHeight < 46`), 'Preset line stays one line in the narrowest panel');
    await js(`document.documentElement.style.removeProperty('--tools-w')`);
    await shot('03-file-settings-changed');

    // Page numbers section: switch on, Khmer digits
    await js(`(() => { const s = document.querySelector('#settingsBox .tsec[data-sec="numbers"]'); s.classList.remove('folded'); const c = s.querySelector('.chkf input'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await sleep(200);
    await js(`(() => { const b = [...document.querySelectorAll('#settingsBox .seg button')].find(b => b.textContent === '១ ២ ៣'); b.click(); })()`);
    await js(`document.querySelector('#settingsBox .tsec[data-sec="numbers"]').scrollIntoView()`);
    check(await js(`(() => { const r = [...document.querySelectorAll('#settingsBox .row2')].find(r => r.querySelector('.chkf') && r.querySelector('input[type=number]'));
      if (!r) return false; const sec = r.closest('.tsec'), box = r.closest('.subbox'), wasF = sec.classList.contains('folded'), wasH = box?.hidden, wasR = r.hidden;
      sec.classList.remove('folded'); if (box) box.hidden = false; r.hidden = false; r.scrollIntoView();
      const a = r.querySelector('input[type=number]').getBoundingClientRect(), b = r.querySelector('.chkf input').getBoundingClientRect();
      const ok = a.height > 0 && Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) <= 2;
      sec.classList.toggle('folded', wasF); if (box) box.hidden = wasH; r.hidden = wasR; return ok; })()`), 'a tick box next to a text box lines up with the box');
    await shot('04-page-numbers');
    await js(`document.getElementById('toolsScroll').scrollTop = 0`);

    // mixed values over two files
    await pickRow(0); await pickRow(1, { ctrl: true });
    await sleep(200);
    check(await js(`document.querySelector('.copies-row input').placeholder`) === 'Mixed', 'two files with different copies show Mixed');

    // preview: every ticked file with its preset, every sheet drawn
    await pickRow(0);
    await key('F5');
    await waitFor(() => js(`document.querySelectorAll('.modal.preview .pv-group').length === 4`), 'preview groups');
    check(await js(`document.querySelectorAll('#pvFiles .pv-file').length`) === 4, 'preview lists the 4 ticked files that can be read');
    check(await js(`[...document.querySelectorAll('.pv-group .pv-preset')].map(s => s.selectedOptions[0].textContent.trim()).join('|')`) === 'Book – booklet 2-sided *|Book – booklet 2-sided|Normal – 1 side|Normal – 1 side', 'each file shows its own preset (* = changed by hand)');
    check(await js(`document.querySelectorAll('.pv-group')[0].querySelectorAll('.pv-sheet').length`) === 30, 'a 120-page booklet shows 30 sheets, front and back side by side');
    await waitFor(() => js(`/front 120 \\| 1 · back 2 \\| 119/.test(document.querySelector('.pv-group .pv-sheet figcaption').textContent)`), 'booklet sheet 1 drawn');
    check(true, 'booklet sheet 1: front 120 | 1, back 2 | 119');
    await waitFor(() => js(`document.querySelectorAll('.pv-group')[0].querySelectorAll('.pv-side img').length >= 6`), 'more sheets drawn');
    check(await js(`document.querySelector('.pv-group .pv-gh small').textContent.includes('Booklet, bound on the left')`), 'preview says where a booklet is bound');
    check(await js(`atob(document.querySelector('.pv-group .pv-side img').src.split(',')[1]).includes('Fold')`), 'booklet sheets show the fold (spine)');
    await shot('05-preview');
    await js(`(() => { const s = document.querySelectorAll('.pv-group .pv-preset')[2]; s.value = [...s.options].find(o => o.textContent.startsWith('Both sides')).value; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await waitFor(() => js(`(document.querySelectorAll('.pv-group')[2].querySelector('.pv-gh small')?.textContent || '').includes('2-sided')`), 'preset changed in preview');
    check((await rowText(2)).includes('Both sides (long edge)'), 'a preset picked in the preview is given to the file');
    await js(`document.querySelectorAll('.pv-group')[2].scrollIntoView()`);
    await waitFor(() => js(`!!document.querySelectorAll('.pv-group')[2].querySelector('.pv-side img')`), 'invoice drawn');
    await shot('05a-preview-invoice');
    await js(`document.querySelector('.pv-group .pv-side').click()`);
    await waitFor(() => js(`!!document.querySelector('#pvStage img')`), 'one sheet');
    check((await js(`document.getElementById('pvInfo').textContent`)).includes('sheet 1, front · pages 120 | 1'), 'click a sheet: it shows large');
    await shot('05b-preview-one-sheet');
    await key('Right');
    await waitFor(() => js(`document.getElementById('pvInfo').textContent.includes('back')`), 'back side');
    check((await js(`document.getElementById('pvInfo').textContent`)).includes('pages 2 | 119'), '→ goes to the back: pages 2 | 119');
    await key('Escape');
    check(await js(`!!document.querySelector('.modal.preview') && !document.getElementById('pvAll').hidden`), 'Esc goes back to all sheets');
    await key('Escape');
    check(await js(`!document.querySelector('.modal.preview')`), 'Esc again closes the preview');

    // the Bohpum title row; presets at the top of the panel on the right, as before
    check(await js(`[...document.querySelectorAll('#menus .menu-btn')].map(b => b.textContent).join(',')`) === 'File,Edit,Presets,View,Help', 'title row has the menu words File Edit Presets View Help');
    check(await js(`document.querySelectorAll('#tools #presetSel option').length`) === 3, 'the Presets section in the panel lists the 3 presets');
    await pickRow(3);
    await js(`(() => { const s = document.getElementById('presetSel'); s.value = s.options[1].value; s.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('pApply').click(); })()`);
    await sleep(250);
    check((await rowText(3)).includes('Both sides (long edge)') && (await rowText(3)).includes('2-sided'), 'Apply to selected gives the chosen preset to the selected file');

    // manage presets
    await js(`localStorage.removeItem('sievphov-preset-tab'); localStorage.removeItem('sievphov-sample-wide')`);
    await click('#pManage');
    await waitFor(() => js(`!!document.querySelector('.modal.presets')`), 'presets box');
    // the settings in tabs, one section at a time, opening on Layout
    const shownSecs = () => js(`[...document.querySelectorAll('#pmEdit > .tsec')].filter(s => !s.hidden).map(s => s.dataset.sec).join()`);
    check(await js(`document.querySelector('#pmTabs [aria-selected="true"]')?.dataset.sec`) === 'layout', 'Manage presets opens on the Layout tab');
    check(await shownSecs() === 'layout', 'only the Layout section shows');
    // the sample paper, as Sastra PDF's print screen: one side at a time, ‹ › to turn
    const sampleText = () => js(`[document.getElementById('pmNum').textContent, document.getElementById('pmPages').textContent].join(' / ')`);
    const pickField = (label, value) => js(`(() => { const s = [...document.querySelectorAll('#pmEdit .field')].find(f => f.querySelector('.flabel span')?.textContent === ${JSON.stringify(label)}).querySelector('select'); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await js(`document.querySelectorAll('#pmList li')[2].click()`);   // Book – booklet 2-sided
    await waitFor(() => js(`document.getElementById('pmSampleSum').textContent === '8 pages → 2 sheets, both sides'`), 'booklet sample');
    await waitFor(async () => (await sampleText()) === 'Sheet 1 of 2 · front / pages 8 | 1', 'booklet sample: sheet 1 front has pages 8 | 1');
    check(await js(`document.querySelectorAll('#pmStage .ps-side img').length === 1 && document.getElementById('pmPrev').disabled`), 'the sample shows one side; ‹ is off on the first');
    await shot('06-manage-presets');
    await click('#pmNext');
    await waitFor(async () => (await sampleText()) === 'Sheet 1 of 2 · back / pages 2 | 7', '› turns to the back of sheet 1');
    await click('#pmIn');
    check(await js(`document.getElementById('pmFit').textContent === '150 %' && document.getElementById('pmStage').classList.contains('zoomed')`), '+ zooms in');
    await click('#pmFit');
    await pickField('Layout', 'PagesPerSheet'); await pickField('Pages per sheet', '2x2');
    await waitFor(() => js(`document.getElementById('pmSampleSum').textContent === '8 pages → 1 sheet, both sides'`), '4 per sheet sample');
    await waitFor(async () => (await sampleText()) === 'Sheet 1 of 1 · back / pages 5 | 6 | 7 | 8', 'a change redraws the sample and keeps the side: 4 per sheet');
    await shot('06a-manage-presets-4-per-sheet');
    // wide pages, 2 per sheet: stacked on an upright sheet, as Sastra PDF
    await pickField('Pages per sheet', '2x1');
    await pickField('Orientation', 'Auto');   // the Book preset is landscape on purpose
    await click('.psample [data-wide="1"]');
    await waitFor(async () => (await sampleText()) === 'Sheet 1 of 2 · front / pages 1 | 2', 'wide sample, 2 per sheet');
    check(await js(`(() => { const e = document.querySelector('#pmStage .ps-side'); return e.offsetHeight > e.offsetWidth; })()`), '2 wide pages per sheet print on an upright sheet');
    await click('.psample [data-wide="0"]');
    await click('#pmTabs [data-sec="paper"]');
    check(await shownSecs() === 'paper', 'the Paper & tray tab shows only that section');
    await click('#pmTabs [data-sec="watermark"]');
    check(await js(`document.querySelector('#pmTabs [data-sec="watermark"] .dot').hidden`) === true, 'no Watermark dot while it is off');
    await js(`(() => { const c = document.querySelector('#pmEdit .tsec[data-sec="watermark"] input[type=checkbox]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    check(await js(`document.querySelector('#pmTabs [data-sec="watermark"] .dot').hidden`) === false, 'the Watermark tab shows a dot when it is on');
    await click('.modal.presets [data-a="cancel"]');   // the changes are not kept
    await sleep(300);
    await click('#pManage'); await waitFor(() => js(`!!document.querySelector('.modal.presets')`), 'presets box again');
    check(await js(`document.querySelector('#pmTabs [aria-selected="true"]')?.dataset.sec`) === 'watermark', 'the box remembers the last tab');
    await click('.modal.presets [data-a="cancel"]');
    await sleep(300);

    // dark theme
    await click('#bTheme'); await click('#bTheme');   // system → light → dark
    check(await js(`document.documentElement.dataset.theme`) === 'dark', 'theme button reaches dark');
    await shot('07-dark');
    await click('#bTheme');   // back to system

    // Layout as in Sastra PDF: the chosen layout's own settings in the box under it
    await pickRow(0); await sleep(250);
    await js(`document.querySelector('#settingsBox .tsec[data-sec="layout"]').scrollIntoView()`);
    let labels = await shownLabels();
    check(labels.includes('Print|Binding') && labels.includes('Size on the paper') && !labels.includes('Pages per sheet'), 'Booklet box: Print, Binding, Size on the paper');
    check(await js(`!![...document.querySelectorAll('#settingsBox .field')].find(f => f.querySelector('.flabel span')?.textContent === 'Sides')?.hidden`), 'a booklet hides Sides');
    check(await setSel('Print', 'Front'), 'Booklet: Front side only can be picked');
    await sleep(250);
    check((await rowText(0)).includes('Booklet · fronts only'), 'Sides column says fronts only');
    check((await js(`document.querySelector('#settingsBox .tsec[data-sec="layout"]').innerText`)).includes('print Back side only'), 'Front only says what to do next');
    await shot('03a-layout-booklet-front');
    await setSel('Print', 'Both'); await sleep(200);
    await pickRow(2); await sleep(250);
    check((await shownLabels()).includes('Size on the paper|') && !(await shownLabels()).includes('Pages per sheet'), 'One page per sheet box: Size on the paper, Position');
    check(await setSel('Layout', 'PagesPerSheet'), 'Multiple pages per sheet can be picked');
    await sleep(250);
    check(await js(`[...[...document.querySelectorAll('#settingsBox .field')].find(f => f.querySelector('.flabel span')?.textContent === 'Pages per sheet').querySelectorAll('option')].filter(o => !o.hidden).map(o => o.textContent).join(',')`) === '2,4,6,9,16', 'Pages per sheet: 2, 4, 6, 9, 16');
    check(await setSel('Pages per sheet', '2x2') && await setSel('Page order', 'AcrossThenDownReversed'), 'pick 4 per sheet, Horizontal reversed');
    await sleep(250);
    check((await rowText(2)).includes('4 per sheet'), 'Sides column says 4 per sheet');
    await shot('03b-layout-multiple');
    await setSel('Page order', 'AcrossThenDown'); await setSel('Pages per sheet', '2x1'); await setSel('Layout', 'Normal');
    await sleep(250);
    check(!(await rowText(2)).includes('*'), 'set back: the invoice matches its preset again');
    await sleep(800);   // its new estimate, before the totals are checked

    // print only the invoice and the label: untick the books
    // (the list redraws after each change: find the box again each time)
    for (const i of [0, 1]) await js(`(() => { const t = document.querySelectorAll('.row')[${i}].querySelector('.tick'); t.checked = false; t.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await sleep(300);
    check((await js(`document.getElementById('printLbl').textContent`)) === 'Print 2 files', 'Print button counts the ticked files');
    // Repeat: the whole list 3 times (3 books)
    await click('#repPlus'); await click('#repPlus');
    check((await js(`document.getElementById('printLbl').textContent`)) === 'Print 2 files × 3', 'Repeat 3: the Print button says × 3');
    check((await js(`document.getElementById('printSum').textContent`)) === '12 pages · about 9 sheets', 'Repeat 3: the Print button counts the pages and sheets of all 3 sets');
    check(!(await js(`document.getElementById('status').textContent`)).includes('sheet'), 'pages and sheets are not repeated in the status bar');
    await shot('07b-repeat');
    await key('P', ['control']);
    await waitFor(() => js(`!!document.querySelector('.modal.ask')`), 'print question');
    const ask = await js(`document.querySelector('.modal.ask').innerText`);
    check(ask.includes('Print 2 files, 3 times?') && /About 9 sheets on/.test(ask), 'Print asks a plain question: files, times, sheets');
    check(await js(`document.querySelectorAll('.modal.ask .acts .btn').length === 2 && !document.querySelector('.modal.ask select, .modal.ask input')`), 'the question has only Cancel and Print');
    await shot('08-print-confirm');
    await click('.modal.ask [data-r="1"]');
    await waitFor(() => js(`!!document.querySelector('.modal.report')`), 'report', 20000);
    check((await js(`document.querySelector('.modal.report').innerText`)).includes('2 printed'), 'report: 2 printed');
    check((await js(`document.querySelector('.modal.report').innerText`)).includes('3 sets'), 'report: each file printed 3 sets');
    await shot('09-report');
    await click('.modal.report [data-a="close"]');
    check((await rowText(2)).includes('Printed'), 'printed files say Printed');

    // Swap trays: the label's tray (Tray 3 of the HP 4303) is not on the HP M507 it now prints on
    await pickRow(3); await sleep(250);
    check(await setSel('Paper tray', 'Tray 3'), 'the label gets Tray 3');
    await sleep(200);
    check(await setSel('Printer', 'HP LaserJet M507'), 'then prints on the HP M507');
    await sleep(500);
    await key('P', ['control']);
    await waitFor(() => js(`!!document.querySelector('.modal .est.swap')`), 'Swap trays box');
    const swapText = await js(`document.querySelector('.modal').innerText`);
    check(swapText.includes('Swap trays') && swapText.includes('HP LaserJet M507') && swapText.includes('Tray 3'), 'Swap trays names the printer and the missing tray');
    check((await js(`document.querySelector('.modal .est.swap td.from').innerText`)).includes('HP LaserJet Pro 4303'), 'and the printer the tray came from (HP 4303 · Tray 3 → HP M507)');
    check(await js(`[...document.querySelectorAll('.modal .est.swap select option')].map(o => o.textContent).join('|')`) === 'As in printer|Automatically Select|Tray 1|Tray 2', "the box offers the HP M507's own trays");
    await js(`(() => { const s = document.querySelector('.modal .est.swap select'); s.value = 'Tray 2'; })()`);
    await shot('09c-swap-trays');
    await click('.modal [data-r="1"]');
    await waitFor(() => js(`!!document.querySelector('.modal.ask')`), 'print question after Swap trays');
    check((await rowText(3)).includes('Tray 2'), 'the label now uses Tray 2');
    await click('.modal.ask [data-r="0"]'); await sleep(200);
    // again with Tray 3: the box still lists the file, with last time's tray already picked
    await setSel('Printer', ''); await sleep(300); await setSel('Paper tray', 'Tray 3'); await sleep(200); await setSel('Printer', 'HP LaserJet M507'); await sleep(500);
    await key('P', ['control']);
    await waitFor(() => js(`!!document.querySelector('.modal .est.swap')`), 'Swap trays box with a remembered tray');
    check(await js(`document.querySelector('.modal .est.swap select').value === 'Tray 2' && !!document.querySelector('.modal .est.swap .last')`), 'a remembered tray is picked already and marked As last time');
    check((await js(`document.querySelector('.modal .est.swap tr.files').textContent`)).length > 0, 'the box names the files');
    await shot('09d-swap-remembered');
    await click('.modal [data-r="1"]');
    await waitFor(() => js(`!!document.querySelector('.modal.ask')`), 'print question after the remembered swap');
    check(await js(`[...document.querySelectorAll('.modal.ask .acts .btn')].map(b => b.textContent).join('|')`) === 'Cancel|Print', 'the print question is only Cancel / Print');
    await click('.modal.ask [data-r="0"]'); await sleep(200);
    await setSel('Printer', ''); await sleep(300); await setSel('Paper tray', ''); await sleep(200);
    check(!(await rowText(3)).includes('*'), 'the label is back to its preset');

    // blank paper: a separator row after the invoice, with the invoice's settings; Copies = how many blank sheets
    await click('#repMinus'); await click('#repMinus');
    await pickRow(2);
    await js(`document.getElementById('list').focus()`);
    await key('B', ['control']);
    await waitFor(() => js(`document.querySelectorAll('.row').length === 6`), 'blank paper row');
    const blankRow = await rowText(3);
    check(blankRow.includes('Blank paper') && blankRow.includes('Both sides (long edge)') && blankRow.includes('2-sided'), 'Ctrl+B adds Blank paper after the selected file, with its preset and settings');
    check(await js(`document.querySelectorAll('.row')[3].classList.contains('sel') && document.querySelector('#settingsBox .sel-head b').textContent === 'Blank paper'`), 'the new blank paper is selected and its settings are in the panel');
    await js(`(() => { const i = document.querySelector('.copies-row input'); i.value = '3'; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await waitFor(() => js(`document.querySelector('#settingsBox .sel-head small').textContent.includes('3 blank sheets (= Copies)')`), 'blank sheets summary');
    check(true, 'Copies 3 on blank paper: the panel says it prints 3 blank sheets');
    await shot('09a-blank-paper');
    await key('F5');
    await waitFor(() => js(`document.querySelectorAll('.modal.preview .pv-group').length === 3`), 'preview with blank paper');
    check(await js(`document.querySelectorAll('.pv-group')[1].querySelector('.pv-gh b').textContent === 'Blank paper' && document.querySelectorAll('.pv-group')[1].querySelectorAll('.pv-sheet').length === 1`), 'preview shows the blank paper between the files as one sheet');
    await js(`document.querySelectorAll('.pv-group')[1].scrollIntoView()`);
    await waitFor(() => js(`!!document.querySelectorAll('.pv-group')[1].querySelector('.pv-side img')`), 'blank sheet drawn');
    check(await js(`!atob(document.querySelectorAll('.pv-group')[1].querySelector('.pv-side img').src.split(',')[1]).includes('#fafafa')`), 'the blank sheet has nothing on it');
    check(await js(`document.querySelectorAll('.pv-file')[1].innerText.includes('3 blank sheets')`), 'preview: blank paper prints 3 blank sheets');
    check(await js(`document.querySelectorAll('.pv-group')[1].querySelector('figcaption').textContent`) === 'Blank sheet × 3', 'preview: the blank sheet is labelled Blank sheet × 3');
    await shot('09b-preview-blank');
    await key('Escape');
    check((await js(`document.getElementById('printLbl').textContent`)) === 'Print 3 files', 'blank paper is printed with the list');
    check((await js(`document.getElementById('printSum').textContent`)) === '4 pages · about 6 sheets', 'blank sheets count as sheets, not pages');
    await key('P', ['control']);
    await waitFor(() => js(`!!document.querySelector('.modal.ask')`), 'print question 2');
    await click('.modal.ask [data-r="1"]');
    await waitFor(() => js(`!!document.querySelector('.modal.report')`), 'report 2', 20000);
    check(await js(`[...document.querySelectorAll('.modal.report tbody tr')].some(r => r.cells[0].textContent === 'Blank paper' && r.cells[1].textContent === 'Printed' && r.cells[5].textContent === '0' && r.cells[6].textContent === '3')`), 'report: Blank paper printed, 0 pages, 3 sheets');
    await click('.modal.report [data-a="close"]');

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
