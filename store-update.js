// Sievphov — the Microsoft Store copy's update state, behind the badge and panel (app/update-panel.js). The same as Sastra
// PDF's store-update.js (E:\_httdocs\SastraPDF; design there: docs/superpowers/specs/2026-11-05-store-update-panel-design.md),
// keep the two in step. Only the helper program (store-update/update.cpp) talks to the Store; this file starts it, reads its
// lines and keeps one state for the page. Any other copy (the installer, `pnpm start`) never reaches this file. No Electron
// here: main.js hands everything in, so the rules are plain-Node testable (tests/store-update.test.js).
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');

const FIRST_CHECK_MS = 10000;              // not while the window and its files are still opening
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const CHECK_TIMEOUT_MS = 60000;   // a helper that never answers a check is stopped: "Couldn't check"
const INSTALL_GRACE_MS = 60000;   // Windows closes the app to install; still running this long after "completed" = it didn't work
const INSTALL_DIED_GRACE_MS = 20000;   // the helper lives in the package being updated, so Windows may end it just before the app
const INSTALL_LIMIT_MS = 5 * 60 * 1000;   // an install still going after this (a hang, or Windows' box left open) is called off
const DOWNLOAD_STALL_MS = 30 * 60 * 1000;   // a download with no news for this long is called off: the next check tries again

// One line of the helper's output → the event, or null for anything else.
function parseLine(text) {
  let e; try { e = JSON.parse(text); } catch { return null; }
  return e && typeof e === 'object' && !Array.isArray(e) && typeof e.event === 'string' ? e : null;
}

const parts = v => /^\d+(\.\d+){2,3}$/.test(v) ? v.split('.').map(Number) : null;
// The version the Store reports (a package has four parts, "1.4.0.0") → "1.4.0", or null when it isn't newer than this copy:
// Microsoft doesn't clearly say the update's package carries the NEW version, so one that isn't newer is treated as unknown.
function nextVersion(current, reported) {
  const a = parts(current), b = parts(reported || '');
  if (!a || !b) return null;
  for (let i = 0; i < 4; i++) {
    const d = (b[i] || 0) - (a[i] || 0);
    if (d < 0) return null;
    if (d > 0) return b.length === 4 && b[3] === 0 ? b.slice(0, 3).join('.') : b.join('.');
  }
  return null;
}

// How a helper run starts: (args, onEvent) → { done, kill }. done always resolves, with no error: a run that printed no
// final line is how a helper that couldn't start or died shows up.
function makeRun({ command, prefix = [], env, log }) {
  return (args, onEvent) => {
    let child;
    const done = new Promise(res => {
      try { child = spawn(command, [...prefix, ...args], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], env }); }
      catch (e) { log('helper: ' + e.message); return res(); }
      let rest = '';
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', chunk => {
        const lines = (rest + chunk).split(/\r?\n/);
        rest = lines.pop();
        for (const l of lines) { const e = parseLine(l); if (e) onEvent(e); }
      });
      child.on('error', e => { log('helper: ' + e.message); res(); });
      child.on('close', () => res());
    });
    return { done, kill: () => { try { child && child.kill(); } catch {} } };
  };
}

