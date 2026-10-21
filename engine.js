// Sievphov — talks to the print engine (engine/src/Sievphov.Engine, a hidden C# helper) for main.js.
// No Electron inside, so tests can load it. One JSON object per line each way:
//   → { id, cmd, ...args }      ← { id, ok, result } | { id, ok:false, error, reason }
//   ← { event: 'ready' | 'progress' | 'done', ... } (events have no id)
// The helper starts on the first request and again after it stops unexpectedly.
// `fake: true` (SIEVPHOV_FAKE_ENGINE=1, or not on Windows) answers in JS instead: made-up printers, page counts
// read from the file, drawn previews and a printing run that only waits — for working on the screens and for tests.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function createEngine({ exe, fake = false, log = () => {}, missing = 'The print engine is missing (Sievphov.Engine.exe). Reinstall Sievphov.' }) {
  const listeners = new Set();
  const emit = ev => { for (const fn of listeners) { try { fn(ev); } catch (e) { log('listener: ' + e.message); } } };
  if (fake) return fakeEngine(emit, listeners);

  let child = null, nextId = 1, buffer = '';
  const waiting = new Map();

  function start() {
    if (child) return child;
    if (!fs.existsSync(exe)) throw Object.assign(new Error(missing), { reason: 'engine' });
    log('engine: start ' + exe);
    child = spawn(exe, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      buffer += chunk;
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) onLine(line);
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', t => log('engine stderr: ' + t.trim()));
    const gone = why => {
      if (!child) return;
      log('engine: stopped (' + why + ')');
      child = null; buffer = '';
      for (const w of waiting.values()) w.reject(Object.assign(new Error('The print engine stopped unexpectedly.'), { reason: 'engine' }));
      waiting.clear();
      emit({ event: 'stopped' });
    };
    child.on('exit', code => gone('exit ' + code));
    child.on('error', e => gone(e.message));
    return child;
  }

  function onLine(line) {
    let msg;
    try { msg = JSON.parse(line); } catch { log('engine: bad line ' + line.slice(0, 200)); return; }
    if (msg.event) { emit(msg); return; }
    const w = waiting.get(msg.id);
    if (!w) return;
    waiting.delete(msg.id);
    if (msg.ok) w.resolve(msg.result);
    else w.reject(Object.assign(new Error(msg.error || 'Engine error'), { reason: msg.reason || 'other' }));
  }

  return {
    fake: false,
    request(cmd, args = {}) {
      return new Promise((resolve, reject) => {
        let c;
        try { c = start(); } catch (e) { reject(e); return; }
        const id = nextId++;
        waiting.set(id, { resolve, reject });
        c.stdin.write(JSON.stringify({ ...args, id, cmd }) + '\n');
      });
    },
    onEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    stop() { if (child) { try { child.stdin.write('{"cmd":"quit"}\n'); } catch {} child = null; } }
  };
}

/* ------------------------------------------------------------------ the stand-in engine */

const FAKE_PRINTERS = [
  { name: 'HP LaserJet Pro 4303', isDefault: true, caps: { paperSizes: ['A4', 'A5', 'A3', 'Letter', 'Legal'], trays: ['Automatically Select', 'Tray 1 (Manual feed)', 'Tray 2', 'Tray 3'], canDuplex: true, supportsColor: true, exists: true } },
  { name: 'HP LaserJet M507', isDefault: false, caps: { paperSizes: ['A4', 'A5', 'Letter', 'Legal'], trays: ['Automatically Select', 'Tray 1', 'Tray 2'], canDuplex: true, supportsColor: false, exists: true } },
  { name: 'TallyGenicom 1330', isDefault: false, caps: { paperSizes: ['A4', 'Letter', 'Fanfold 15 x 11 in'], trays: ['Tractor', 'Manual Feed'], canDuplex: false, supportsColor: false, exists: true } },
  { name: 'Microsoft Print to PDF', isDefault: false, caps: { paperSizes: ['A4', 'A3', 'A5', 'Letter', 'Legal'], trays: [], canDuplex: false, supportsColor: true, exists: true } }
];

