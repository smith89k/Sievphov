// A stand-in for store-update/out/SievphovStoreUpdate.exe (tests only): main.js runs it when SIEVPHOV_STORE_HELPER names
// this file. It prints the same JSON lines as the real helper (store-update/update.cpp). What the pretend Store says is read
// from the file SIEVPHOV_FAKE_STORE_FILE names, at each run, so a test can change it as it goes:
//   current      no update
//   update       2.3.5 found, may download quietly (Store's automatic updates on)
//   ask          2.3.5 found, Windows must ask first (no quiet download)
//   fail         the Store can't be reached
//   install-fail the download works, the install doesn't
'use strict';
const fs = require('fs');

const cmd = process.argv[2] || '', silentOnly = process.argv.includes('--silent-only');
let mode = 'current';
try { mode = fs.readFileSync(process.env.SIEVPHOV_FAKE_STORE_FILE, 'utf8').trim() || 'current'; } catch {}
const line = o => process.stdout.write(JSON.stringify(o) + '\n');
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  line({ event: 'start', package: 'smith89k.Sievphov_test' });
  if (mode === 'fail') { line({ event: 'error', code: '0x80072EE7' }); process.exit(1); }
  const found = mode !== 'current', silent = mode !== 'ask';
  if (cmd === 'check') { line({ event: 'check', count: found ? 1 : 0, version: found ? '2.3.5.0' : '', silent }); return; }
  if (!found) { line({ event: 'done', state: 'nothing' }); return; }
  if (cmd === 'download') {
    if (!silent && silentOnly) { line({ event: 'done', state: 'cancelled' }); return; }
    const total = 48 * 1048576;
    for (let i = 0; i <= 10; i++) { line({ event: 'progress', done: total * i / 10, total, fraction: i / 10 }); await wait(150); }
    line({ event: 'done', state: 'completed' });
    return;
  }
  if (cmd === 'install') { line({ event: 'done', state: mode === 'install-fail' ? 'failed' : 'completed' }); return; }
  line({ event: 'error', code: 'usage' });
  process.exit(2);
})();
