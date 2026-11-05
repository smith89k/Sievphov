// The Store copy's update state (store-update.js) and the panel's words (app/update-panel.js), with no Store and no window.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const S = require('../store-update.js');

// a helper run that answers with these events; `hold` keeps it running until released
function fakeRun(script) {
  const calls = [];
  const run = (args, onEvent) => {
    calls.push(args);
    const events = script[args[0]] || [];
    let release;
    const done = new Promise(res => { release = res; queueMicrotask(() => { for (const e of events) onEvent(e); if (!script.hold) res(); }); });
    return { done, kill: () => release() };
  };
  return { run, calls };
}
// timers that never fire by themselves; `fire(ms)` runs the ones set for that long
function fakeTimers() {
  const set = [];
  return {
    timers: { setTimeout: (fn, ms) => { set.push({ fn, ms }); return set.length; }, clearTimeout() {}, setInterval: () => 0, clearInterval() {} },
    fire: ms => { for (const t of set.filter(t => t.ms === ms)) t.fn(); }
  };
}
const make = (script, more = {}) => {
  const f = fakeRun(script), sent = [];
  const t = fakeTimers();
  const up = S.createStoreUpdater({ run: f.run, current: '2.3.3', send: s => sent.push(s), log: () => {}, hwnd: () => '123', taskOpen: () => false,
    registerRestart: more.registerRestart || (() => {}), timers: t.timers });
  return { up, calls: f.calls, sent, fire: t.fire };
};
const settle = () => new Promise(r => setTimeout(r, 10));

test('the Store\'s four-part version → the new version, only when it is newer', () => {
  assert.equal(S.nextVersion('2.3.3', '2.3.4.0'), '2.3.4');
  assert.equal(S.nextVersion('2.3.3', '2.4.0.1'), '2.4.0.1');
  assert.equal(S.nextVersion('2.3.3', '2.3.3.0'), null, 'the installed version is not a new one');
  assert.equal(S.nextVersion('2.3.3', ''), null);
});

test('helper lines: only JSON objects with an event count', () => {
  assert.deepEqual(S.parseLine('{"event":"check","count":0}'), { event: 'check', count: 0 });
  assert.equal(S.parseLine('not json'), null);
  assert.equal(S.parseLine('[1]'), null);
  assert.equal(S.parseLine('{"count":1}'), null);
});

test('no update: Check for Updates says current, nothing to show', async () => {
  const { up } = make({ check: [{ event: 'check', count: 0, version: '', silent: true }] });
  assert.deepEqual(await up.checkNow(), { kind: 'current' });
  assert.equal(up.state().stage, 'none');
});

test('the helper gives no answer: failed', async () => {
  const { up } = make({ check: [{ event: 'error', code: '0x803F6101' }] });
  assert.deepEqual(await up.checkNow(), { kind: 'failed' });
});

test('an update Windows lets download quietly: it downloads by itself with --silent-only, then ready', async () => {
  const { up, calls, sent } = make({
    check: [{ event: 'check', count: 1, version: '2.3.4.0', silent: true }],
    download: [{ event: 'progress', done: 24, total: 48, fraction: 0.5 }, { event: 'done', state: 'completed' }]
  });
  assert.deepEqual(await up.checkNow(), { kind: 'update' });
  await settle();
  assert.deepEqual(calls[1], ['download', '--silent-only'], 'a download nobody pressed can never raise Windows\' box');
  assert.ok(sent.some(s => s.stage === 'downloading' && s.percent === 50));
  assert.equal(up.state().stage, 'ready');
  assert.equal(up.state().next, '2.3.4');
});

test('an update Windows must ask about: available, and Download passes the window', async () => {
  const { up, calls } = make({
    check: [{ event: 'check', count: 1, version: '2.3.4.0', silent: false }],
    download: [{ event: 'done', state: 'completed' }]
  });
  await up.checkNow();
  assert.equal(up.state().stage, 'available');
  assert.deepEqual(await up.download(), { ok: true });
  await settle();
  assert.deepEqual(calls[1], ['download', '--hwnd=123']);
  assert.equal(up.state().stage, 'ready');
});