// Rough page count and sizes from the file itself (enough for the stand-in): /Type /Page objects and MediaBoxes.
function fakeOpen(file) {
  const text = fs.readFileSync(file, 'latin1');
  if (!text.startsWith('%PDF')) throw Object.assign(new Error('Not a valid PDF (file is broken)'), { reason: 'damaged' });
  if (/\/Encrypt\b/.test(text)) throw Object.assign(new Error('Locked with a password'), { reason: 'password' });
  const n = Math.max(1, (text.match(/\/Type\s*\/Page(?!s)/g) || []).length);
  const boxes = [...text.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map(m => [m[3] - m[1], m[4] - m[2]]);
  const pageSizes = Array.from({ length: n }, (_, i) => boxes[i] || boxes[0] || [595, 842]);
  return { pageCount: n, pageSizes, password: null };
}

function fakePages(s, n) {
  let pages = Array.from({ length: n }, (_, i) => i + 1);
  if (s.Pages === 'Odd') pages = pages.filter(p => p % 2);
  if (s.Pages === 'Even') pages = pages.filter(p => !(p % 2));
  if (s.Pages === 'Range' && s.PageRange && s.PageRange.trim()) {
    pages = [];
    for (const raw of s.PageRange.split(/[,;]/)) {
      const t = raw.trim().toLowerCase().replace(/\s/g, '');
      if (!t) continue;
      const num = x => x === 'last' ? n : /^\d+$/.test(x) && +x >= 1 ? +x : NaN;
      const m = /^(.+?)-(.+)$/.exec(t);
      if (m) { const a = num(m[1]), b = num(m[2]); if (isNaN(a) || isNaN(b)) throw new Error(`"${raw.trim()}" is not a page or range. Use e.g. 1-5, 8, 12-last.`); for (let p = a; a <= b ? p <= Math.min(b, n) : p >= b; a <= b ? p++ : p--) if (p <= n) pages.push(p); }
      else { const a = num(t); if (isNaN(a)) throw new Error(`"${raw.trim()}" is not a page or range. Use e.g. 1-5, 8, 12-last.`); if (a <= n) pages.push(a); }
    }
  }
  if (s.Reverse) pages.reverse();
  return pages;
}

function fakeSides(s, pages) {
  const twoSided = s.Layout === 'Booklet' || (s.Sides && s.Sides !== 'OneSide');
  if (s.Layout === 'Booklet') {
    const n = Math.ceil(pages.length / 4) * 4, at = p => p <= pages.length ? pages[p - 1] : null, out = [];
    for (let k = 0; k < n / 4; k++) {
      let f = [at(n - 2 * k), at(2 * k + 1)], b = [at(2 * k + 2), at(n - 2 * k - 1)];
      if (s.Binding === 'Right') { f.reverse(); b.reverse(); }
      out.push({ sheet: k, isBack: false, slots: f }, { sheet: k, isBack: true, slots: b });
    }
    return { sides: out, twoSided };
  }
  const per = s.Layout === 'PagesPerSheet' ? Math.max(1, s.Columns || 1) * Math.max(1, s.Rows || 1) : 1, out = [];
  for (let i = 0, k = 0; i < pages.length; i += per, k++) {
    const slots = Array.from({ length: per }, (_, j) => pages[i + j] ?? null);
    out.push(twoSided ? { sheet: k >> 1, isBack: !!(k & 1), slots } : { sheet: k, isBack: false, slots });
  }
  return { sides: out, twoSided };
}

function fakeEstimate(s, n, blank = false) {
  try {
    if (blank) s = { ...s, Pages: 'All', Reverse: false };   // blank paper: one empty page, Copies times (as PrintEngine)
    const pages = fakePages(s, blank ? 1 : n);
    if (!pages.length) return { pagesSelected: 0, pagesPrinted: 0, sides: 0, sheets: 0, error: 'No pages selected' };
    const { sides, twoSided } = fakeSides(s, pages), copies = Math.max(1, s.Copies || 1);
    const perCopy = twoSided ? new Set(sides.map(x => x.sheet)).size : sides.length;
    return { pagesSelected: pages.length, pagesPrinted: blank ? 0 : pages.length * copies, sides: sides.length, sheets: perCopy * copies, error: null };
  } catch (e) { return { pagesSelected: 0, pagesPrinted: 0, sides: 0, sheets: 0, error: e.message }; }
}

// A drawn sheet: white paper, the page slots with their page numbers, the printable edge dashed.
function fakePreview(item, side, maxPx) {
  const s = item.blank ? { ...item.settings, Pages: 'All' } : item.settings || {}, pages = fakePages(s, item.blank ? 1 : item.pageCount);
  const { sides, twoSided } = fakeSides(s, pages);
  if (!sides.length) throw new Error('No pages selected (check the page range)');
  const i = Math.max(0, Math.min(sides.length - 1, side | 0)), sd = sides[i];
  const first = item.pageSizes[(pages[0] || 1) - 1] || [595, 842];
  const landscape = s.Layout === 'Booklet' || s.Orientation === 'Landscape' ||
    (s.Orientation !== 'Portrait' && (s.Layout === 'PagesPerSheet' ? (s.Columns || 1) > (s.Rows || 1) : first[0] > first[1]));
  const W = landscape ? 1169 : 827, H = landscape ? 827 : 1169, m = 25;
  const cols = s.Layout === 'Booklet' ? 2 : s.Layout === 'PagesPerSheet' ? Math.max(1, s.Columns || 1) : 1;
  const rows = s.Layout === 'PagesPerSheet' ? Math.max(1, s.Rows || 1) : 1;
  const gw = (W - 2 * m) / cols, gh = (H - 2 * m) / rows;
  let cells = '';
  sd.slots.forEach((p, k) => {
    const c = k % cols, r = Math.floor(k / cols), x = m + c * gw + 8, y = m + r * gh + 8, w = gw - 16, h = gh - 16;
    if (p == null || item.blank) return;
    cells += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fafafa" stroke="#bbb"/>` +
      `<rect x="${x + 16}" y="${y + 16}" width="${w * 0.5}" height="14" fill="#ddd"/>` +
      Array.from({ length: 9 }, (_, j) => `<rect x="${x + 16}" y="${y + 50 + j * 26}" width="${w - 32 - (j % 3) * 30}" height="8" fill="#e6e6e6"/>`).join('') +
      `<text x="${x + w / 2}" y="${y + h / 2}" font-family="Segoe UI, sans-serif" font-size="${Math.min(90, w / 4)}" fill="#999" text-anchor="middle" dominant-baseline="middle">${p}</text>` +
      (s.PageNumbers && s.PageNumbers.Enabled ? `<text x="${x + w / 2}" y="${y + h - 18}" font-size="16" fill="#333" text-anchor="middle">${p}</text>` : '') +
      (s.Watermark && s.Watermark.Enabled ? `<text x="${x + w / 2}" y="${y + h / 2}" font-size="${Math.min(60, w / 6)}" fill="${s.Watermark.Color || '#f00'}" opacity=".3" text-anchor="middle" transform="rotate(-${s.Watermark.Angle ?? 45} ${x + w / 2} ${y + h / 2})">${String(s.Watermark.Text || '').replace(/[<&>]/g, '')}</text>` : '');
  });
  // a booklet's fold (the spine), as the real engine draws it in previews
  const fold = s.Layout === 'Booklet'
    ? `<line x1="${W / 2}" y1="0" x2="${W / 2}" y2="${H}" stroke="#6a3fd8" stroke-opacity=".8" stroke-width="2.5" stroke-dasharray="14 5 3 5"/>` +
      `<rect x="${W / 2 - 80}" y="9" width="160" height="28" rx="14" fill="#fff" stroke="#6a3fd8" stroke-opacity=".8" stroke-width="1.5"/>` +
      `<text x="${W / 2}" y="24" font-family="Segoe UI, sans-serif" font-size="18" font-weight="700" fill="#6a3fd8" text-anchor="middle" dominant-baseline="middle">Fold · spine</text>`
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${cells}` +
    `<rect x="${m}" y="${m}" width="${W - 2 * m}" height="${H - 2 * m}" fill="none" stroke="#6a3fd8" stroke-opacity=".45" stroke-dasharray="6 5"/>${fold}</svg>`;
  return {
    png: null, svg: Buffer.from(svg).toString('base64'), side: i, sides: sides.length, sheet: sd.sheet + 1, isBack: sd.isBack, twoSided,
    slots: sd.slots, widthIn: W / 100, heightIn: H / 100
  };
}

function fakeEngine(emit, listeners) {
  let run = null;
  const ok = v => Promise.resolve(v);
  const fail = e => Promise.reject(Object.assign(new Error(e.message), { reason: e.reason || 'other' }));
  const cmds = {
    printers: () => FAKE_PRINTERS.map(p => ({ name: p.name, isDefault: p.isDefault })),
    caps: a => (FAKE_PRINTERS.find(p => p.name === a.name) || FAKE_PRINTERS.find(p => p.isDefault)).caps,
    open: a => fakeOpen(a.path),
    estimate: a => (a.items || []).map(it => fakeEstimate(it.settings || {}, it.pageCount | 0, !!it.blank)),
    preview: a => fakePreview(a.item, a.side, a.maxPx),
    print: a => {
      if (run) throw new Error('Already printing');
      const items = a.items || [], report = [];
      run = { paused: false, stopped: false };
      const r = run;
      // as PrintEngine.RunAll: the whole list `repeat` times, set after set; a file with an error is skipped afterwards
      const repeat = Math.max(1, Math.min(999, a.repeat | 0 || 1)), count = items.length * repeat;
      const rows = items.map(it => ({ id: it.id, fileName: it.blank ? 'Blank paper' : path.basename(it.path), folder: it.blank ? '' : path.dirname(it.path), printer: it.settings.PrinterName || FAKE_PRINTERS[0].name,
        copies: it.settings.Copies || 1, pages: 0, sheets: 0, sets: 0, status: '', message: '', started: new Date().toISOString() }));
      const failed = new Set();
      (async () => {
        for (let set = 0; set < repeat; set++) {
          const label = repeat > 1 ? `Set ${set + 1} of ${repeat} · ` : '';
          for (let f = 0; f < items.length; f++) {
            const it = items[f], row = rows[f], k = set * items.length + f, est = fakeEstimate(it.settings || {}, it.pageCount, !!it.blank);
            const prog = (status, message, done) => emit({ event: 'progress', progress: { id: it.id, status, message, file: k + 1, files: count, fraction: done / count } });
            if (failed.has(f)) continue;
            if (r.stopped) { row.status = 'Stopped'; row.message = row.sets ? `Not printed (stopped) — ${row.sets} sets printed` : 'Not printed (stopped)'; failed.add(f); prog('stopped', row.message, k); continue; }
            if (est.error) { row.status = 'Error'; row.message = est.error; failed.add(f); prog('error', est.error, k + 1); continue; }
            const sides = Math.max(1, est.sides * (it.settings.Copies || 1));
            for (let n = 1; n <= sides && !r.stopped; n++) {
              while (r.paused && !r.stopped) await new Promise(res => setTimeout(res, 100));
              await new Promise(res => setTimeout(res, 120 / repeat));
              emit({ event: 'progress', progress: { id: it.id, status: 'printing', message: `${label}Side ${n} of ${sides}`, side: n, sides, file: k + 1, files: count, fraction: (k + n / sides) / count } });
            }
            if (r.stopped) { row.status = 'Stopped'; row.message = 'Stopped while printing'; failed.add(f); prog('stopped', row.message, k + 1); continue; }
            row.pages += est.pagesPrinted; row.sheets += est.sheets; row.sets++;
            if (row.sets < repeat) { prog('wait', `${row.sets} of ${repeat} sets printed`, k + 1); continue; }
            row.status = 'Printed'; row.message = repeat > 1 ? `${repeat} sets` : ''; row.finished = new Date().toISOString();
            prog('printed', row.message, k + 1);
          }
        }
        report.push(...rows);
        run = null;
        emit({ event: 'done', report });
      })();
      return { started: true };
    },
    pause: () => { if (run) run.paused = true; return null; },
    resume: () => { if (run) run.paused = false; return null; },
    stop: () => { if (run) run.stopped = true; return null; }
  };
  return {
    fake: true,
    request(cmd, args = {}) {
      const f = cmds[cmd];
      if (!f) return fail({ message: `Unknown command "${cmd}"` });
      try { return ok(f(args)); } catch (e) { return fail(e); }
    },
    onEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    stop() {}
  };
}

module.exports = { createEngine, FAKE_PRINTERS, _fake: { fakePages, fakeSides, fakeEstimate } };