function createStoreUpdater({ run, current, send, log, hwnd, taskOpen, registerRestart, timers = { setTimeout, setInterval, clearTimeout, clearInterval }, now = Date.now }) {
  const s = { stage: 'none', current, next: null, silent: true, percent: 0, transferred: 0, total: 0, bytesPerSecond: 0, failed: false };
  const live = new Set(); let checking = null, installing = null, first = null, every = null, stopped = false;
  const state = () => ({ ...s });
  const tell = () => { try { send(state()); } catch (e) { log('state not sent: ' + e.message); } };
  const withWindow = cmd => { let h = null; try { h = hwnd(); } catch {} return h ? [cmd, `--hwnd=${h}`] : [cmd]; };

  // asked: the person pressed Download. Otherwise it must never raise a Windows box over their work (--silent-only).
  function startDownload(asked) {
    Object.assign(s, { stage: 'downloading', percent: 0, transferred: 0, total: 0, bytesPerSecond: 0, failed: false });
    tell();
    let base = null, last = null, stall = null;
    const arm = () => {
      timers.clearTimeout(stall);
      stall = timers.setTimeout(() => { log('download stalled'); r.kill(); }, DOWNLOAD_STALL_MS);
    };
    const r = run(asked ? withWindow('download') : ['download', '--silent-only'], e => {
      arm();
      if (e.event === 'done') last = e.state;
      else if (e.event === 'error') log('download: ' + e.code);
      else if (e.event === 'progress' && s.stage === 'downloading') {
        const done = Number(e.done) || 0, total = Number(e.total) || 0;
        const percent = total > 0 ? done / total * 100 : (Number(e.fraction) || 0) * 100;
        if (!base) base = { at: now(), done };
        const secs = (now() - base.at) / 1000;
        Object.assign(s, { percent: Math.max(0, Math.min(100, Math.round(percent))), transferred: done, total, bytesPerSecond: secs > 0 ? (done - base.done) / secs : 0 });
        tell();
      }
    });
    live.add(r);
    arm();
    r.done.then(() => {
      timers.clearTimeout(stall);
      live.delete(r);
      if (stopped) return;
      if (last === 'completed') Object.assign(s, { stage: 'ready', percent: 100 });
      else if (last === 'cancelled') s.stage = s.silent ? 'none' : 'available';
      else if (last === 'nothing') s.stage = 'none';
      else { log('download did not finish: ' + (last || 'no answer')); Object.assign(s, { stage: 'none', failed: true }); }
      tell();
    });
  }

  function checkNow() {
    if (s.stage === 'downloading' || s.stage === 'ready') return Promise.resolve({ kind: 'update' });
    if (checking) return checking;
    if (s.failed) { s.failed = false; tell(); }
    let answer = null;
    const r = run(['check'], e => {
      if (e.event === 'check') answer = e;
      else if (e.event === 'error') log('check: ' + e.code);
    });
    live.add(r);
    const limit = timers.setTimeout(() => r.kill(), CHECK_TIMEOUT_MS);
    checking = r.done.then(() => {
      timers.clearTimeout(limit);
      live.delete(r);
      checking = null;
      if (!answer || stopped) return { kind: 'failed' };
      if (s.stage === 'downloading' || s.stage === 'ready') return { kind: 'update' };   // Download was pressed meanwhile
      if (!(answer.count > 0)) {
        if (s.stage !== 'none') { s.stage = 'none'; tell(); }
        return { kind: 'current' };
      }
      s.next = nextVersion(current, answer.version);
      s.silent = answer.silent === true;
      if (s.silent) startDownload(false);
      else { s.stage = 'available'; tell(); }
      return { kind: 'update' };
    });
    return checking;
  }

  function download() {
    if (s.stage !== 'available') return Promise.resolve({ ok: false });
    startDownload(true);
    return Promise.resolve({ ok: true });
  }

  function install() {
    if (installing) return installing;
    if (s.stage !== 'ready') return Promise.resolve({ ok: false, reason: 'none' });
    if (taskOpen()) return Promise.resolve({ ok: false, reason: 'task' });
    try { registerRestart(); } catch (e) { log('reopen not set up: ' + e.message); }   // the panel warned; the update still goes in
    let last = null, started = false, called = false;
    const r = run(withWindow('install'), e => {
      if (e.event === 'start') started = true;
      else if (e.event === 'done') last = e.state;
      else if (e.event === 'error') { last = 'error'; log('install: ' + e.code); }
    });
    const limit = timers.setTimeout(() => { called = true; log('install took too long'); r.kill(); }, INSTALL_LIMIT_MS);
    installing = r.done.then(() => {
      timers.clearTimeout(limit);
      if (last === 'cancelled') return { ok: false, reason: 'cancelled' };
      // "completed", or a helper ended with nothing said: Windows may be closing everything, so keep going and wait to be closed
      const closing = last === 'completed' || (last === null && started && !called);
      if (!closing) { log('install did not finish: ' + (last || 'no answer')); return { ok: false, reason: 'failed' }; }
      return new Promise(res => timers.setTimeout(() => {
        log('install: Windows did not close the app');
        res({ ok: false, reason: 'failed' });
      }, last === 'completed' ? INSTALL_GRACE_MS : INSTALL_DIED_GRACE_MS));
    }).then(result => { installing = null; return result; });
    return installing;
  }

  const quietCheck = () => { checkNow().catch(e => log('check: ' + e.message)); };
  return {
    start() { first = timers.setTimeout(quietCheck, FIRST_CHECK_MS); every = timers.setInterval(quietCheck, CHECK_EVERY_MS); },
    state, checkNow, download, install,
    // the app is closing: a check or download has no one left to tell. An install goes on: closing is part of it.
    stop() {
      stopped = true;
      timers.clearTimeout(first); timers.clearInterval(every);
      for (const r of live) r.kill();
    }
  };
}

// %TEMP%\Sievphov\update.log: offline and broken checks are only written here, never shown.
function logTo(file) {
  return msg => { try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.appendFileSync(file, `${new Date().toISOString()} ${msg}\r\n`); } catch {} };
}

module.exports = { logTo, FIRST_CHECK_MS, CHECK_EVERY_MS, CHECK_TIMEOUT_MS, INSTALL_GRACE_MS, INSTALL_DIED_GRACE_MS, INSTALL_LIMIT_MS, DOWNLOAD_STALL_MS, parseLine, nextVersion, makeRun, createStoreUpdater };