test('No in Windows\' download box: back to available', async () => {
  const { up } = make({ check: [{ event: 'check', count: 1, version: '2.3.4.0', silent: false }], download: [{ event: 'done', state: 'cancelled' }] });
  await up.checkNow(); await up.download(); await settle();
  assert.equal(up.state().stage, 'available');
});

test('a download that does not finish: the badge goes, failed is kept for the panel', async () => {
  const { up } = make({ check: [{ event: 'check', count: 1, version: '2.3.4.0', silent: true }], download: [{ event: 'done', state: 'failed' }] });
  await up.checkNow(); await settle();
  assert.equal(up.state().stage, 'none');
  assert.equal(up.state().failed, true);
});

test('Install: only when ready; asks Windows to reopen first; a Windows that never closes the app is a failed install', async () => {
  let reopen = 0;
  const { up, calls, fire } = make({
    check: [{ event: 'check', count: 1, version: '2.3.4.0', silent: true }],
    download: [{ event: 'done', state: 'completed' }],
    install: [{ event: 'start' }, { event: 'done', state: 'completed' }]
  }, { registerRestart: () => reopen++ });
  assert.deepEqual(await up.install(), { ok: false, reason: 'none' });
  await up.checkNow(); await settle();
  const result = up.install();
  await settle();
  assert.equal(reopen, 1);
  assert.deepEqual(calls.at(-1), ['install', '--hwnd=123']);
  fire(S.INSTALL_GRACE_MS);
  assert.deepEqual(await result, { ok: false, reason: 'failed' });
});

test('No in Windows\' install box: cancelled, so the panel goes back to ready', async () => {
  const { up } = make({
    check: [{ event: 'check', count: 1, version: '2.3.4.0', silent: true }],
    download: [{ event: 'done', state: 'completed' }],
    install: [{ event: 'done', state: 'cancelled' }]
  });
  await up.checkNow(); await settle();
  assert.deepEqual(await up.install(), { ok: false, reason: 'cancelled' });
  assert.equal(up.state().stage, 'ready');
});

test('once downloaded, a check asks the Store nothing', async () => {
  const { up, calls } = make({ check: [{ event: 'check', count: 1, version: '2.3.4.0', silent: true }], download: [{ event: 'done', state: 'completed' }] });
  await up.checkNow(); await settle();
  const n = calls.length;
  assert.deepEqual(await up.checkNow(), { kind: 'update' });
  assert.equal(calls.length, n);
});

// the panel's words, loaded as the page loads it
const panel = (() => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'app', 'update-panel.js'), 'utf8'), { window, document: {}, performance: { now: () => 0 } });
  return window.SievphovUpdatePanel;
})();

test('panel: badge words, sizes and time left', () => {
  assert.equal(panel.badgeText({ stage: 'downloading', percent: 44.6 }), '↓ Update 45%');
  assert.equal(panel.badgeText({ stage: 'ready' }), 'Update ready');
  assert.equal(panel.badgeText({ stage: 'available' }), 'Update available');
  assert.equal(panel.badgeText({ stage: 'none' }), '');
  assert.equal(panel.badgeText(null), '');
  assert.equal(panel.sizeText(12 * 1048576, 48 * 1048576), '12 of 48 MB');
  assert.equal(panel.timeLeftText(30, 1), 'less than a minute left');
  assert.equal(panel.timeLeftText(90, 1), 'about 2 minutes left');
  assert.equal(panel.timeLeftText(90, 0), '', 'no speed yet says nothing');
});

test('panel: ready names the new version and warns it may need opening again', () => {
  const p = panel.stageParts({ stage: 'ready', current: '2.3.3', next: '2.3.4', silent: true });
  assert.match(p.line, /close to install 2\.3\.4/);
  assert.match(p.line, /Start menu/);
  assert.equal(p.buttons.map(b => b[0]).join(' · '), 'Later · Install');
  assert.match(panel.stageParts({ stage: 'ready', current: '2.3.3', next: null, silent: false }).line, /install the update.*Windows may ask first/);
});
