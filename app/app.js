// Sievphov — the window: the file list, presets, the settings panel, printing, preview, jobs and the app's own boxes.
// The rules for presets and settings live in model.js (tested in node); the printing itself is the C# engine
// (main.js → engine.js → Sievphov.Engine.exe), reached through window.sievphov (preload.js).
(() => {
'use strict';
const M = window.SievphovModel;
const desk = window.sievphov || null;

/* ---------- icons (the same line icons as Sastra PDF, plus a few) ---------- */
const ICONS = {
  open:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v5M9.5 13.5h5"/>',
  addfile:'<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M12 11v7M8.5 14.5h7"/>',
  save:'<path d="M6 4h10l4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M8 4v4h7V4M8 20v-5h8v5"/>',
  print:'<path d="M7 9V4h10v5"/><path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v6H7z"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  up:'<path d="M6 15l6-6 6 6"/>', down:'<path d="M6 9l6 6 6-6"/>', left:'<path d="M15 6l-6 6 6 6"/>', right:'<path d="M9 6l6 6-6 6"/>',
  eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  calc:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 7h7M8.5 11h1M12 11h1M15 11h.5M8.5 14.5h1M12 14.5h1M15 14.5h.5M8.5 18h1M12 18h3.5"/>',
  stack:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12.5l9 5 9-5M3 16.5l9 5 9-5"/>',
  blank:'<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5"/>',
  doc:'<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M8.5 13h7M8.5 16.5h7"/>',
  printer:'<path d="M7 9V4h10v5"/><path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v6H7z"/>',
  pages:'<rect x="4" y="5" width="11" height="15" rx="1.5"/><path d="M8 3h10.5A1.5 1.5 0 0 1 20 4.5V17"/>',
  odd:'<rect x="5" y="4" width="14" height="16" rx="1.5"/><path d="M11 9l1.5-1v8"/>',
  even:'<rect x="5" y="4" width="14" height="16" rx="1.5"/><path d="M10 9.5a2 2 0 1 1 3.4 1.4L10 15.5h4.5"/>',
  range:'<rect x="5" y="4" width="14" height="16" rx="1.5"/><path d="M8.5 12h7M8.5 9h2M13.5 15h2"/>',
  paper:'<rect x="6" y="3" width="12" height="18" rx="1.5"/>',
  tray:'<path d="M3 13l3-8h12l3 8v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/>',
  oneside:'<rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M9 8h6M9 11.5h6M9 15h4"/>',
  longedge:'<rect x="4" y="3" width="11" height="16" rx="1.5"/><path d="M9 21h9.5a1.5 1.5 0 0 0 1.5-1.5V7"/><path d="M17 4.5l3 2.5-3 2.5"/>',
  shortedge:'<rect x="3" y="4" width="16" height="11" rx="1.5"/><path d="M21 9v9.5a1.5 1.5 0 0 1-1.5 1.5H7"/><path d="M9.5 17l-2.5 3 2.5 3"/>',
  normal:'<rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M9 7h6v5H9z"/>',
  nup:'<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M12 5v14M6 9h3M15 9h3"/>',
  booklet:'<path d="M12 6c-2-1.6-5-2-8-1.5v14c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-14c-3-.5-6-.1-8 1.5z"/><path d="M12 6v14"/>',
  auto:'<rect x="4" y="6" width="9" height="13" rx="1.5"/><rect x="11" y="4" width="9" height="6" rx="1.2"/><path d="M15 13.5a3.5 3.5 0 0 1-3.5 3.5"/>',
  portrait:'<rect x="6" y="3" width="12" height="18" rx="1.5"/>', landscape:'<rect x="3" y="6" width="18" height="12" rx="1.5"/>',
  hash:'<path d="M5 9h14M5 15h14M10 4l-2 16M16 4l-2 16"/>', text:'<path d="M5 6V4.5h14V6M12 4.5v15M9 19.5h6"/>', image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5L5 20"/>',
  import:'<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15"/>',
  export:'<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  paste:'<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 13.5h6M9 17h4"/>',
  reset:'<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 3.5V9h5.5"/>', check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>', uncheck:'<rect x="4" y="4" width="16" height="16" rx="3"/>',
  pause:'<path d="M8 5v14M16 5v14"/>', stop:'<rect x="6" y="6" width="12" height="12" rx="1.5"/>', plus:'<path d="M12 5v14M5 12h14"/>', star:'<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>', close:'<path d="M6 6l12 12M18 6L6 18"/>', edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  sys:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', color:'<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M12 3.5a8.5 8.5 0 0 1 0 17" fill="currentColor"/>',
  quality:'<path d="M4 18l4-12 4 9 3-5 5 8"/>', fit:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 4v3M15 4v3M9 20v-3M15 20v-3M4 9h3M4 15h3M20 9h-3M20 15h-3"/>',
  web:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/>',
  linkedin:'<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M5.5 2.5h13a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3h-13a3 3 0 0 1-3-3v-13a3 3 0 0 1 3-3zM8 6.1a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zM6.8 10.1h2.4v7.6H6.8zM11 10.1h2.3v1.1c.4-.7 1.3-1.3 2.6-1.3 2.2 0 2.9 1.4 2.9 3.5v4.3h-2.4v-3.9c0-1-.3-1.8-1.3-1.8s-1.7.8-1.7 1.9v3.8H11z"/>',
  github:'<path fill="currentColor" stroke="none" d="M12 2.2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2.2z"/>'
};
const svg = n => `<svg class="i" viewBox="0 0 24 24">${ICONS[n] || ''}</svg>`;
document.querySelectorAll('svg[data-i]').forEach(s => { s.setAttribute('viewBox', '0 0 24 24'); s.innerHTML = ICONS[s.dataset.i] || ''; });

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

/* ---------- state ---------- */
const state = {
  items: [],              // see model.js
  sel: new Set(),         // ids of selected items
  anchor: null,           // Shift+click range start
  lib: M.starterLibrary(),
  settings: { IncludeSubfolders: true, AfterPrint: 'Nothing', AfterPrintFolder: '', Passwords: [], TraySwaps: [] },   // TraySwaps: [{ Printer, From, To }]
  printers: [],           // [{ name, isDefault }]
  caps: new Map(),        // printer name → { paperSizes, trays, canDuplex, supportsColor, exists }
  est: new Map(),         // item id → estimate from the engine
  jobPath: null, jobDirty: false,
  printing: null,         // { paused, ids, fraction } while printing
  busy: 0, busyText: '',
  clipboard: null,
  sort: { key: null, dir: 1 },
  presetPick: null,       // the preset chosen in the panel's dropdown
  repeat: 1               // print the whole list this many times (sets), saved in the job
};
let uid = 0;
const newItemId = () => 'f' + (++uid);
const byId = id => state.items.find(it => it.id === id) || null;
const selected = () => state.items.filter(it => state.sel.has(it.id));
const ticked = () => state.items.filter(it => it.checked && it.pageCount > 0 && it.status !== 'locked');
const defaultPrinter = () => (state.printers.find(p => p.isDefault) || state.printers[0] || {}).name || '';
const printerOf = s => s.PrinterName || defaultPrinter();

/** The engine, through main.js; rejects with .reason ('password' | 'damaged' | 'missing' | 'engine' | 'other'). */
async function eng(cmd, args) {
  if (!desk) throw Object.assign(new Error('Sievphov must run as the desktop app.'), { reason: 'engine' });
  const r = await desk.engine(cmd, args);
  if (r.ok) return r.result;
  throw Object.assign(new Error(r.error || 'Engine error'), { reason: r.reason || 'other' });
}
const engItem = it => ({ id: it.id, path: it.path, blank: !!it.blank, password: it.password || null, pageCount: it.pageCount, pageSizes: it.pageSizes, settings: it.settings });
const estItem = it => ({ settings: it.settings, pageCount: it.pageCount, blank: !!it.blank });

/* ---------- small boxes: toast, question, text, busy (no Windows message boxes, as in Sastra PDF) ---------- */
let toastT = 0;
function toast(msg, err) {
  let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.toggle('err', !!err); t.style.opacity = '1';
  clearTimeout(toastT); toastT = setTimeout(() => { t.style.opacity = '0'; }, err ? 5200 : 2600);
}
const anyModal = () => !!document.querySelector('.modal-bg');
/** A box on <body>: returns { bg, box, close }. Esc / a click outside call onCancel (default: close). */
function openBox(cls, html, { onCancel, full = false } = {}) {
  const back = document.activeElement;
  const bg = document.createElement('div'); bg.className = 'modal-bg' + (full ? ' full-screen' : '');
  bg.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  const box = bg.firstElementChild;
  const close = () => { bg.remove(); document.removeEventListener('keydown', key, true); back?.focus?.({ preventScroll: true }); };
  const cancel = () => (onCancel ? onCancel() : close());
  const key = e => { if (e.key === 'Escape' && bg === [...document.querySelectorAll('.modal-bg')].pop()) { e.stopPropagation(); e.preventDefault(); cancel(); } };
  bg.addEventListener('mousedown', e => { if (e.target === bg && !full) cancel(); });
  document.addEventListener('keydown', key, true);
  document.body.appendChild(bg);
  return { bg, box, close };
}
// buttons = [[label, 'outline'|'primary'], …]; the first is Cancel (also Esc / outside), the last has the focus → index
function askChoice(msg, buttons, { detail = '', names = [], html = '' } = {}) {
  return new Promise(res => {
    const { box, close } = openBox('ask', `<p>${esc(msg)}</p>${detail ? `<p class="detail">${esc(detail)}</p>` : ''}${html}` +
      (names.length ? `<ul class="names">${names.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : '') +
      `<div class="acts">${buttons.map(([l, k], i) => `<button class="btn ${k}" data-r="${i}">${esc(l)}</button>`).join('')}</div>`,
      { onCancel: () => { close(); res(0); } });
    box.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) { close(); res(+b.dataset.r); } });
    box.querySelector(`[data-r="${buttons.length - 1}"]`).focus();
  });
}
const askConfirm = async (msg, ok, detail) => (await askChoice(msg, [['Cancel', 'outline'], [ok, 'primary']], { detail })) === 1;
/** A typed answer: → { text, checked } or null. */
function askText(title, question, { value = '', password = false, check = null, ok = 'OK' } = {}) {
  return new Promise(res => {
    const { box, close } = openBox('ask', `<h2>${esc(title)}</h2><div class="field"><label class="flabel" for="askIn">${esc(question)}</label>
      <input id="askIn" type="${password ? 'password' : 'text'}" value="${esc(value)}" autocomplete="off"></div>
      ${check ? `<label class="chk"><input type="checkbox" id="askChk">${esc(check)}</label>` : ''}
      <div class="acts"><button class="btn outline" data-r="0">Cancel</button><button class="btn primary" data-r="1">${esc(ok)}</button></div>`,
      { onCancel: () => { close(); res(null); } });
    const input = box.querySelector('#askIn');
    const done = r => { const text = input.value; const checked = !!box.querySelector('#askChk')?.checked; close(); res(r && (password || text.trim()) ? { text: password ? text : text.trim(), checked } : null); };
    box.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) done(b.dataset.r === '1'); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); done(true); } });
    input.focus(); input.select();
  });
}
function busy(text) {
  state.busy++; state.busyText = text || state.busyText; renderStatus();
  return { update(t) { state.busyText = t; renderStatus(); }, done() { state.busy = Math.max(0, state.busy - 1); if (!state.busy) state.busyText = ''; renderStatus(); } };
}

/* ---------- describing settings in words ---------- */
const SIDES = { OneSide: '1-sided', LongEdge: '2-sided (long edge)', ShortEdge: '2-sided (short edge)' };
const BOOKLET_ONLY = { Both: '', Front: ' · fronts only', Back: ' · backs only' };
const sidesText = s => s.Layout === 'Booklet' ? 'Booklet' + BOOKLET_ONLY[s.BookletSides] : s.Layout === 'PagesPerSheet' ? `${s.Columns * s.Rows} per sheet · ${SIDES[s.Sides]}` : SIDES[s.Sides];
const trayText = s => s.Tray || 'As in printer';
const bindingText = s => `Booklet, bound on the ${s.Binding === 'Right' ? 'right' : 'left'}${BOOKLET_ONLY[s.BookletSides]}`;
function describe(s) {
  const bits = [s.PrinterName || 'Default printer'];
  if (s.Tray) bits.push(s.Tray);
  bits.push(sidesText(s));
  if (s.Copies > 1) bits.push(plural(s.Copies, 'copy', 'copies'));
  if (s.Pages !== 'All') bits.push(s.Pages === 'Range' ? `pages ${s.PageRange || 'all'}` : s.Pages.toLowerCase() + ' pages');
  if (s.Grayscale) bits.push('grayscale');
  return bits.join(' · ');
}
// a page range as the engine reads it (PageRangeParser.cs): "1-5, 8, 12-last", odd, even, all
function rangeError(text) {
  for (const raw of String(text || '').split(/[,;]/)) {
    const t = raw.trim().toLowerCase().replace(/\s/g, '');
    if (!t || ['odd', 'even', 'all'].includes(t)) continue;
    const ok = x => x === 'last' || (/^\d+$/.test(x) && +x >= 1);
    const m = /^(.+?)-(.+)$/.exec(t);
    if (m ? !(ok(m[1]) && ok(m[2])) : !ok(t)) return `"${raw.trim()}" is not a page or range. Use e.g. 1-5, 8, 12-last.`;
  }
  return null;
}

/* ================================================================== the file list */
const rowsEl = $('#rows'), listEl = $('#list');
const STATUS_WORD = { wait: 'Wait', printing: 'Printing', printed: 'Printed', error: 'Error', stopped: 'Stopped', locked: 'Locked' };
function statusOf(it) {
  const e = state.est.get(it.id);
  if (it.status === 'wait' && e && e.error) return { cls: 'check', text: 'Check pages', tip: e.error };
  if ((it.status === 'wait' || it.status === 'error') && it.pageCount === 0) return { cls: 'error', text: "Can't read", tip: it.message };
  const text = (it.status === 'printing' || (it.status === 'wait' && state.printing)) && it.message ? it.message : STATUS_WORD[it.status];
  return { cls: it.status, text, tip: it.message || text };
}
const presetChip = it => it.presetName != null
  ? `<span class="chip preset-chip" title="${esc(it.presetName + (it.modified ? ' — changed by hand' : ''))}"><span class="cl">${esc(it.presetName)}</span>${it.modified ? '<span class="star">*</span>' : ''}</span>`
  : `<span class="chip own"><span class="cl">${esc(M.presetLabel(it))}</span></span>`;
function rowHtml(it, i) {
  const s = it.settings, st = statusOf(it);
  const chip = presetChip(it);
  return `<div class="row${state.sel.has(it.id) ? ' sel' : ''}${it.checked ? '' : ' off'}${it.blank ? ' blank' : ''}" data-id="${it.id}" draggable="true" role="option" aria-selected="${state.sel.has(it.id)}" title="${esc(it.blank ? BLANK_TIP : it.path)}">
    <span class="center"><input type="checkbox" class="tick" ${it.checked ? 'checked' : ''} ${it.pageCount ? '' : 'disabled'} aria-label="Print this file"></span>
    <span class="num">${i + 1}</span>
    <span class="file"><span class="doc">${svg(it.blank ? 'blank' : 'doc')}</span><span class="nm"><b>${esc(it.name)}</b><small>${esc(it.folder)}</small></span></span>
    <span class="pages">${it.blank ? '—' : it.pageCount || '—'}</span>
    <span class="meta">${chip}</span>
    <span class="meta${s.PrinterName ? '' : ' dim'}">${esc(s.PrinterName || 'Default printer')}</span>
    <span class="meta c-tray${s.Tray ? '' : ' dim'}">${esc(trayText(s))}</span>
    <span class="meta c-sides">${esc(sidesText(s))}</span>
    <span class="pages center">${s.Copies}</span>
    <span><span class="pill ${st.cls}" title="${esc(st.tip)}">${esc(st.text)}</span></span>
  </div>`;
}
function renderRows() {
  const top = rowsEl.scrollTop;
  rowsEl.innerHTML = state.items.map(rowHtml).join('');
  rowsEl.scrollTop = top;
  $('#empty').hidden = state.items.length > 0;
  const n = state.items.filter(it => it.pageCount > 0), t = n.filter(it => it.checked);
  const all = $('#tickAll'); all.checked = n.length > 0 && t.length === n.length; all.indeterminate = t.length > 0 && t.length < n.length; all.disabled = !n.length;
  document.querySelectorAll('#listHead [data-sort]').forEach(b => {
    b.querySelector('.arrow')?.remove();
    if (b.dataset.sort === state.sort.key) b.insertAdjacentHTML('beforeend', `<span class="arrow">${state.sort.dir > 0 ? '▲' : '▼'}</span>`);
  });
  renderSummary(); renderStatus(); updateButtons();
}
function updateButtons() {
  const sel = state.sel.size, any = state.items.length, idle = !state.printing;
  $('#bRemove').disabled = !sel || !idle; $('#bUp').disabled = !sel || !idle; $('#bDown').disabled = !sel || !idle;
  $('#bPreview').disabled = !any; $('#bEstimate').disabled = !ticked().length;
  $('#bSaveJob').disabled = !any; $('#bPrintTb').disabled = !ticked().length || !idle;
  for (const id of ['#bAddFiles', '#bAddFolder', '#bBlank', '#bOpenJob']) $(id).disabled = !idle;
}
/** Everything that shows item state: rows, panel, totals; and new estimates from the engine. */
function refresh({ estimate = true, panel = true } = {}) {
  renderRows();
  if (panel) syncPanel();
  if (estimate) scheduleEstimate();
}
function markDirty() { state.jobDirty = true; updateTitle(); }
function updateTitle() {
  const tag = desk ? desk.appTitle : 'Sievphov';
  const name = state.jobPath ? state.jobPath.split(/[\\/]/).pop().replace(/\.svpv$/i, '') : null;
  const t = name ? `${state.jobDirty ? '• ' : ''}${name} — ${tag}` : tag;
  document.title = t; desk?.setTitle(t);
  $('#doc-title').textContent = name ? `${name}${state.jobDirty ? ' •' : ''}` : state.items.length ? `Untitled job${state.jobDirty ? ' •' : ''}` : '';
}

/* ---------- selection ---------- */
function selectOnly(ids) { state.sel = new Set(ids); state.anchor = ids[ids.length - 1] ?? null; afterSelect(); }
function afterSelect() {
  rowsEl.querySelectorAll('.row').forEach(r => { const on = state.sel.has(r.dataset.id); r.classList.toggle('sel', on); r.setAttribute('aria-selected', on); });
  buildPanel(); renderStatus(); updateButtons();
}
function clickRow(id, e) {
  if (e.shiftKey && state.anchor && byId(state.anchor)) {
    const a = state.items.findIndex(it => it.id === state.anchor), b = state.items.findIndex(it => it.id === id);
    const range = state.items.slice(Math.min(a, b), Math.max(a, b) + 1).map(it => it.id);
    state.sel = new Set(e.ctrlKey ? [...state.sel, ...range] : range);
  } else if (e.ctrlKey || e.metaKey) {
    state.sel.has(id) ? state.sel.delete(id) : state.sel.add(id);
    state.anchor = id;
  } else {
    state.sel = new Set([id]); state.anchor = id;
  }
  afterSelect();
}
rowsEl.addEventListener('mousedown', e => {
  const row = e.target.closest('.row'); if (!row || e.button !== 0 || e.target.closest('.tick')) return;
  // a plain click on a row that is already part of a selection keeps it (so it can be dragged); mouseup narrows it
  if (state.sel.has(row.dataset.id) && !e.shiftKey && !e.ctrlKey && state.sel.size > 1) { row.dataset.narrow = '1'; return; }
  clickRow(row.dataset.id, e);
  listEl.focus({ preventScroll: true });
});
rowsEl.addEventListener('mouseup', e => {
  const row = e.target.closest('.row'); if (!row || !row.dataset.narrow) return;
  delete row.dataset.narrow; if (!dragIds) clickRow(row.dataset.id, e);
});
rowsEl.addEventListener('mousedown', e => { if (e.target === rowsEl && e.button === 0) selectOnly([]); });
rowsEl.addEventListener('change', e => {
  const t = e.target.closest('.tick'); if (!t) return;
  const id = t.closest('.row').dataset.id, it = byId(id);
  // ticking one of several selected files ticks them all
  const group = state.sel.has(id) ? selected() : [it];
  for (const x of group) if (x.pageCount > 0) x.checked = t.checked;
  markDirty(); refresh({ panel: false, estimate: false });
});
$('#tickAll').addEventListener('change', e => { for (const it of state.items) if (it.pageCount > 0) it.checked = e.target.checked; markDirty(); refresh({ panel: false, estimate: false }); });
rowsEl.addEventListener('dblclick', e => { const row = e.target.closest('.row'); if (row) openPreview(byId(row.dataset.id)); });

/* ---------- sorting (rearranges the list itself, like sorting in Explorer and then keeping that order) ---------- */
const SORT_KEYS = {
  name: it => it.name.toLowerCase(), pages: it => it.pageCount, preset: it => (it.presetName || '').toLowerCase(),
  printer: it => printerOf(it.settings).toLowerCase(), tray: it => trayText(it.settings).toLowerCase(), sides: it => sidesText(it.settings),
  copies: it => it.settings.Copies, status: it => statusOf(it).text
};
$('#listHead').addEventListener('click', e => {
  const b = e.target.closest('[data-sort]'); if (!b || state.printing) return;
  const key = b.dataset.sort, dir = state.sort.key === key ? -state.sort.dir : 1, f = SORT_KEYS[key];
  state.sort = { key, dir };
  state.items.sort((a, c) => { const x = f(a), y = f(c); return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * dir; });
  markDirty(); refresh({ estimate: false, panel: false });
});

/* ---------- moving rows: ▲ ▼, Alt+arrows, drag ---------- */
function moveSelected(delta) {
  if (state.printing || !state.sel.size) return;
  const items = state.items, idx = items.map((it, i) => state.sel.has(it.id) ? i : -1).filter(i => i >= 0);
  const order = delta < 0 ? idx : idx.slice().reverse();
  for (const i of order) {
    const j = i + delta;
    if (j < 0 || j >= items.length || state.sel.has(items[j].id)) continue;
    [items[i], items[j]] = [items[j], items[i]];
  }
  state.sort = { key: null, dir: 1 };
  markDirty(); refresh({ estimate: false, panel: false });
  rowsEl.querySelector('.row.sel')?.scrollIntoView({ block: 'nearest' });
}
let dragIds = null;
rowsEl.addEventListener('dragstart', e => {
  const row = e.target.closest('.row'); if (!row || state.printing) { e.preventDefault(); return; }
  if (!state.sel.has(row.dataset.id)) { state.sel = new Set([row.dataset.id]); state.anchor = row.dataset.id; afterSelect(); }
  dragIds = state.items.filter(it => state.sel.has(it.id)).map(it => it.id);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/x-sievphov-rows', dragIds.join(','));
  requestAnimationFrame(() => rowsEl.querySelectorAll('.row.sel').forEach(r => r.classList.add('dragging')));
});
const clearDropMarks = () => rowsEl.querySelectorAll('.drop-before,.drop-after').forEach(r => r.classList.remove('drop-before', 'drop-after'));
rowsEl.addEventListener('dragover', e => {
  if (!dragIds) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  clearDropMarks();
  const row = e.target.closest('.row');
  if (row) { const r = row.getBoundingClientRect(); row.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after'); }
  else rowsEl.querySelector('.row:last-child')?.classList.add('drop-after');
});
rowsEl.addEventListener('drop', e => {
  if (!dragIds) return;
  e.preventDefault(); e.stopPropagation();
  const mark = rowsEl.querySelector('.drop-before,.drop-after');
  if (mark) {
    const moving = state.items.filter(it => dragIds.includes(it.id)), rest = state.items.filter(it => !dragIds.includes(it.id));
    let at = rest.findIndex(it => it.id === mark.dataset.id);
    if (at < 0) at = rest.length; else if (mark.classList.contains('drop-after')) at++;
    if (!moving.some(it => it.id === mark.dataset.id)) { rest.splice(at, 0, ...moving); state.items = rest; state.sort = { key: null, dir: 1 }; markDirty(); }
  }
  endRowDrag(); refresh({ estimate: false, panel: false });
});
function endRowDrag() { dragIds = null; clearDropMarks(); rowsEl.querySelectorAll('.dragging').forEach(r => r.classList.remove('dragging')); }
rowsEl.addEventListener('dragend', endRowDrag);

/* ---------- files from Explorer: drop anywhere on the window ---------- */
const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
window.addEventListener('dragover', e => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = state.printing ? 'none' : 'copy'; document.body.classList.add('dropping'); });
window.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('dropping'); });
window.addEventListener('drop', e => {
  document.body.classList.remove('dropping');
  if (!hasFiles(e)) return;
  e.preventDefault();
  if (state.printing || !desk) return;
  const paths = [...e.dataTransfer.files].map(f => desk.pathForFile(f)).filter(Boolean);
  if (paths.length) openPaths(paths);
});

/* ================================================================== adding files */
async function addFilesCmd() { if (state.printing || !desk) return; const paths = await desk.addFilesDialog(); if (paths.length) addPdfs(paths, null); }
async function addFolderCmd() {
  if (state.printing || !desk) return;
  const dir = await desk.addFolderDialog(); if (!dir) return;
  const opts = await askFolderOptions(dir); if (!opts) return;
  state.settings.IncludeSubfolders = opts.sub; saveSettings();
  const { pdfs } = await desk.expandPaths([dir], opts.sub);
  if (!pdfs.length) { toast(`No PDF files in ${dir.split(/[\\/]/).pop()}${opts.sub ? ' or its subfolders' : ''}.`); return; }
  addPdfs(pdfs, opts.preset);
}
function askFolderOptions(dir) {
  return new Promise(res => {
    const def = state.presetPick || M.defaultPreset(state.lib);
    const { box, close } = openBox('ask', `<h2>Add folder</h2><p class="detail" style="overflow-wrap:anywhere">${esc(dir)}</p>
      <label class="chk"><input type="checkbox" id="fSub" ${state.settings.IncludeSubfolders ? 'checked' : ''}>Include subfolders</label>
      <div class="field"><label class="flabel" for="fPreset">Apply this preset to the added files</label>
        <select id="fPreset">${state.lib.Presets.map(p => `<option value="${esc(p.Id)}" ${def && p.Id === def.Id ? 'selected' : ''}>${esc(p.Name)}</option>`).join('')}</select></div>
      <div class="acts"><button class="btn outline" data-r="0">Cancel</button><button class="btn primary" data-r="1">Add folder</button></div>`,
      { onCancel: () => { close(); res(null); } });
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-r]'); if (!b) return;
      const out = b.dataset.r === '1' ? { sub: box.querySelector('#fSub').checked, preset: M.findPreset(state.lib, box.querySelector('#fPreset').value) } : null;
      close(); res(out);
    });
    box.querySelector('[data-r="1"]').focus();
  });
}
/** Dropped / "Open with" / start-up paths: jobs open, folders and PDFs are added. */
async function openPaths(paths) {
  const { pdfs, jobs } = await desk.expandPaths(paths, state.settings.IncludeSubfolders);
  if (jobs.length) await openJob(jobs[0]);
  if (pdfs.length) await addPdfs(pdfs, null);
}
let adding = Promise.resolve();
/** Reads each PDF with the engine (pages, sizes, password) one after another and adds it; files already listed are skipped. */
function addPdfs(paths, preset, init) {
  adding = adding.then(() => addPdfsNow(paths, preset, init)).catch(e => toast(e.message, true));
  return adding;
}
async function addPdfsNow(paths, preset, init) {
  const known = new Set(state.items.filter(it => !it.blank).map(it => it.path.toLowerCase()));
  const b = busy(), added = [], problems = [];
  let skipped = 0;
  try {
    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];
      if (p == null) {   // blank paper from a job: nothing to read
        const it = blankItem(null);
        if (init) init(it, i);
        state.items.push(it); added.push(it);
        continue;
      }
      if (known.has(p.toLowerCase())) { skipped++; continue; }
      known.add(p.toLowerCase());
      const name = p.split(/[\\/]/).pop();
      b.update(`Reading ${i + 1} of ${paths.length}: ${name}`);
      const it = { id: newItemId(), path: p, name, folder: p.slice(0, p.length - name.length - 1), pageCount: 0, pageSizes: [], password: null,
        settings: M.defaults(), presetId: null, presetName: null, modified: false, checked: true, status: 'wait', message: '' };
      const use = preset || M.defaultPreset(state.lib);
      if (use) M.applyPreset([it], use);
      if (init) init(it, i);
      try {
        Object.assign(it, await openPdf(p, it));
      } catch (e) {
        it.checked = false;
        it.status = e.reason === 'password' ? 'locked' : 'error';
        it.message = e.reason === 'password' ? 'Locked with a password' : e.message;
        problems.push(`${name}: ${it.message}`);
      }
      state.items.push(it); added.push(it);
      if (added.length % 20 === 0) renderRows();
    }
  } finally { b.done(); }
  if (added.length) {
    markDirty();
    if (!state.sel.size) { state.sel = new Set(added.slice(0, 1).map(it => it.id)); state.anchor = added[0].id; }
    refresh(); buildPanel();
  }
  if (problems.length) toast(problems.length === 1 ? problems[0] : `${problems.length} files could not be read — see the Status column.`, true);
  else if (skipped) toast(`${plural(skipped, 'file')} ${skipped === 1 ? 'was' : 'were'} already in the list.`);
  else if (added.length > 1) toast(`Added ${plural(added.length, 'file')}.`);
}
/* ---------- blank paper: a row with no file, put between files as a separator ---------- */
const BLANK_TIP = 'Blank paper: a separator sheet with nothing printed on it. It has the same settings as a file (printer, tray, paper, sides); Copies = how many blank sheets.';
/** Takes the settings and preset of `from` (the row above it), with 1 copy of all pages (1 copy = 1 sheet). */
function blankItem(from) {
  const it = { id: newItemId(), blank: true, path: '', name: 'Blank paper', folder: 'Separator — nothing printed', pageCount: 1,
    pageSizes: [from?.pageSizes?.[0] || [595.28, 841.89]], password: null,
    settings: M.defaults(), presetId: null, presetName: null, modified: false, checked: true, status: 'wait', message: '' };
  if (from) Object.assign(it, { settings: M.clone(from.settings), presetId: from.presetId, presetName: from.presetName });
  else { const p = M.defaultPreset(state.lib); if (p) M.applyPreset([it], p); }
  Object.assign(it.settings, { Copies: 1, Pages: 'All', PageRange: '' });
  M.markModified(it, state.lib);
  return it;
}
/** Blank paper after the last selected row, or at the end of the list, with that row's settings. */
function insertBlankCmd() {
  if (state.printing) return;
  const sel = selected(), after = sel[sel.length - 1] || state.items[state.items.length - 1] || null;
  const it = blankItem(after);
  state.items.splice(after ? state.items.indexOf(after) + 1 : 0, 0, it);
  selectOnly([it.id]);
  markDirty(); refresh(); buildPanel();
  rowsEl.querySelector(`.row[data-id="${it.id}"]`)?.scrollIntoView({ block: 'nearest' });
  toast(after ? `Blank paper added after ${after.name}, with its printer, tray and paper.` : 'Blank paper added.');
}
async function openPdf(path, it) {
  try {
    const r = await eng('open', { path, passwords: state.settings.Passwords });
    return { pageCount: r.pageCount, pageSizes: r.pageSizes, password: r.password };
  } catch (e) {
    if (e.reason !== 'password') throw e;
    // a locked file: ask (the saved passwords were tried already)
    for (;;) {
      const a = await askText('Locked PDF', `"${it.name}" is locked. Type its password:`, { password: true, check: 'Remember this password (try it on other locked files)', ok: 'Open' });
      if (!a) throw e;
      try {
        const r = await eng('open', { path, passwords: [a.text] });
        if (a.checked && !state.settings.Passwords.includes(a.text)) { state.settings.Passwords.push(a.text); saveSettings(); }
        return { pageCount: r.pageCount, pageSizes: r.pageSizes, password: r.password };
      } catch (e2) {
        if (e2.reason !== 'password') throw e2;
        toast('That password is not right. Please try again.', true);
      }
    }
  }
}
function removeItems(list) {
  if (state.printing || !list.length) return;
  const ids = new Set(list.map(it => it.id));
  state.items = state.items.filter(it => !ids.has(it.id));
  for (const id of ids) { state.sel.delete(id); state.est.delete(id); }
  markDirty(); refresh({ estimate: false }); buildPanel();
}
async function clearList() {
  if (state.printing || !state.items.length) return;
  if (!(await askConfirm(`Remove all ${plural(state.items.length, 'file')} from the list?`, 'Clear list', 'The files themselves are not touched.'))) return;
  state.items = []; state.sel.clear(); state.est.clear(); state.jobPath = null; state.jobDirty = false; state.repeat = 1;
  updateTitle(); refresh({ estimate: false }); buildPanel();
}

/* ---------- estimates: the engine counts pages and sheets for every file (debounced) ---------- */
let estT = 0, estSeq = 0;
function scheduleEstimate() { clearTimeout(estT); estT = setTimeout(runEstimate, 120); }
async function runEstimate() {
  const list = state.items.filter(it => it.pageCount > 0), seq = ++estSeq;
  if (!list.length) { state.est.clear(); renderSummary(); return; }
  try {
    const res = await eng('estimate', { items: list.map(estItem) });
    if (seq !== estSeq) return;
    state.est.clear();
    list.forEach((it, i) => state.est.set(it.id, res[i]));
    renderRows(); syncPanelSummary();
  } catch (e) { console.warn('estimate', e); }
}
function totals(list = ticked()) {
  let pages = 0, sheets = 0, problems = 0;
  for (const it of list) { const e = state.est.get(it.id); if (!e) continue; if (e.error) problems++; pages += e.pagesPrinted; sheets += e.sheets; }
  return { files: list.length, pages, sheets, problems };
}
function renderSummary() {
  const t = totals(), r = state.repeat;
  // the only place with pages and sheets of what prints (the status bar counts the list, the panel the selection)
  $('#printSum').textContent = t.files ? `${plural(t.pages * r, 'page')} · about ${plural(t.sheets * r, 'sheet')}` : 'Tick the files to print';
  if (!state.printing) $('#printLbl').textContent = t.files ? `Print ${plural(t.files, 'file')}${r > 1 ? ` × ${r}` : ''}` : 'Print';
  $('#bPrint').disabled = !t.files || !!state.printing;
  syncRepeat();
}
/* ---------- Repeat: the whole list N times, one complete set after another (N books of several files) ---------- */
function syncRepeat() {
  const input = $('#repeat');
  if (document.activeElement !== input) input.value = state.repeat;
  $('.repeat').classList.toggle('on', state.repeat > 1);
  $('#repMinus').disabled = state.repeat <= 1 || !!state.printing;
  $('#repPlus').disabled = state.repeat >= 999 || !!state.printing;
  input.disabled = !!state.printing;
}
function setRepeat(n, { dirty = true } = {}) {
  n = Math.max(1, Math.min(999, Math.round(+n) || 1));
  if (n !== state.repeat) { state.repeat = n; if (dirty) markDirty(); }
  renderSummary();
}
$('#repMinus').onclick = () => setRepeat(state.repeat - 1);
$('#repPlus').onclick = () => setRepeat(state.repeat + 1);
$('#repeat').addEventListener('change', e => { setRepeat(e.target.value); e.target.value = state.repeat; });
$('#repeat').addEventListener('keydown', e => {
  if (e.key === 'ArrowUp') { e.preventDefault(); setRepeat(state.repeat + 1); e.target.value = state.repeat; }
  if (e.key === 'ArrowDown') { e.preventDefault(); setRepeat(state.repeat - 1); e.target.value = state.repeat; }
  if (e.key === 'Enter') e.target.blur();
});
function renderStatus() {
  const n = state.items.length, t = state.items.filter(it => it.checked && it.pageCount > 0).length;
  $('#stFiles').textContent = n ? `${plural(n, 'file')} · ${t} ticked${state.sel.size ? ` · ${state.sel.size} selected` : ''}` : 'No files';
  const b = $('#stBusy');
  b.className = 'grow' + (state.busy || state.printing ? ' busy' : '');
  b.innerHTML = state.busy || state.printing ? `<span class="spin"></span><span>${esc(state.printing ? state.printing.text || 'Printing…' : state.busyText)}</span>` : '';
  $('#stEngine').textContent = desk?.fakeEngine ? 'Stand-in engine — nothing is printed' : '';
}

/* ================================================================== printers */
async function loadPrinters() {
  try { state.printers = await eng('printers'); } catch (e) { state.printers = []; toast('Could not list the printers: ' + e.message, true); }
}
const capsWaiting = new Map();
/** A printer's paper sizes and trays (cached; the panel redraws when they arrive). */
function capsFor(name) {
  const key = name || defaultPrinter();
  if (state.caps.has(key)) return state.caps.get(key);
  if (!capsWaiting.has(key)) capsWaiting.set(key, eng('caps', { name: key }).then(c => { state.caps.set(key, c); capsWaiting.delete(key); syncPanel(); }, () => { state.caps.set(key, { paperSizes: [], trays: [], canDuplex: false, supportsColor: false, exists: false }); capsWaiting.delete(key); syncPanel(); }));
  return null;
}

/* ================================================================== the settings editor (panel and Manage presets) */
// One field = one setting. kind: big (picture · title · line), select, seg, text, number, check, color, file.
// opts(ctx, s) → [{ v, t, s, ic }]; show(s) → visible?; parse(string) → value.
const yes = () => true;
const num = v => +v;
const bool = v => v === 'true';
const POSITIONS = [['TopLeft', 'Top left'], ['TopCenter', 'Top center'], ['TopRight', 'Top right'], ['Center', 'Center'], ['BottomLeft', 'Bottom left'], ['BottomCenter', 'Bottom center'], ['BottomRight', 'Bottom right'], ['TopOutside', 'Top, outside edge (books)'], ['BottomOutside', 'Bottom, outside edge (books)']].map(([v, t]) => ({ v, t }));
const FONTS = ['Khmer UI', 'Khmer OS', 'Khmer OS Battambang', 'Khmer OS Siemreap', 'Khmer OS Content', 'Khmer OS Muol Light', 'Noto Sans Khmer', 'Leelawadee UI', 'DaunPenh', 'Segoe UI', 'Arial', 'Times New Roman', 'Calibri'];

const SECTIONS = [
  { sec: 'printer', title: 'Printer & pages', icon: 'printer', fields: [
    { path: 'PrinterName', kind: 'big', label: 'Printer', opts: (ctx, s) => printerOpts(s) },
    { path: 'Copies', kind: 'copies', label: 'Copies', min: 1, max: 999 },
    { path: 'Collate', kind: 'seg', label: 'Copies come out', show: s => s.Copies > 1, opts: () => [{ v: 'ByDocument', t: '1,2,3 · 1,2,3' }, { v: 'ByPage', t: '1,1 · 2,2 · 3,3' }] },
    { path: 'Pages', kind: 'big', label: 'Pages', opts: () => [
      { v: 'All', t: 'All pages', s: 'Every page of the file', ic: 'pages' }, { v: 'Odd', t: 'Odd pages', s: '1, 3, 5 …', ic: 'odd' },
      { v: 'Even', t: 'Even pages', s: '2, 4, 6 …', ic: 'even' }, { v: 'Range', t: 'Custom pages', s: 'Type which pages to print', ic: 'range' }] },
    { path: 'PageRange', kind: 'text', label: 'Pages to print', show: s => s.Pages === 'Range', placeholder: 'e.g. 1-5, 8, 12-last', validate: rangeError },
    { path: 'Reverse', kind: 'check', text: 'Reverse order (last page first)' }
  ]},
  { sec: 'paper', title: 'Paper & tray', icon: 'tray', fields: [
    { path: 'Tray', kind: 'big', label: 'Paper tray', opts: (ctx, s) => trayOpts(s) },
    { path: 'PaperSize', kind: 'big', label: 'Paper', opts: (ctx, s) => paperOpts(s) },
    { path: 'Sides', kind: 'big', label: 'Sides', show: s => s.Layout !== 'Booklet', opts: (ctx, s) => [
      { v: 'OneSide', t: 'Print one side', s: 'Only the front of each sheet', ic: 'oneside' },
      { v: 'LongEdge', t: 'Both sides, flip on long edge', s: 'Turn pages like a book', ic: 'longedge' },
      { v: 'ShortEdge', t: 'Both sides, flip on short edge', s: 'Turn pages like a notepad · booklets', ic: 'shortedge' }], note: s => sidesNote(s) },
    { path: 'Orientation', kind: 'big', label: 'Orientation', show: s => s.Layout !== 'Booklet', opts: () => [
      { v: 'Auto', t: 'Auto', s: 'Follow each page, turn pages to fit', ic: 'auto' },
      { v: 'Portrait', t: 'Portrait', s: 'Tall sheet', ic: 'portrait' }, { v: 'Landscape', t: 'Landscape', s: 'Wide sheet', ic: 'landscape' }] },
    { path: 'Grayscale', kind: 'seg', label: 'Color', parse: bool, opts: () => [{ v: 'false', t: 'Color' }, { v: 'true', t: 'Grayscale' }] },
    { path: 'Dpi', kind: 'seg', label: 'Quality', parse: num, opts: () => [{ v: '150', t: 'Draft 150' }, { v: '300', t: 'Normal 300' }, { v: '600', t: 'High 600' }] }
  ]},
  { sec: 'layout', title: 'Layout', icon: 'booklet', fields: [
    { path: 'Layout', kind: 'big', label: 'Layout', opts: (ctx, s) => [
      { v: 'Normal', t: 'One page per sheet', s: 'Fit, actual size or your own zoom', ic: 'normal' },
      { v: 'PagesPerSheet', t: 'Multiple pages per sheet', s: s.Layout === 'PagesPerSheet' ? `${s.Columns * s.Rows} on each side` : '2, 4, 6, 9 or 16 on each side', ic: 'nup' },
      { v: 'Booklet', t: 'Booklet', s: 'Folded sheets, pages in reading order', ic: 'booklet' }] },
    // the chosen layout's own settings, boxed together under it (as in Sastra PDF)
    { group: 'lay', show: yes, fields: [
      { row: [{ path: 'PerSheet', kind: 'select', label: 'Pages per sheet', opts: (ctx, s) => perSheetOpts(s) },
        { path: 'Order', kind: 'select', label: 'Page order', opts: () => [
          { v: 'AcrossThenDown', t: 'Horizontal' }, { v: 'AcrossThenDownReversed', t: 'Horizontal reversed' },
          { v: 'DownThenAcross', t: 'Vertical' }, { v: 'DownThenAcrossReversed', t: 'Vertical reversed' }] }], show: s => s.Layout === 'PagesPerSheet' },
      { row: [{ path: 'BookletSides', kind: 'select', label: 'Print', opts: () => [{ v: 'Both', t: 'Both sides' }, { v: 'Front', t: 'Front side only' }, { v: 'Back', t: 'Back side only' }] },
        { path: 'Binding', kind: 'select', label: 'Binding', opts: () => [{ v: 'Left', t: 'Left' }, { v: 'Right', t: 'Right' }] }], show: s => s.Layout === 'Booklet' },
      { line: s => bookletNote(s), show: s => s.Layout === 'Booklet' },
      { path: 'Fit', kind: 'select', label: 'Size on the paper', opts: () => [
        { v: 'Fit', t: 'Fit to paper' }, { v: 'ShrinkOnly', t: 'Shrink large pages only' }, { v: 'ActualSize', t: 'Actual size' }, { v: 'Fill', t: 'Fill paper (may cut edges)' }, { v: 'Zoom', t: 'Zoom %' }] },
      { path: 'ZoomPercent', kind: 'number', label: 'Zoom %', min: 10, max: 400, show: s => s.Fit === 'Zoom' },
      { path: 'Alignment', kind: 'select', label: 'Position on the paper', show: s => s.Layout !== 'Booklet', opts: () => [
        ['Center', 'Center'], ['Top', 'Top'], ['Bottom', 'Bottom'], ['Left', 'Left'], ['Right', 'Right'], ['TopLeft', 'Top left'], ['TopRight', 'Top right'], ['BottomLeft', 'Bottom left'], ['BottomRight', 'Bottom right']].map(([v, t]) => ({ v, t })) },
      { row: [{ path: 'GapMm', kind: 'number', label: 'Gap (mm)', min: 0, max: 100, step: 0.5 }, { path: 'Borders', kind: 'check', text: 'Print page border' }], show: s => s.Layout === 'PagesPerSheet' },
      { path: 'BookletGapMm', kind: 'number', label: 'Gap at the fold (mm)', min: 0, max: 100, step: 0.5, show: s => s.Layout === 'Booklet' },
      { hint: 'Fold the printed stack in half to make the booklet. If the printer can\'t print on both sides, print Front side only, put the stack back in the tray, then print Back side only. Reverse order prints the last sheet first.', show: s => s.Layout === 'Booklet' }
    ]}
  ]},
  { sec: 'numbers', title: 'Page numbers', icon: 'hash', on: 'PageNumbers.Enabled', fields: [
    { path: 'PageNumbers.Enabled', kind: 'check', text: 'Print page numbers' },
    { group: 'pn', show: s => s.PageNumbers.Enabled, fields: [
      { path: 'PageNumbers.Position', kind: 'select', label: 'Position', opts: () => POSITIONS },
      { row: [{ path: 'PageNumbers.Format', kind: 'text', label: 'Text', placeholder: '{page}' }, { path: 'PageNumbers.StartAt', kind: 'number', label: 'Page 1 shows', min: -999, max: 9999 }] },
      { path: 'PageNumbers.Digits', kind: 'seg', label: 'Digits', opts: () => [{ v: 'Western', t: '1 2 3' }, { v: 'Khmer', t: '១ ២ ៣' }] },
      { row: [{ path: 'PageNumbers.Font', kind: 'font', label: 'Font' }, { path: 'PageNumbers.SizePt', kind: 'number', label: 'Size (pt)', min: 4, max: 72, step: 0.5 }] },
      { row: [{ path: 'PageNumbers.Color', kind: 'color', label: 'Color' }, { path: 'PageNumbers.MarginMm', kind: 'number', label: 'From the edge (mm)', min: 0, max: 100, step: 0.5 }] },
      { hint: '{page} = the number, {pages} = how many. "ទំព័រ {page}" or "{page} / {pages}". Page 1 shows 0 or less: the first pages get no number (covers).' }
    ]}
  ]},
  { sec: 'watermark', title: 'Watermark', icon: 'text', on: 'Watermark.Enabled', fields: [
    { path: 'Watermark.Enabled', kind: 'check', text: 'Print a text watermark' },
    { group: 'wm', show: s => s.Watermark.Enabled, fields: [
      { path: 'Watermark.Text', kind: 'text', label: 'Text', placeholder: '{filename}' },
      { row: [{ path: 'Watermark.Font', kind: 'font', label: 'Font' }, { path: 'Watermark.SizePt', kind: 'number', label: 'Size (pt)', min: 4, max: 400 }] },
      { row: [{ path: 'Watermark.Color', kind: 'color', label: 'Color' }, { path: 'Watermark.SeeThroughPercent', kind: 'number', label: 'See-through %', min: 0, max: 95 }] },
      { row: [{ path: 'Watermark.Angle', kind: 'number', label: 'Angle (°)', min: -180, max: 180 }, { path: 'Watermark.MarginMm', kind: 'number', label: 'From the edge (mm)', min: 0, max: 100 }] },
      { path: 'Watermark.Position', kind: 'select', label: 'Position', opts: () => POSITIONS },
      { hint: '{filename} {name} {date} {time} {page} {pages}' }
    ]}
  ]},
  { sec: 'logo', title: 'Logo', icon: 'image', on: 'Logo.Enabled', fields: [
    { path: 'Logo.Enabled', kind: 'check', text: 'Print a picture (logo)' },
    { group: 'logo', show: s => s.Logo.Enabled, fields: [
      { path: 'Logo.Path', kind: 'file', label: 'Picture' },
      { row: [{ path: 'Logo.WidthPercent', kind: 'number', label: 'Width (% of page)', min: 1, max: 100 }, { path: 'Logo.SeeThroughPercent', kind: 'number', label: 'See-through %', min: 0, max: 95 }] },
      { row: [{ path: 'Logo.Position', kind: 'select', label: 'Position', opts: () => POSITIONS }, { path: 'Logo.MarginMm', kind: 'number', label: 'From the edge (mm)', min: 0, max: 100 }] }
    ]}
  ]}
];
function printerOpts(s) {
  const def = defaultPrinter();
  const opts = [{ v: '', t: 'Default printer', s: def ? def : 'Windows decides', ic: 'printer' }];
  for (const p of state.printers) opts.push({ v: p.name, t: p.name, s: p.isDefault ? 'Default printer' : 'Printer', ic: 'printer' });
  if (s.PrinterName && !state.printers.some(p => p.name === s.PrinterName)) opts.push({ v: s.PrinterName, t: s.PrinterName, s: 'Not installed on this PC', ic: 'printer' });
  return opts;
}
function trayOpts(s) {
  const caps = capsFor(s.PrinterName);
  const opts = [{ v: '', t: 'As in printer', s: 'The printer chooses (its own setting)', ic: 'tray' }];
  for (const t of caps ? caps.trays : []) opts.push({ v: t, t, s: 'Paper tray', ic: 'tray' });
  if (!caps) opts.push({ v: '__loading', t: 'Asking the printer…', s: '', ic: 'tray', disabled: true });
  if (s.Tray && !(caps && caps.trays.includes(s.Tray))) opts.push({ v: s.Tray, t: s.Tray, s: caps ? 'Not on this printer' : '', ic: 'tray' });
  return opts;
}
function paperOpts(s) {
  const caps = capsFor(s.PrinterName);
  const opts = [{ v: '', t: 'Printer default', s: 'The paper set in the printer', ic: 'paper' }];
  for (const p of caps ? caps.paperSizes : []) opts.push({ v: p, t: p, s: 'Paper size', ic: 'paper' });
  if (s.PaperSize && !(caps && caps.paperSizes.includes(s.PaperSize))) opts.push({ v: s.PaperSize, t: s.PaperSize, s: caps ? 'Not on this printer' : '', ic: 'paper' });
  return opts;
}
function sidesNote(s) {
  const caps = state.caps.get(s.PrinterName || defaultPrinter());
  if (M.isTwoSided(s) && caps && caps.exists && !caps.canDuplex) return 'This printer cannot print on both sides: the file will stop with an error.';
  return '';
}
function bookletNote(s) {
  const caps = state.caps.get(s.PrinterName || defaultPrinter());
  if (s.BookletSides === 'Both' && caps && caps.exists && !caps.canDuplex) return 'This printer cannot print on both sides. Print Front side only, put the stack back in the tray, then print Back side only.';
  if (s.BookletSides === 'Front') return 'Then put the printed stack back in the tray and print Back side only.';
  if (s.BookletSides === 'Back') return 'Put the stack printed with Front side only back in the tray first.';
  return '';
}
/** Pages per sheet as in Sastra PDF: 2, 4, 6, 9, 16; a grid from an older preset (3 × 1 …) stays as it is. */
function perSheetOpts(s) {
  const opts = M.PER_SHEET.map(([n, v]) => ({ v, t: String(n) }));
  const cur = M.get(s, 'PerSheet');
  if (!opts.some(o => o.v === cur)) opts.push({ v: cur, t: `${s.Columns} × ${s.Rows} (custom)` });
  return opts;
}

/**
 * Builds the editor into `root`. ctx = { items() → the items (or presets) being edited, lib (for bold) | null,
 * set(path, value) }. Returns { sync() } to redraw values without rebuilding (keeps the focus while typing).
 */
function buildEditor(root, ctx, { sections = SECTIONS, folded = true } = {}) {
  const bound = [];
  const foldedList = new Set(JSON.parse(lsGet('sievphov-folded') || '["watermark","logo"]'));
  const settingsOf = () => ctx.items().map(x => x.settings);
  for (const sec of sections) {
    const el = document.createElement('section');
    el.className = 'tsec' + (folded && foldedList.has(sec.sec) ? ' folded' : '');
    el.dataset.sec = sec.sec;
    el.innerHTML = `<h3><button class="tsec-head" aria-expanded="${!el.classList.contains('folded')}">${svg(sec.icon)}<span>${esc(sec.title)}</span>${sec.on ? '<span class="count" hidden>On</span>' : ''}<svg class="i chev" viewBox="0 0 24 24">${ICONS.up}</svg></button></h3>`;
    el.querySelector('.tsec-head').addEventListener('click', () => {
      el.classList.toggle('folded');
      el.querySelector('.tsec-head').setAttribute('aria-expanded', !el.classList.contains('folded'));
      if (folded) { const f = new Set(JSON.parse(lsGet('sievphov-folded') || '[]')); el.classList.contains('folded') ? f.add(sec.sec) : f.delete(sec.sec); lsSet('sievphov-folded', JSON.stringify([...f])); }
    });
    if (sec.on) bound.push({ sync: list => { el.querySelector('.count').hidden = !list.some(s => M.get(s, sec.on)); } });
    if (sec.top) sec.top(el);
    addFields(el, sec.fields);
    root.appendChild(el);
  }
  function addFields(parent, fields) {
    for (const f of fields) {
      const shown = el => { if (f.show) bound.push({ sync: list => { el.hidden = !f.show(list[0]); } }); };
      if (f.hint) { const p = document.createElement('p'); p.className = 'hint'; p.textContent = f.hint; parent.appendChild(p); shown(p); continue; }
      if (f.line) {   // a line of its own that depends on the settings (and the printer)
        const p = document.createElement('p'); p.className = 'hint'; parent.appendChild(p);
        bound.push({ sync: list => { const n = f.show && !f.show(list[0]) ? '' : f.line(list[0]); p.textContent = n; p.hidden = !n; } });
        continue;
      }
      if (f.row) { const r = document.createElement('div'); r.className = 'row2'; parent.appendChild(r); shown(r); addFields(r, f.row); continue; }
      if (f.group) {
        const g = document.createElement('div'); g.className = 'subbox'; parent.appendChild(g);
        bound.push({ sync: list => { g.hidden = !f.show(list[0]); } });
        addFields(g, f.fields); continue;
      }
      parent.appendChild(makeField(f));
    }
  }
  function makeField(f) {
    const wrap = document.createElement('div');
    wrap.className = f.kind === 'check' ? 'field chkf' : 'field';
    const label = f.kind === 'check' ? null : document.createElement('div');
    if (label) { label.className = 'flabel'; label.innerHTML = `<span>${esc(f.label)}</span><span class="mixed" hidden>files differ</span>`; wrap.appendChild(label); }
    let control, read, write, optKey = '';
    const parse = f.parse || (f.kind === 'number' || f.kind === 'copies' ? num : v => v);
    const commit = v => { if (f.validate?.(v)) return; ctx.set(f.path, parse(v)); };
    if (f.kind === 'big' || f.kind === 'select') {
      control = document.createElement('select');
      if (f.kind === 'big') control.className = 'big';
      control.addEventListener('change', () => { if (control.value !== '__mixed' && control.value !== '__loading') commit(control.value); });
      write = (v, mixed, s) => {
        const opts = f.opts(ctx, s), key = JSON.stringify(opts);
        if (key !== optKey) {
          optKey = key;
          const row = o => f.kind === 'big'
            ? `<option value="${esc(o.v)}"${o.disabled ? ' disabled' : ''}><span class="ic">${svg(o.ic || 'doc')}</span><span class="t"><b>${esc(o.t)}</b><small>${esc(o.s || '')}</small></span></option>`
            : `<option value="${esc(o.v)}"${o.disabled ? ' disabled' : ''}>${esc(o.t)}</option>`;
          control.innerHTML = (f.kind === 'big' ? '<button><selectedcontent></selectedcontent></button>' : '') + opts.map(row).join('') +
            (f.kind === 'big' ? `<option value="__mixed" disabled hidden><span class="ic">${svg('stack')}</span><span class="t"><b>Mixed</b><small>The selected files differ — pick one to set them all</small></span></option>` : '<option value="__mixed" disabled hidden>Mixed</option>');
        }
        control.value = mixed ? '__mixed' : String(v);
        control.classList.toggle('is-mixed', mixed);
      };
      wrap.appendChild(control);
    } else if (f.kind === 'seg') {
      control = document.createElement('div'); control.className = 'seg';
      control.addEventListener('click', e => { const b = e.target.closest('button'); if (b) commit(b.dataset.v); });
      write = (v, mixed, s) => {
        const opts = f.opts(ctx, s), key = JSON.stringify(opts);
        if (key !== optKey) { optKey = key; control.innerHTML = opts.map(o => `<button type="button" data-v="${esc(o.v)}">${esc(o.t)}</button>`).join(''); }
        control.classList.toggle('mixed', mixed);
        control.querySelectorAll('button').forEach(b => b.classList.toggle('on', !mixed && b.dataset.v === String(v)));
      };
      wrap.appendChild(control);
    } else if (f.kind === 'check') {
      const lab = document.createElement('label'); lab.className = 'chk';
      lab.innerHTML = `<input type="checkbox"><span>${esc(f.text)}</span>`;
      control = lab.querySelector('input');
      control.addEventListener('change', () => ctx.set(f.path, control.checked));
      write = (v, mixed) => { control.checked = !mixed && !!v; control.indeterminate = mixed; };
      wrap.appendChild(lab);
      read = lab.querySelector('span');
    } else if (f.kind === 'color') {
      control = document.createElement('input'); control.type = 'color';
      control.addEventListener('change', () => commit(control.value.toUpperCase()));
      write = (v, mixed) => { control.value = /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : '#000000'; control.style.opacity = mixed ? .5 : 1; };
      wrap.appendChild(control);
    } else if (f.kind === 'copies') {
      const row = document.createElement('div'); row.className = 'copies-row';
      row.innerHTML = `<input type="number" min="${f.min}" max="${f.max}" step="1" aria-label="Copies"><button class="btn link" type="button">Printer Properties</button>`;
      control = row.querySelector('input');
      row.querySelector('button').addEventListener('click', async () => {
        const s = ctx.items()[0]?.settings; const name = s ? printerOf(s) : '';
        if (!name || !(await desk?.printerPrefs(name))) toast('Printer Properties are not available for this printer.', true);
        else toast(`Changes in "${name}" Properties become that printer's own settings.`);
      });
      wireText(control, f, commit);
      write = (v, mixed) => { if (document.activeElement !== control) { control.value = mixed ? '' : v; control.placeholder = mixed ? 'Mixed' : ''; control.classList.toggle('is-mixed', mixed); } };
      wrap.appendChild(row);
    } else {   // text, number, font, file
      control = document.createElement('input');
      control.type = f.kind === 'number' ? 'number' : 'text';
      if (f.kind === 'number') { control.min = f.min; control.max = f.max; control.step = f.step || 1; }
      if (f.kind === 'font') { control.setAttribute('list', 'fontList'); }
      wireText(control, f, commit);
      write = (v, mixed) => { if (document.activeElement !== control) { control.value = mixed ? '' : (v ?? ''); control.placeholder = mixed ? 'Mixed' : (f.placeholder || ''); control.classList.toggle('is-mixed', mixed); } };
      if (f.kind === 'file') {
        const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px';
        const b = document.createElement('button'); b.className = 'tbtn'; b.type = 'button'; b.textContent = 'Browse…';
        b.addEventListener('click', async () => { const p = await desk?.pickPicture(); if (p) { control.value = p; commit(p); } });
        row.append(control, b); wrap.appendChild(row);
      } else wrap.appendChild(control);
    }
    const err = document.createElement('p'); err.className = 'err-msg'; err.hidden = true; wrap.appendChild(err);
    const note = document.createElement('p'); note.className = 'hint'; note.hidden = true; wrap.appendChild(note);
    if (f.validate) control.addEventListener('input', () => { const m = f.validate(control.value); err.textContent = m || ''; err.hidden = !m; });
    bound.push({
      sync(list) {
        const items = ctx.items();
        const sh = M.shared(items, f.path), s = list[0];
        wrap.hidden = f.show ? !f.show(s) : false;
        write(sh.value, sh.mixed, s);
        if (label) {
          label.querySelector('.mixed').hidden = !sh.mixed;
          label.classList.toggle('changed', !!ctx.lib && M.differsFromPreset(items, f.path, ctx.lib));
        } else if (read) read.style.fontWeight = ctx.lib && M.differsFromPreset(items, f.path, ctx.lib) ? '600' : '';
        const n = f.note ? f.note(s) : '';
        note.textContent = n; note.hidden = !n;
      }
    });
    return wrap;
  }
  function wireText(control, f, commit) {
    const go = () => {
      if (control.value === '' && control.placeholder === 'Mixed') return;
      if (f.kind === 'number' || f.kind === 'copies') {
        const v = +control.value;
        if (control.value === '' || !Number.isFinite(v) || v < f.min || v > f.max) { control.style.borderColor = 'var(--err)'; return; }
        control.style.borderColor = '';
      }
      commit(control.value);
    };
    control.addEventListener('change', go);
    control.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); control.select(); } });
  }
  const api = { sync() { const list = settingsOf(); if (!list.length) return; for (const b of bound) b.sync(list); } };
  api.sync();
  return api;
}

/* ---------- the panel: presets on top, then the selected files' settings ---------- */
let editor = null;
function presetOpts() {
  return state.lib.Presets.map((p, i) => ({ v: p.Id, t: p.Name, s: (p.Id === state.lib.DefaultPresetId ? 'Default · ' : '') + (i < 9 ? `Ctrl+${i + 1} · ` : '') + describe(p.Settings), ic: 'stack' }));
}
/** The Presets section at the top of the panel: pick a preset, apply it to the selected files, save / update / manage. */
function renderPresets() {
  const box = $('#presetBox');
  if (!state.presetPick || !M.findPreset(state.lib, state.presetPick.Id)) state.presetPick = M.defaultPreset(state.lib) || state.lib.Presets[0] || null;
  const opts = presetOpts(), n = state.sel.size, idle = !state.printing;
  box.innerHTML = `<div class="field"><select class="big" id="presetSel" aria-label="Preset"><button><selectedcontent></selectedcontent></button>${opts.map(o => `<option value="${esc(o.v)}"><span class="ic">${svg(o.ic)}</span><span class="t"><b>${esc(o.t)}</b><small>${esc(o.s)}</small></span></option>`).join('')}</select></div>
    <div class="grid2">
      <button class="tbtn primary" id="pApply" ${n && state.presetPick && idle ? '' : 'disabled'}>${svg('check')}<span>${n > 1 ? `Apply to ${n} files` : 'Apply to selected'}</span></button>
      <button class="tbtn" id="pManage" ${idle ? '' : 'disabled'}>${svg('edit')}<span>Manage presets…</span></button>
      <button class="tbtn" id="pSaveAs" ${n === 1 && idle ? '' : 'disabled'} title="Save the selected file's settings as a new preset">${svg('plus')}<span>Save as preset…</span></button>
      <button class="tbtn" id="pUpdate" ${n === 1 && state.presetPick && idle ? '' : 'disabled'} title="Give the chosen preset the selected file's settings">${svg('save')}<span>Update preset</span></button>
    </div>`;
  const sel = box.querySelector('#presetSel');
  if (state.presetPick) sel.value = state.presetPick.Id;
  sel.addEventListener('change', () => { state.presetPick = M.findPreset(state.lib, sel.value); renderPresets(); });
  box.querySelector('#pApply').onclick = () => state.presetPick && applyPresetCmd(state.presetPick);
  box.querySelector('#pManage').onclick = () => openPresetManager();
  box.querySelector('#pSaveAs').onclick = saveAsPresetCmd;
  box.querySelector('#pUpdate').onclick = updatePresetCmd;
}
document.querySelector('.tsec[data-sec="presets"] .tsec-head').addEventListener('click', e => {
  const sec = e.currentTarget.closest('.tsec'); sec.classList.toggle('folded'); e.currentTarget.setAttribute('aria-expanded', !sec.classList.contains('folded'));
});
function buildPanel() {
  renderPresets();
  const box = $('#settingsBox');
  box.innerHTML = '';
  editor = null;
  const items = selected();
  if (!items.length) {
    box.innerHTML = `<p class="empty-props">${state.items.length ? 'Select one or more files in the list to see and change their printer, tray, pages and more. Click, Ctrl+click, Shift+click or Ctrl+A.' : 'Add PDF files, then select them to change their printer, tray, pages and more. Each file keeps its own settings.'}</p>`;
    return;
  }
  const head = document.createElement('section');
  head.className = 'tsec';
  head.innerHTML = `<div class="sel-head"><span class="doc">${svg(items.length > 1 ? 'pages' : items[0].blank ? 'blank' : 'doc')}</span><span class="nm"><b></b><small></small></span></div><div class="preset-line"><span class="pl"></span><button class="btn reset" id="pReset" title="Put back the preset's settings: undo the changes made by hand (*)">${svg('reset')}<span>Reset</span></button></div>`;
  box.appendChild(head);
  editor = buildEditor(box, {
    items: selected,
    lib: state.lib,
    set(path, value) {
      if (state.printing) { toast('Settings can be changed again when printing has finished.'); syncPanel(); return; }
      M.setField(selected(), path, value, state.lib);
      markDirty(); refresh();
    }
  });
  head.querySelector('#pReset').onclick = () => { M.resetToPreset(selected(), state.lib); markDirty(); refresh(); };
  syncPanel();
}
function syncPanel() {
  const items = selected();
  if (!editor || !items.length) { if (items.length) buildPanel(); return; }
  const head = $('#settingsBox .sel-head');
  if (head) {
    const one = items.length === 1 ? items[0] : null;
    head.querySelector('b').textContent = one ? one.name : `${items.length} files selected`;
    syncPanelSummary();
    const names = [...new Set(items.map(it => it.presetName ?? null))];
    const pl = $('#settingsBox .pl');
    const anyMod = items.some(it => it.modified && it.presetId), linked = items.some(it => it.presetId);
    const tip = anyMod ? ' title="* = changed by hand"' : '';
    pl.innerHTML = names.length === 1 && names[0] != null
      ? `<span class="k">Preset</span><span class="chip preset-chip"${tip}><span class="cl">${esc(names[0])}</span>${anyMod ? '<span class="star">*</span>' : ''}</span>`
      : names.length > 1 ? '<span class="k">Presets</span><span class="chip own"><span class="cl">Mixed</span></span>' : '<span class="chip own"><span class="cl">Own settings — no preset</span></span>';
    $('#pReset').hidden = !(linked && anyMod);
  }
  editor.sync();
}
function syncPanelSummary() {
  const items = selected(), head = $('#settingsBox .sel-head small');
  if (!head || !items.length) return;
  const t = totals(items), pages = items.reduce((n, it) => n + it.pageCount, 0);
  const e = items.length === 1 ? state.est.get(items[0].id) : null;
  const bad = items.length === 1 && items[0].message && ['error', 'locked', 'stopped'].includes(items[0].status) ? items[0].message : '';
  head.classList.toggle('bad', !!bad);
  head.textContent = bad ? bad : items.length === 1 && items[0].blank
    ? `Separator · ${plural(e ? e.sheets : items[0].settings.Copies, 'blank sheet')} (= Copies)`
    : items.length === 1
    ? `${plural(items[0].pageCount, 'page')}${e ? (e.error ? ' · check the pages' : ` · prints ${plural(e.pagesPrinted, 'page')} on ${plural(e.sheets, 'sheet')}`) : ''}`
    : `${plural(pages, 'page')} · about ${plural(t.sheets, 'sheet')}`;
}
$('#settingsBox').insertAdjacentHTML('afterend', `<datalist id="fontList">${FONTS.map(f => `<option value="${esc(f)}">`).join('')}</datalist>`);

/* ---------- preset commands ---------- */
function applyPresetCmd(p) {
  if (state.printing) return;
  const items = selected();
  if (!items.length) { toast('Select one or more files in the list first, then apply the preset.'); return; }
  M.applyPreset(items, p);
  state.presetPick = p;
  markDirty(); refresh(); buildPanel();
  toast(`"${p.Name}" applied to ${plural(items.length, 'file')}.`);
}
async function saveAsPresetCmd() {
  const it = selected()[0]; if (!it) return;
  const a = await askText('Save as preset', `Save the settings of "${it.name}" as a new preset named:`, { value: it.presetName ? it.presetName + ' copy' : 'My preset', ok: 'Save preset' });
  if (!a) return;
  const p = { Id: M.newId(), Name: M.uniqueName(state.lib, a.text), Settings: M.clone(it.settings) };
  state.lib.Presets.push(p);
  await savePresets();
  M.applyPreset([it], p);
  state.presetPick = p;
  refresh(); buildPanel();
  toast(`Preset "${p.Name}" saved.`);
}
async function updatePresetCmd() {
  const it = selected()[0], p = state.presetPick; if (!it || !p) return;
  if (!(await askConfirm(`Give the preset "${p.Name}" the settings of "${it.name}"?`, 'Update preset', 'Files that use this preset without changes (no *) get the new settings too.'))) return;
  p.Settings = M.clone(it.settings);
  await savePresets();
  M.applyPreset([it], p);
  M.libraryChanged(state.items, state.lib);
  refresh(); buildPanel();
  toast(`Preset "${p.Name}" updated.`);
}
async function savePresets() {
  try { await desk?.storeWrite('presets', state.lib); } catch (e) { toast('Could not save the presets: ' + e.message, true); }
}
function saveSettings() { desk?.storeWrite('settings', state.settings).catch(() => {}); }

/* ---------- Manage presets: the list on the left, the same editor on the right ---------- */
function openPresetManager(selectId) {
  if (state.printing) { toast('Presets can be changed when printing has finished.'); return; }
  const draft = M.clone(state.lib);
  let cur = M.findPreset(draft, selectId) || M.findPreset(draft, state.presetPick?.Id) || draft.Presets[0] || null;
  const { box, close } = openBox('presets', `<div class="head"><h2>Manage presets</h2></div>
    <div class="plist"><ul id="pmList"></ul><div class="ptools">
      <button class="btn pnew" data-a="new">${svg('plus')}<span>New preset</span></button>
      <div class="picons" role="toolbar" aria-label="The chosen preset">
        <button class="btn" data-a="dup" title="Duplicate" aria-label="Duplicate">${svg('copy')}</button>
        <button class="btn" data-a="def" title="Make it the default (given to files you add)" aria-label="Make default">${svg('star')}</button>
        <span class="sep"></span>
        <button class="btn" data-a="up" title="Move up" aria-label="Move up">${svg('up')}</button>
        <button class="btn" data-a="down" title="Move down" aria-label="Move down">${svg('down')}</button>
        <span class="sep"></span>
        <button class="btn danger" data-a="del" title="Delete" aria-label="Delete">${svg('trash')}</button>
      </div>
      <div class="pio"><button class="btn" data-a="imp" title="Add presets from a .svpreset file">${svg('import')}<span>Import…</span></button><button class="btn" data-a="exp" title="Save all presets to a file, to copy them to another PC">${svg('export')}<span>Export…</span></button></div></div></div>
    <div class="pedit" id="pmEdit"></div>
    <div class="acts"><span class="hint" style="margin-right:auto;color:var(--muted);font-size:12px">The default preset is given to files you add. Ctrl+1 … Ctrl+9 apply the first nine.</span>
      <button class="btn outline" data-a="cancel">Cancel</button><button class="btn primary" data-a="save">Save presets</button></div>`,
    { onCancel: () => close() });
  const listEl2 = box.querySelector('#pmList'), editEl = box.querySelector('#pmEdit');
  let ed = null;
  function drawList() {
    listEl2.innerHTML = draft.Presets.map((p, i) => `<li data-id="${esc(p.Id)}" class="${cur && p.Id === cur.Id ? 'on' : ''}"><span class="nm">${esc(p.Name)}</span>${p.Id === draft.DefaultPresetId ? '<span class="def">Default</span>' : ''}<span class="kb">${i < 9 ? 'Ctrl+' + (i + 1) : ''}</span></li>`).join('') ||
      '<li style="cursor:default;color:var(--muted)">No presets yet — click New preset.</li>';
    const i = cur ? draft.Presets.indexOf(cur) : -1, dis = (a, off) => { box.querySelector(`[data-a="${a}"]`).disabled = off; };
    dis('dup', !cur); dis('del', !cur); dis('up', i <= 0); dis('down', i < 0 || i >= draft.Presets.length - 1);
    dis('def', !cur || cur.Id === draft.DefaultPresetId); dis('exp', !draft.Presets.length);
  }
  function drawEditor() {
    editEl.innerHTML = '';
    if (!cur) { editEl.innerHTML = '<p class="hint" style="padding:20px">Pick a preset on the left, or make a new one.</p>'; return; }
    const name = document.createElement('div'); name.className = 'pname';
    name.innerHTML = `<input type="text" value="${esc(cur.Name)}" aria-label="Preset name">`;
    const input = name.querySelector('input');
    input.addEventListener('change', () => { const v = input.value.trim(); if (v) cur.Name = M.uniqueName(draft, v, cur); input.value = cur.Name; drawList(); });
    editEl.appendChild(name);
    const holder = { get settings() { return cur.Settings; } };
    ed = buildEditor(editEl, { items: () => [holder], lib: null, set(path, value) { M.setField([{ settings: cur.Settings, presetId: null }], path, value, draft); ed.sync(); drawList(); } }, { folded: false });
  }
  listEl2.addEventListener('click', e => { const li = e.target.closest('li[data-id]'); if (!li) return; cur = M.findPreset(draft, li.dataset.id); drawList(); drawEditor(); });
  box.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    const i = cur ? draft.Presets.indexOf(cur) : -1;
    if (a === 'new') { cur = { Id: M.newId(), Name: M.uniqueName(draft, 'New preset'), Settings: M.defaults() }; draft.Presets.push(cur); }
    if (a === 'dup' && cur) { const c = { Id: M.newId(), Name: M.uniqueName(draft, cur.Name + ' copy'), Settings: M.clone(cur.Settings) }; draft.Presets.splice(i + 1, 0, c); cur = c; }
    if (a === 'del' && cur) {
      if (!(await askConfirm(`Delete the preset "${cur.Name}"?`, 'Delete', 'Files that use it keep their settings.'))) return;
      draft.Presets.splice(i, 1);
      if (draft.DefaultPresetId === cur.Id) draft.DefaultPresetId = draft.Presets[0]?.Id ?? null;
      cur = draft.Presets[Math.min(i, draft.Presets.length - 1)] || null;
    }
    if ((a === 'up' || a === 'down') && cur) { const j = i + (a === 'up' ? -1 : 1); if (j >= 0 && j < draft.Presets.length) { draft.Presets.splice(i, 1); draft.Presets.splice(j, 0, cur); } }
    if (a === 'def' && cur) draft.DefaultPresetId = cur.Id;
    if (a === 'imp') {
      const r = await desk?.importPresets(); if (!r) return;
      try { if (r.error) throw new Error(r.error === 'damaged' ? 'This is not a Sievphov presets file.' : r.error); const n = M.importInto(draft, r.data); cur = draft.Presets[draft.Presets.length - 1]; toast(`${plural(n, 'preset')} imported.`); }
      catch (err) { toast('Could not import: ' + err.message, true); return; }
    }
    if (a === 'exp') { const p = await desk?.exportPresets({ Presets: draft.Presets }); if (p) toast(`${plural(draft.Presets.length, 'preset')} exported. Copy the file to another PC and use Import.`); return; }
    if (a === 'cancel') { close(); return; }
    if (a === 'save') {
      state.lib = draft;
      await savePresets();
      M.libraryChanged(state.items, state.lib);
      close(); refresh(); buildPanel();
      toast('Presets saved. Files using them without changes follow the new settings.');
      return;
    }
    drawList(); if (['new', 'dup', 'del', 'imp'].includes(a)) drawEditor();
  });
  drawList(); drawEditor();
}

/* ================================================================== jobs (.svpv) */
async function openJobCmd() { if (state.printing || !desk) return; const p = await desk.openJobDialog(); if (p) openJob(p); }
async function openJob(path) {
  const r = await desk.readJob(path);
  let entries;
  try { if (r.error) throw new Error(r.error === 'damaged' ? 'This is not a Sievphov job file.' : r.error); entries = M.fromJob(r.data, state.lib); }
  catch (e) { toast('Could not open the job: ' + e.message, true); return; }
  if (state.items.length) {
    const c = await askChoice('Replace the list with this job, or add its files to the list?', [['Cancel', 'outline'], ['Add to list', 'outline'], ['Replace list', 'primary']]);
    if (c === 0) return;
    if (c === 2) { state.items = []; state.sel.clear(); state.est.clear(); }
    if (c === 2) state.repeat = M.jobRepeat(r.data);
  } else state.repeat = M.jobRepeat(r.data);
  const paths = await desk.resolveJobPaths(path, r.data.Items.filter(e => e && typeof e.FilePath === 'string'));   // null = blank paper
  await addPdfs(paths, null, (it, i) => { const e = entries[i]; Object.assign(it, { settings: e.settings, presetId: e.presetId, presetName: e.presetName, modified: e.modified, checked: e.checked }); });
  state.jobPath = path; state.jobDirty = false; updateTitle();
  toast(`Opened ${path.split(/[\\/]/).pop()}.`);
}
async function saveJob(as) {
  if (!state.items.length || !desk) return;
  const name = state.jobPath ? null : (state.items[0]?.name || 'Print job').replace(/\.pdf$/i, '');
  const p = await desk.saveJob(as ? null : state.jobPath, M.toJob(state.items, state.repeat), name);
  if (!p) return;
  state.jobPath = p; state.jobDirty = false; updateTitle();
  toast(`Saved ${p.split(/[\\/]/).pop()}.`);
}
/* ================================================================== estimate and printing */
function estimateTable(list) {
  const est = list.map(it => state.est.get(it.id) || {});
  const rows = M.byPrinter(list, est, defaultPrinter());
  const problems = list.map((it, i) => est[i].error ? `${it.name}: ${est[i].error}` : null).filter(Boolean);
  const t = rows.reduce((a, r) => ({ files: a.files + r.files, pages: a.pages + r.pages, sheets: a.sheets + r.sheets }), { files: 0, pages: 0, sheets: 0 });
  return { problems, html: `<table class="est"><thead><tr><th>Printer</th><th class="n">Files</th><th class="n">Pages</th><th class="n">Sheets</th></tr></thead><tbody>` +
    rows.map(r => `<tr><td>${esc(r.printer)}</td><td class="n">${r.files}</td><td class="n">${r.pages}</td><td class="n">${r.sheets}</td></tr>`).join('') +
    `</tbody><tfoot><tr><td>Total</td><td class="n">${t.files}</td><td class="n">${t.pages}</td><td class="n">${t.sheets}</td></tr></tfoot></table>` +
    (problems.length ? `<p class="detail">These files will stop with an error:</p><ul class="problems">${problems.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : '') };
}
async function estimateCmd() {
  const list = ticked(); if (!list.length) { toast('No files are ticked.'); return; }
  await runEstimate();
  const { html } = estimateTable(list);
  const { box, close } = openBox('wide', `<h2>Estimate</h2><p class="detail">Paper needed for the ${plural(list.length, 'ticked file')}, per printer. Two-sided sheets count once.</p>${html}<div class="acts"><button class="btn primary" data-close>Close</button></div>`);
  box.querySelector('[data-close]').onclick = close; box.querySelector('[data-close]').focus();
}
/* ---------- Swap trays: a file's tray that is not on the printer it prints on ---------- */
/** A printer's paper sizes and trays, waiting for the engine when they are not known yet. */
async function capsAsync(name) {
  const key = name || defaultPrinter();
  if (!key) return null;
  if (!state.caps.has(key)) { capsFor(key); await capsWaiting.get(key); }
  return state.caps.get(key) || null;
}
/**
 * Before printing: files whose tray is not on their printer get one of that printer's trays. Remembered answers are
 * used without asking (unless `ask`), the rest are asked in the Swap trays box. → the swaps made
 * [{ printer, tray, trays, items, to, asked }], or null when the box was cancelled (nothing changes then).
 */
async function swapTrays(list, { ask = false } = {}) {
  await Promise.all([...new Set(list.map(it => printerOf(it.settings)))].filter(Boolean).map(capsAsync));
  const groups = M.missingTrays(list, n => state.caps.get(n) || null, defaultPrinter());
  if (!groups.length) return [];
  for (const g of groups) { g.to = M.rememberedSwap(state.settings.TraySwaps, g.printer, g.tray, g.trays); g.asked = false; }
  const toAsk = ask ? groups : groups.filter(g => g.to == null);
  if (toAsk.length) {
    const answer = await askTrays(toAsk);
    if (!answer) return null;
    toAsk.forEach((g, i) => { g.to = answer.to[i]; g.asked = true; });
    if (answer.remember) {
      for (const g of toAsk) state.settings.TraySwaps = M.rememberSwap(state.settings.TraySwaps, g.printer, g.tray, g.to);
      saveSettings();
    }
  }
  setTrays(groups, 'to');
  return groups;
}
// gives each group's files its new tray ('to') or puts their own one back ('tray')
function setTrays(groups, which) {
  for (const g of groups) for (const it of g.items) { it.settings.Tray = g[which]; M.markModified(it, state.lib); }
  markDirty(); refresh({ estimate: false });
}
/** The Swap trays box: one row per printer and missing tray. → { to: [tray per group], remember } or null. */
function askTrays(groups) {
  return new Promise(res => {
    const row = (g, i) => `<tr><td>${esc(g.printer)}</td><td>${esc(g.tray)}</td>
      <td><select data-g="${i}" aria-label="Tray to use on ${esc(g.printer)} instead of ${esc(g.tray)}">${['', ...g.trays].map(t => `<option value="${esc(t)}"${t === (g.to ?? '') ? ' selected' : ''}>${esc(t || 'As in printer')}</option>`).join('')}</select></td>
      <td class="n" title="${esc(g.items.map(it => it.name).join('\n'))}">${g.items.length}</td></tr>`;
    const one = groups.length === 1 && groups[0].items.length === 1;
    const { box, close } = openBox('wide', `<h2>Swap trays</h2><p class="detail">${one ? 'This file prints' : 'These files print'} on a printer that does not have ${one ? 'its' : 'their'} tray. Pick the tray to use instead.</p>
      <table class="est swap"><thead><tr><th>Printer</th><th>Their tray</th><th>Use this tray</th><th class="n">Files</th></tr></thead><tbody>${groups.map(row).join('')}</tbody></table>
      <label class="chk"><input type="checkbox" id="swRemember" checked>Remember for next time</label>
      <div class="acts"><button class="btn outline" data-r="0">Cancel</button><button class="btn primary" data-r="1">Continue</button></div>`,
      { onCancel: () => { close(); res(null); } });
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-r]'); if (!b) return;
      const to = [...box.querySelectorAll('select[data-g]')].map(s => s.value), remember = box.querySelector('#swRemember').checked;
      close(); res(b.dataset.r === '1' ? { to, remember } : null);
    });
    box.querySelector('select[data-g]').focus();
  });
}
async function printCmd() {
  if (state.printing) return;
  const list = ticked();
  if (!list.length) { toast('No files are ticked. Tick the files you want to print.'); return; }
  await runEstimate();
  // a tray the printer does not have: ask which of its trays to use (remembered answers are used by themselves)
  let swaps = await swapTrays(list);
  if (!swaps) return;
  // only a question: what prints where; Repeat is next to the Print button, After printing in File › After Printing…
  const est = list.map(it => state.est.get(it.id) || {}), n = state.repeat;
  const byPrinter = M.byPrinter(list, est, defaultPrinter());
  const sheets = byPrinter.reduce((t, r) => t + r.sheets, 0) * n;
  const where = byPrinter.length === 1 ? `on ${byPrinter[0].printer}` : `on ${byPrinter.length} printers: ` + byPrinter.map(r => `${r.printer} (${r.sheets * n})`).join(', ');
  const problems = list.map((it, i) => est[i].error ? `${it.name}: ${est[i].error}` : null).filter(Boolean);
  const after = state.settings.AfterPrint !== 'Nothing' && state.settings.AfterPrintFolder
    ? ` Afterwards the PDFs are ${state.settings.AfterPrint === 'MoveTo' ? 'moved' : 'copied'} to ${state.settings.AfterPrintFolder}.` : '';
  const detail = `About ${plural(sheets, 'sheet')} ${where}.${n > 1 ? ` The whole list ${n} times, one set after another.` : ''}${after}`;
  const problemsHtml = problems.length ? `<p class="detail">These files will stop with an error:</p><ul class="problems">${problems.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : '';
  let go = false;
  for (;;) {
    const auto = swaps.filter(g => !g.asked);   // remembered swaps, made without asking: shown, and can be changed
    const swapHtml = auto.length ? `<p class="detail">Trays swapped as you chose before:</p><ul class="names">${auto.map(g => `<li>${esc(`${g.tray} → ${g.to || 'As in printer'} on ${g.printer} (${plural(g.items.length, 'file')})`)}</li>`).join('')}</ul>` : '';
    const buttons = [['Cancel', 'outline'], ...(auto.length ? [['Change trays…', 'outline']] : []), ['Print', 'primary']];
    const r = await askChoice(`Print ${plural(list.length, 'file')}${n > 1 ? `, ${n} times` : ''}?`, buttons, { detail, html: swapHtml + problemsHtml });
    if (auto.length && r === 1) {
      setTrays(auto, 'tray');   // their own trays back, so the box asks about them again
      const again = await swapTrays(auto.flatMap(g => g.items), { ask: true });
      if (!again) setTrays(auto, 'to');   // cancelled: keep the remembered ones
      else swaps = [...swaps.filter(g => !auto.includes(g)), ...again];
      continue;
    }
    go = r === buttons.length - 1;
    break;
  }
  if (!go) return;
  for (const it of list) { it.status = 'wait'; it.message = ''; }
  state.printing = { paused: false, ids: new Set(list.map(it => it.id)), fraction: 0, text: 'Starting…' };
  setPrintingUi();
  try {
    await eng('print', { items: list.map(engItem), repeat: state.repeat, after: { action: state.settings.AfterPrint, folder: state.settings.AfterPrintFolder } });
  } catch (e) {
    state.printing = null; setPrintingUi();
    toast('Printing could not start: ' + e.message, true);
  }
}
/** File › After Printing…: leave the printed PDFs, or move / copy them to a folder (for every print run). */
function openAfterPrint() {
  if (state.printing) return;
  const { box, close } = openBox('wide', `<h2>After printing</h2><p class="detail">What happens to each PDF once it has printed (after its last set, with Repeat).</p>
    <div class="field"><div class="row2" style="grid-template-columns:150px 1fr">
      <select id="apAct"><option value="Nothing">Do nothing</option><option value="MoveTo">Move PDFs to</option><option value="CopyTo">Copy PDFs to</option></select>
      <div style="display:flex;gap:6px"><input type="text" id="apDir" placeholder="Folder" value="${esc(state.settings.AfterPrintFolder)}" style="flex:1"><button class="tbtn" id="apPick" type="button">…</button></div></div></div>
    <div class="acts"><button class="btn outline" data-r="0">Cancel</button><button class="btn primary" data-r="1">OK</button></div>`);
  const act = box.querySelector('#apAct'), dir = box.querySelector('#apDir');
  act.value = state.settings.AfterPrint;
  const sync = () => { dir.disabled = box.querySelector('#apPick').disabled = act.value === 'Nothing'; };
  act.addEventListener('change', sync); sync();
  box.querySelector('#apPick').onclick = async () => { const p = await desk?.pickFolder('Folder for printed PDFs'); if (p) dir.value = p; };
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    if (b.dataset.r === '1') {
      if (act.value !== 'Nothing' && !dir.value.trim()) { toast('Choose the folder for the printed PDFs, or pick Do nothing.', true); return; }
      state.settings.AfterPrint = act.value; state.settings.AfterPrintFolder = dir.value.trim(); saveSettings();
    }
    close();
  });
  act.focus();
}
function setPrintingUi() {
  const p = state.printing;
  $('#runBar').hidden = !p; $('#runBtns').hidden = !p; $('#bPrint').hidden = !!p;
  if (p) { $('#runBar i').style.width = Math.round(p.fraction * 100) + '%'; $('#bPause').querySelector('span').textContent = p.paused ? 'Resume' : 'Pause'; $('#bPause').querySelector('svg').innerHTML = ICONS[p.paused ? 'print' : 'pause']; }
  renderPresets(); refresh({ estimate: false });
}
function onEngineEvent(ev) {
  if (ev.event === 'progress' && state.printing) {
    const p = ev.progress, it = byId(p.id);
    if (it) { it.status = p.status; it.message = p.status === 'printed' ? '' : p.message || ''; }
    state.printing.fraction = p.fraction;
    state.printing.text = p.status === 'printing' && it ? `Printing ${p.file} of ${p.files}: ${it.name} — ${p.message}` : state.printing.text;
    $('#runBar i').style.width = Math.round(p.fraction * 100) + '%';
    renderRows();
  } else if (ev.event === 'done') {
    const rows = (ev.report || []).map(r => ({ ...r, preset: M.presetLabel(byId(r.id) || {}) + (byId(r.id)?.modified ? ' *' : '') }));
    for (const r of rows) {
      const it = byId(r.id); if (!it) continue;
      it.status = { Printed: 'printed', Error: 'error', Stopped: 'stopped' }[r.status] || it.status;
      it.message = r.status === 'Printed' ? '' : r.message;
      if (r.newPath) { it.path = r.newPath; it.folder = r.newPath.slice(0, r.newPath.length - it.name.length - 1); markDirty(); }
    }
    state.printing = null; setPrintingUi();
    if (ev.error) toast('Printing failed: ' + ev.error, true);
    openReport(rows);
  } else if (ev.event === 'stopped' && state.printing) {
    state.printing = null; setPrintingUi();
    toast('The print engine stopped unexpectedly. Files not yet printed were not sent.', true);
  }
}
function openReport(rows) {
  const count = s => rows.filter(r => r.status === s).length;
  const stat = (n, cls, word) => n ? `<span class="pill ${cls}">${n} ${word}</span>` : '';
  const { box, close } = openBox('report', `<div class="head"><h2>Finished</h2><div class="stats">${stat(count('Printed'), 'printed', 'printed')}${stat(count('Error'), 'error', 'failed')}${stat(count('Stopped'), 'stopped', 'stopped')}
      <span class="pill wait">${plural(rows.reduce((a, r) => a + (r.pages || 0), 0), 'page')} · ${plural(rows.reduce((a, r) => a + (r.sheets || 0), 0), 'sheet')}</span></div></div>
    <div class="body"><table><thead><tr><th>File</th><th>Status</th><th>Message</th><th>Printer</th><th>Preset</th><th>Pages</th><th>Sheets</th><th>Copies</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td title="${esc(r.folder)}">${esc(r.fileName)}</td><td><span class="pill ${({ Printed: 'printed', Error: 'error', Stopped: 'stopped' })[r.status] || 'wait'}">${esc(r.status)}</span></td><td title="${esc(r.message)}">${esc(r.message)}</td><td>${esc(r.printer)}</td><td>${esc(r.preset)}</td><td class="n">${r.pages || 0}</td><td class="n">${r.sheets || 0}</td><td class="n">${r.copies || 1}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="acts"><button class="btn outline" data-a="csv">Save as CSV (Excel)…</button><button class="btn outline" data-a="rm" ${count('Printed') ? '' : 'disabled'}>Remove printed from list</button><span style="flex:1"></span><button class="btn primary" data-a="close">Close</button></div>`);
  box.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'csv') { const p = await desk?.saveReport(M.reportCsv(rows)); if (p) toast('Saved ' + p.split(/[\\/]/).pop()); }
    if (a === 'rm') { removeItems(state.items.filter(it => it.status === 'printed')); e.target.closest('button').disabled = true; }
    if (a === 'close') close();
  });
  box.querySelector('[data-a="close"]').focus();
}
$('#bPrint').onclick = printCmd;
$('#bPause').onclick = async () => { const p = state.printing; if (!p) return; p.paused = !p.paused; await eng(p.paused ? 'pause' : 'resume').catch(() => {}); if (p.paused) p.text = 'Paused (after the current side)'; setPrintingUi(); };
$('#bStop').onclick = async () => {
  if (!state.printing) return;
  if (await askConfirm('Stop printing?', 'Stop', 'The file printing now is cancelled; the others are not sent.')) await eng('stop').catch(() => {});
};

/* ================================================================== preview: fills the window, like a Print screen.
   All sheets: every file that will print, one after the other, each with its preset and every sheet side drawn by the
   engine as it will print (drawn when scrolled into view). Click a sheet: that sheet large, ‹ › go on across files. */
function openPreview(start) {
  const readable = state.items.filter(it => it.pageCount > 0 && it.status !== 'locked');
  let pool = ticked();
  const onlyTicked = pool.length > 0 && (!start || pool.includes(start));
  if (!onlyTicked) pool = readable;
  if (!pool.length) { toast('Add a PDF file that can be read first.'); return; }
  const SIZES = [160, 220, 300, 420];
  const savedSize = lsGet('sievphov-pv-size');
  let size = savedSize != null && SIZES[+savedSize] ? +savedSize : 1;
  let one = null, zoomed = false, sheetIn = null, seq = 0;   // one = { it, side } while a single sheet is shown
  const sidesOf = new Map();                                  // item id → sides per copy (from the estimate)
  const cache = new Map();                                    // "id:side:px" → engine reply
  const { box, close } = openBox('preview', `<div class="head"><h2>Preview</h2><span class="hint">${onlyTicked ? 'The ticked files' : 'All files'}, every sheet as it will print, each with its own preset, printer and paper</span>
      <span class="pv-tools"><span class="seg" role="group" aria-label="Show"><button class="btn on" id="pvAllBtn">${svg('pages')}<span>All sheets</span></button><button class="btn" id="pvOneBtn">${svg('doc')}<span>One sheet</span></button></span>
      <label class="pv-size" title="Size of the sheets">${svg('eye')}<input type="range" id="pvSize" min="0" max="${SIZES.length - 1}" step="1" value="${size}" aria-label="Sheet size"></label></span></div>
    <div class="side"><h4>Files <span class="count">${pool.length}</span></h4><div class="pv-files" id="pvFiles"></div>
      <p class="hint">${onlyTicked ? 'Only the ticked files are shown: they are what Print sends.' : 'No file is ticked, so every file is shown.'} Pick another preset for a file above its sheets to see how it would print. The dashed line is the edge the printer can reach; on a booklet the dash-dot line in the middle is the fold, which becomes the spine.</p></div>
    <div class="view"><div class="pv-all" id="pvAll" tabindex="0"></div>
      <div class="pv-one" id="pvOne" hidden><div class="info" id="pvInfo"></div><div class="stage" id="pvStage"><span class="none">Drawing…</span></div>
        <div class="nav"><button class="btn icon" id="pvPrev" title="Previous side (←)">${svg('left')}</button><span id="pvNum"></span><button class="btn icon" id="pvNext" title="Next side (→)">${svg('right')}</button></div></div></div>
    <div class="foot"><span class="note" id="pvNote"></span><button class="btn primary" data-close>Close</button></div>`,
  { full: true, onCancel: () => (one ? showAll() : close()) });
  const all = box.querySelector('#pvAll'), stage = box.querySelector('#pvStage'), filesEl = box.querySelector('#pvFiles');
  const q = s => box.querySelector(s);

  // ---- what each file prints: sides per copy, from one estimate for all of them
  async function countSides(list) {
    const res = await eng('estimate', { items: list.map(estItem) }).catch(() => null);
    list.forEach((it, i) => sidesOf.set(it.id, res?.[i] ?? { sides: 0, sheets: 0, pagesPrinted: 0, error: 'Could not count the sheets' }));
  }
  const guessLandscape = it => {
    const s = it.settings, p = it.pageSizes?.[0] || [595, 842];
    return s.Layout === 'Booklet' || s.Orientation === 'Landscape' ||
      (s.Orientation !== 'Portrait' && (s.Layout === 'PagesPerSheet' ? s.Columns > s.Rows : p[0] > p[1]));
  };
  const factLine = it => {
    const s = it.settings, e = sidesOf.get(it.id) || {};
    const prints = e.error ? e.error : it.blank ? plural(e.sheets || 0, 'blank sheet') : `${plural(e.sheets || 0, 'sheet')} · ${plural(e.pagesPrinted || 0, 'page')}${s.Copies > 1 ? ` (${plural(s.Copies, 'copy', 'copies')})` : ''}`;
    return [printerOf(s), trayText(s), s.PaperSize || 'Printer paper', s.Layout === 'Booklet' ? bindingText(s) : sidesText(s), prints];
  };
  const presetSelect = it => `<select class="pv-preset" aria-label="Preset of ${esc(it.name)}" title="Pick a preset to see how this file would print with it">
      ${it.presetName == null ? `<option value="" selected>${esc(M.presetLabel(it))}</option>` : ''}
      ${state.lib.Presets.map(p => `<option value="${esc(p.Id)}"${p.Id === it.presetId ? ' selected' : ''}>${esc(p.Name)}${p.Id === it.presetId && it.modified ? ' *' : ''}</option>`).join('')}</select>`;

  // ---- the left column: one card per file
  function drawFiles() {
    filesEl.innerHTML = pool.map((it, i) => { const f = factLine(it); return `<button class="pv-file" data-id="${it.id}" title="${esc(it.path)}">
      <span class="n">${i + 1}</span><span class="t"><b>${esc(it.name)}</b>${presetChip(it)}<small>${esc(f.slice(0, 4).join(' · '))}</small><small class="pr">${esc(f[4])}</small></span></button>`; }).join('');
    markCurrentFile();
  }
  filesEl.addEventListener('click', e => {
    const it = byId(e.target.closest('.pv-file')?.dataset.id); if (!it) return;
    if (one) { one = { it, side: 0 }; drawOne(); } else all.querySelector(`.pv-group[data-id="${it.id}"]`)?.scrollIntoView({ block: 'start' });
  });
  function markCurrentFile() {
    let id = one?.it.id;
    if (!id) { const top = all.getBoundingClientRect().top + 8; id = [...all.querySelectorAll('.pv-group')].find(g => g.getBoundingClientRect().bottom > top + 90)?.dataset.id; }
    filesEl.querySelectorAll('.pv-file').forEach(b => b.classList.toggle('on', b.dataset.id === id));
  }

  // ---- all sheets: a group per file; two-sided files show front and back side by side
  const observer = new IntersectionObserver(es => { for (const e of es) { e.target.classList.toggle('near', e.isIntersecting); if (e.isIntersecting) want(e.target); } }, { root: all, rootMargin: '600px 0px' });
  function groupHtml(it, i) {
    const n = sidesOf.get(it.id)?.sides || 0, two = M.isTwoSided(it.settings), land = guessLandscape(it), f = factLine(it);
    let sheets = '';
    for (let k = 0; k < n; k += two ? 2 : 1) {
      const side = (j, what) => `<span class="pv-side${land ? ' land' : ''}" data-side="${j}" title="${what} — click to see it large"><span class="none">${j + 1}</span></span>`;
      sheets += `<figure class="pv-sheet"><div class="pv-pair">${side(k, two ? 'Front' : 'Sheet')}${two && k + 1 < n ? side(k + 1, 'Back') : ''}</div><figcaption>Sheet ${two ? k / 2 + 1 : k + 1}</figcaption></figure>`;
    }
    return `<section class="pv-group" data-id="${it.id}"><div class="pv-gh"><span class="n">${i + 1}</span><span class="t"><b>${esc(it.name)}</b><small>${esc(f.join(' · '))}</small></span>
      <label class="pv-pl"><span>Preset</span>${presetSelect(it)}</label></div>
      <div class="pv-sheets">${sheets || `<p class="none">${esc(sidesOf.get(it.id)?.error || 'Nothing to print — check the pages.')}</p>`}</div></section>`;
  }
  function drawAll() {
    observer.disconnect();
    all.style.setProperty('--pv-h', SIZES[size] + 'px');
    all.innerHTML = pool.map(groupHtml).join('');
    all.querySelectorAll('.pv-side').forEach(el => observer.observe(el));
    markCurrentFile(); note();
  }
  function redrawGroup(it) {
    const g = all.querySelector(`.pv-group[data-id="${it.id}"]`); if (!g) return;
    g.querySelectorAll('.pv-side').forEach(el => observer.unobserve(el));
    g.outerHTML = groupHtml(it, pool.indexOf(it));
    all.querySelectorAll(`.pv-group[data-id="${it.id}"] .pv-side`).forEach(el => observer.observe(el));
  }
  all.addEventListener('change', async e => {
    const sel = e.target.closest('.pv-preset'), it = byId(sel?.closest('.pv-group')?.dataset.id); if (!it) return;
    if (state.printing) { toast('Settings can be changed again when printing has finished.'); redrawGroup(it); return; }
    const p = M.findPreset(state.lib, sel.value); if (!p) return;
    M.applyPreset([it], p);
    markDirty(); refresh();
    for (const k of [...cache.keys()]) if (k.startsWith(it.id + ':')) cache.delete(k);
    await countSides([it]);
    redrawGroup(it); drawFiles(); note();
    toast(`"${p.Name}" given to ${it.name}.`);
  });
  all.addEventListener('click', e => {
    const el = e.target.closest('.pv-side'), it = byId(el?.closest('.pv-group')?.dataset.id); if (!it) return;
    one = { it, side: +el.dataset.side }; drawOne();
  });
  all.addEventListener('scroll', () => requestAnimationFrame(markCurrentFile), { passive: true });

  // the engine draws one side at a time; the ones on screen go first, in reading order
  const waiting = new Set(); let working = false;
  const pxFor = () => { const h = SIZES[size] * 1.42 * (window.devicePixelRatio || 1); return h <= 340 ? 340 : h <= 520 ? 520 : 760; };
  function want(el) { if (!el.dataset.done) { waiting.add(el); pump(); } }
  async function pump() {
    if (working) return;
    working = true;
    try {
      while (document.body.contains(box)) {
        const el = [...waiting].find(x => x.classList.contains('near') && x.isConnected);
        [...waiting].forEach(x => { if (!x.isConnected || x.dataset.done) waiting.delete(x); });
        if (!el) break;
        waiting.delete(el);
        const it = byId(el.closest('.pv-group')?.dataset.id); if (!it) continue;
        const r = await sideImage(it, +el.dataset.side, pxFor()).catch(e => ({ error: e.message }));
        if (!el.isConnected) continue;
        el.dataset.done = '1';
        if (r.error) { el.innerHTML = `<span class="none bad" title="${esc(r.error)}">!</span>`; continue; }
        el.classList.toggle('land', r.widthIn > r.heightIn);
        el.style.aspectRatio = `${r.widthIn} / ${r.heightIn}`;
        el.innerHTML = `<img alt="" src="${srcOf(r)}">`;
        el.title = `${r.twoSided ? (r.isBack ? 'Back' : 'Front') : 'Sheet ' + r.sheet} · ${pagesOf(r)} — click to see it large`;
        el.dataset.pages = r.slots.map(p => p ?? 'blank').join(' | ');
        const fig = el.closest('.pv-sheet'), [f, b] = fig.querySelectorAll('.pv-side');
        fig.querySelector('figcaption').textContent = it.blank ? `Blank sheet${it.settings.Copies > 1 ? ` × ${it.settings.Copies}` : ''}` : `Sheet ${r.sheet} · ` + (b || r.twoSided
          ? `front ${f.dataset.pages || '…'}${b ? ` · back ${b.dataset.pages || '…'}` : ''}`
          : `page${r.slots.length > 1 ? 's' : ''} ${el.dataset.pages}`);
      }
    } finally { working = false; }
  }
  const srcOf = r => r.png ? 'data:image/png;base64,' + r.png : 'data:image/svg+xml;base64,' + r.svg;
  const pagesOf = r => `page${r.slots.length > 1 ? 's' : ''} ${r.slots.map(p => p ?? 'blank').join(' | ')}`;
  async function sideImage(it, side, px) {
    const key = `${it.id}:${side}:${px}`;
    if (!cache.has(key)) cache.set(key, await eng('preview', { item: engItem(it), side, maxPx: px }));
    return cache.get(key);
  }

  // ---- one sheet large, ‹ › go on into the next file
  function fitImg() {
    const img = stage.querySelector('img'); if (!img || !sheetIn) return;
    const cs = getComputedStyle(stage), aw = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), ah = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const k = zoomed ? 96 : Math.min(aw / sheetIn.w, ah / sheetIn.h);
    img.style.width = Math.max(1, Math.floor(sheetIn.w * k)) + 'px'; img.style.height = Math.max(1, Math.floor(sheetIn.h * k)) + 'px';
  }
  function setMode() {
    q('#pvAll').hidden = !!one; q('#pvOne').hidden = !one;
    q('#pvAllBtn').classList.toggle('on', !one); q('#pvOneBtn').classList.toggle('on', !!one);
    q('#pvSize').closest('label').hidden = !!one;
    markCurrentFile(); note();
  }
  function showAll() {
    const was = one; one = null; zoomed = false; stage.classList.remove('zoomed'); setMode();
    if (was) all.querySelector(`.pv-group[data-id="${was.it.id}"] .pv-side[data-side="${was.side}"]`)?.scrollIntoView({ block: 'center' });
    all.focus({ preventScroll: true });
  }
  async function drawOne() {
    setMode();
    const { it, side } = one, my = ++seq, n = sidesOf.get(it.id)?.sides || 0, fi = pool.indexOf(it);
    q('#pvNum').textContent = `${it.name} · side ${side + 1} of ${n}`;
    q('#pvPrev').disabled = fi === 0 && side === 0; q('#pvNext').disabled = fi === pool.length - 1 && side >= n - 1;
    const px = Math.min(2400, Math.round(Math.max(stage.clientWidth, stage.clientHeight) * (window.devicePixelRatio || 1)));
    try {
      const r = await sideImage(it, side, Math.max(600, Math.round(px / 200) * 200));
      if (my !== seq || !one) return;
      stage.innerHTML = `<img alt="Sheet preview" src="${srcOf(r)}">`;
      sheetIn = { w: r.widthIn, h: r.heightIn };
      fitImg();
      q('#pvInfo').textContent = `${it.name} · ${M.presetLabel(it)}${it.modified && it.presetName != null ? ' *' : ''}${it.settings.Layout === 'Booklet' ? ' · bound on the ' + (it.settings.Binding === 'Right' ? 'right' : 'left') : ''} · ${it.blank ? `blank sheet${it.settings.Copies > 1 ? ' × ' + it.settings.Copies : ''}, nothing printed` : `sheet ${r.sheet}${r.twoSided ? (r.isBack ? ', back' : ', front') : ''} · ${pagesOf(r)}`} · ${r.widthIn.toFixed(2)} × ${r.heightIn.toFixed(2)} in`;
    } catch (e) {
      if (my !== seq) return;
      stage.innerHTML = `<span class="none">${esc(e.message)}</span>`; q('#pvInfo').textContent = '';
    }
  }
  function go(d) {
    if (!one) return;
    let fi = pool.indexOf(one.it), side = one.side + d;
    while (fi >= 0 && fi < pool.length) {
      const n = sidesOf.get(pool[fi].id)?.sides || 0;
      if (side >= 0 && side < n) { one = { it: pool[fi], side }; drawOne(); return; }
      fi += d > 0 ? 1 : -1;
      if (fi < 0 || fi >= pool.length) return;
      side = d > 0 ? 0 : (sidesOf.get(pool[fi].id)?.sides || 0) - 1;
    }
  }
  function note() {
    const sheets = pool.reduce((n, it) => n + (sidesOf.get(it.id)?.sheets || 0), 0);
    q('#pvNote').textContent = `${plural(pool.length, 'file')} · about ${plural(sheets, 'sheet')} · ` +
      (one ? '← → or PgUp / PgDn: other sides and files · click the sheet: actual size · Esc: all sheets' : 'click a sheet to see it large');
  }
  q('#pvPrev').onclick = () => go(-1);
  q('#pvNext').onclick = () => go(1);
  q('#pvAllBtn').onclick = showAll;
  q('#pvOneBtn').onclick = () => { if (one) return; const g = all.querySelector('.pv-sheet .pv-side.near') || all.querySelector('.pv-side'); const it = byId(g?.closest('.pv-group')?.dataset.id); if (it) { one = { it, side: +g.dataset.side }; drawOne(); } };
  q('#pvSize').addEventListener('input', e => { size = +e.target.value; lsSet('sievphov-pv-size', size); const top = all.scrollTop / Math.max(1, all.scrollHeight); drawAll(); all.scrollTop = top * all.scrollHeight; });
  stage.addEventListener('click', e => { if (e.target.tagName !== 'IMG') return; zoomed = !zoomed; stage.classList.toggle('zoomed', zoomed); fitImg(); });
  const key = e => {
    if (!document.body.contains(box)) { document.removeEventListener('keydown', key); return; }
    if (!one || e.target.closest?.('select')) return;
    if (['ArrowRight', 'PageDown', 'ArrowDown'].includes(e.key)) { e.preventDefault(); go(1); }
    if (['ArrowLeft', 'PageUp', 'ArrowUp'].includes(e.key)) { e.preventDefault(); go(-1); }
  };
  document.addEventListener('keydown', key);
  q('[data-close]').onclick = close;
  let rt = 0; const onResize = () => { clearTimeout(rt); rt = setTimeout(() => document.body.contains(box) ? (one && fitImg()) : window.removeEventListener('resize', onResize), 150); };
  window.addEventListener('resize', onResize);

  all.innerHTML = '<p class="none">Counting the sheets…</p>';
  countSides(pool).then(() => {
    if (!document.body.contains(box)) return;
    drawFiles(); drawAll();
    if (start && pool.includes(start)) all.querySelector(`.pv-group[data-id="${start.id}"]`)?.scrollIntoView({ block: 'start' });
    all.focus({ preventScroll: true });
  });
  drawFiles();
}

/* ================================================================== right-click menu (as Sastra PDF's) */
function openMenu(x, y, entries, owner) {
  document.querySelector('.cmenu')?.remove();
  const m = document.createElement('div'); m.className = 'cmenu'; m.tabIndex = -1; m.setAttribute('role', 'menu');
  m.innerHTML = entries.map((e, i) => e === '-' ? '<hr>' : e.cap ? `<div class="cap">${esc(e.cap)}</div>` :
    `<button class="ci" role="menuitem" data-i="${i}" ${e.disabled ? 'disabled' : ''}>${e.icon ? svg(e.icon) : '<span></span>'}<span>${esc(e.label)}</span><span class="kb">${esc(e.kb || '')}</span></button>`).join('');
  document.body.appendChild(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
  m.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
  owner?.setAttribute('aria-expanded', 'true');
  const done = () => { m.remove(); owner?.setAttribute('aria-expanded', 'false'); document.removeEventListener('mousedown', out, true); document.removeEventListener('keydown', key, true); };
  const out = e => { if (!m.contains(e.target)) done(); };
  const key = e => {
    const items = [...m.querySelectorAll('.ci:not(:disabled)')], at = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(at + 1) % items.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(at - 1 + items.length) % items.length]?.focus(); }
  };
  m.addEventListener('click', e => { const b = e.target.closest('.ci'); if (!b) return; const en = entries[+b.dataset.i]; done(); en.run(); });
  setTimeout(() => { document.addEventListener('mousedown', out, true); document.addEventListener('keydown', key, true); });
  m.focus();
}
rowsEl.addEventListener('contextmenu', e => {
  e.preventDefault();
  const row = e.target.closest('.row'); if (!row) return;
  if (!state.sel.has(row.dataset.id)) selectOnly([row.dataset.id]);
  const n = state.sel.size, idle = !state.printing, items = selected();
  openMenu(e.clientX, e.clientY, [
    { cap: 'Apply preset' },
    ...state.lib.Presets.map((p, i) => ({ label: p.Name, kb: i < 9 ? `Ctrl+${i + 1}` : '', icon: 'stack', disabled: !idle, run: () => applyPresetCmd(p) })),
    { label: 'Manage presets…', icon: 'edit', run: () => openPresetManager() },
    '-',
    { label: 'Save as preset…', icon: 'plus', disabled: n !== 1 || !idle, run: saveAsPresetCmd },
    { label: 'Reset to preset', icon: 'reset', disabled: !idle || !items.some(it => it.presetId && it.modified), run: () => { M.resetToPreset(selected(), state.lib); markDirty(); refresh(); } },
    { label: 'Copy settings', kb: 'Ctrl+Shift+C', icon: 'copy', disabled: n !== 1, run: copySettings },
    { label: 'Paste settings', kb: 'Ctrl+Shift+V', icon: 'paste', disabled: !state.clipboard || !idle, run: pasteSettings },
    '-',
    { label: 'Tick', icon: 'check', run: () => { for (const it of selected()) if (it.pageCount) it.checked = true; markDirty(); refresh({ estimate: false, panel: false }); } },
    { label: 'Untick', icon: 'uncheck', run: () => { for (const it of selected()) it.checked = false; markDirty(); refresh({ estimate: false, panel: false }); } },
    { label: 'Preview', kb: 'F5', icon: 'eye', run: () => openPreview(byId(row.dataset.id)) },
    { label: 'Show in folder', icon: 'open', disabled: !!byId(row.dataset.id).blank, run: () => desk?.showInFolder(byId(row.dataset.id).path) },
    '-',
    { label: 'Insert blank paper after', kb: 'Ctrl+B', icon: 'blank', disabled: !idle, run: insertBlankCmd },
    { label: n > 1 ? `Remove ${n} files from list` : 'Remove from list', kb: 'Del', icon: 'trash', disabled: !idle, run: () => removeItems(selected()) }
  ]);
});
function copySettings() { const it = selected()[0]; if (!it) return; state.clipboard = M.clone(it.settings); toast(`Settings of "${it.name}" copied. Select files and paste them.`); }
function pasteSettings() {
  if (!state.clipboard || state.printing) return;
  const items = selected(); if (!items.length) { toast('Select the files to paste the settings into.'); return; }
  M.setAll(items, state.clipboard, state.lib); markDirty(); refresh(); toast(`Settings pasted into ${plural(items.length, 'file')}.`);
}

/* ================================================================== About and What's new (as in Sastra PDF) */
const AUTHOR = {
  name: 'Sunnguon Taing', handle: 'smith89k', role: 'Full-stack & DevOps developer · Cambodia', photo: 'author.jpg',
  bio: 'I build web apps, run my own servers and make everyday tools.',
  stack: ['Laravel', 'PHP', 'JavaScript', 'TypeScript', 'Tailwind CSS', 'Docker', 'Electron'],
  links: [['Website', 'smith89k.com', 'https://smith89k.com', 'web'], ['LinkedIn', 'in/sunnguon', 'https://www.linkedin.com/in/sunnguon/', 'linkedin'], ['GitHub', 'smith89k', 'https://github.com/smith89k', 'github']]
};
// open-source code that ships in the app: [name, version, by, licence, link] — keep the versions in step with package.json / the engine
const CREDITS = [
  ['Electron', '44.7.2', 'Electron contributors, GitHub Inc.', 'MIT', 'https://www.electronjs.org/'],
  ['.NET', '8', 'Microsoft, .NET Foundation', 'MIT', 'https://dotnet.microsoft.com/'],
  ['PDFium', '', 'The PDFium authors (Google)', 'BSD-3', 'https://pdfium.googlesource.com/pdfium/'],
  ['PDFtoImage', '5.4.0', 'David Sungaila', 'MIT', 'https://github.com/sungaila/PDFtoImage'],
  ['SkiaSharp', '', 'Microsoft', 'MIT', 'https://github.com/mono/SkiaSharp'],
  ['IBM Plex Sans & Mono', '', 'IBM', 'SIL OFL 1.1', 'https://github.com/IBM/plex'],
  ['Noto Sans Khmer', '', 'Google', 'SIL OFL 1.1', 'https://github.com/notofonts/khmer']
];
const CREDITS_NOTE = 'PDFium comes through PDFtoImage (bblanchon/pdfium-binaries, MIT packaging). Electron includes Chromium, Node.js and FFmpeg; their licences are in LICENSES.chromium.html in the app folder. The installer is made with electron-builder (MIT) and NSIS (zlib). The font files are packaged by Fontsource (MIT).';
function openAbout() {
  if (anyModal()) return;
  const A = AUTHOR, out = 'target="_blank" rel="noopener"';
  const { box, close } = openBox('about', `<div class="about-head"><img src="logo.png" alt="" width="56" height="56">
      <div><div class="about-name">Sievphov<span class="brand-km" lang="km">សៀវភៅ</span></div><div class="about-ver"></div></div></div>
    <p>Print many PDF files in one go, each with its own printer, paper tray and settings. Your files stay on this computer.</p>
    <p class="note"><span lang="km">សៀវភៅ</span> (sievphov) means "book": Sievphov was made for printing books — two-sided, booklets, page numbers in Khmer.</p>
    <section aria-label="Made by"><h3>Made by</h3>
      <div class="author"><img src="${A.photo}" alt="" width="64" height="64"><div><b>${A.name}<span class="handle">${A.handle}</span></b><span>${A.role}</span></div></div>
      <p>${A.bio}</p>
      <ul class="chips" aria-label="Skills">${A.stack.map(t => `<li>${t}</li>`).join('')}</ul>
      <div class="links">${A.links.map(([n, v, u, ic]) => `<a class="link-${ic}" href="${u}" ${out} title="${u}">${svg(ic)}<span><b>${n}</b><small>${v}</small></span></a>`).join('')}</div>
    </section>
    <section aria-label="Open-source credits"><h3>Built with open source</h3>
      <ul class="credits">${CREDITS.map(([n, v, by, lic, u]) => `<li><span class="cn"><a href="${u}" ${out}>${n}</a>${v ? ` <span class="cv">${v}</span>` : ''}</span><span>${by}</span><span>${lic}</span></li>`).join('')}</ul>
      <p class="note">${CREDITS_NOTE}</p></section>
    <div class="acts"><span class="note">© 2026 smith89k</span><button class="btn primary" data-close>Close</button></div>`);
  desk?.appVersion().then(v => { box.querySelector('.about-ver').textContent = 'Version ' + v; }, () => {});
  box.querySelector('[data-close]').onclick = close;
  box.querySelector('[data-close]').focus({ preventScroll: true });
}
const NOTES_SEEN = 'sievphov-notes-seen';
const KIND_WORDS = { new: 'New', improved: 'Improved', fixed: 'Fixed', removed: 'Removed' };
function notesList(notes) {
  const K = SievphovNotes.KINDS, sorted = notes.map((n, i) => [n, i]).sort((a, b) => K.indexOf(a[0].kind) - K.indexOf(b[0].kind) || a[1] - b[1]);
  return `<ul class="notes-list">${sorted.map(([n]) => `<li><span class="notes-kind notes-kind-${n.kind}">${KIND_WORDS[n.kind]}</span><span>${esc(n.text)}</span></li>`).join('')}</ul>`;
}
function openNotes(version) {
  if (anyModal()) return false;
  const cur = SievphovNotes.noteFor(version), past = SievphovNotes.earlierNotes(version);
  const { box, close } = openBox('notes', `<div class="notes-head"><h2>${cur ? `What's new in ${esc(version)}` : "What's new"}</h2>${cur ? `<div class="notes-date">${esc(cur.date)}</div>` : ''}</div>
    <div class="notes-body">${cur ? notesList(cur.notes) : ''}${cur && past.length ? '<button class="btn notes-more" data-more>See earlier versions ›</button>' : ''}${past.length ? `<div class="notes-earlier"${cur ? ' hidden' : ''}>${past.map(e => `<section class="notes-past"><h3>${esc(e.version)}<span>${esc(e.date)}</span></h3>${notesList(e.notes)}</section>`).join('')}</div>` : ''}</div>
    <div class="acts"><button class="btn primary" data-close>Close</button></div>`, { onCancel: () => { lsSet(NOTES_SEEN, version); close(); } });
  box.addEventListener('click', e => {
    const more = e.target.closest('[data-more]');
    if (more) { more.hidden = true; const l = box.querySelector('.notes-earlier'); l.hidden = false; l.scrollIntoView({ block: 'start' }); return; }
    if (e.target.closest('[data-close]')) { lsSet(NOTES_SEEN, version); close(); }
  });
  box.querySelector('[data-close]').focus({ preventScroll: true });
  return true;
}

/* ================================================================== theme, title row, panel width */
const THEMES = ['system', 'light', 'dark'];
function setTheme(t) {
  if (!THEMES.includes(t)) t = 'system';
  if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  lsSet('sievphov-theme', t);
  $('#bTheme').innerHTML = svg(t === 'light' ? 'sun' : t === 'dark' ? 'moon' : 'sys');
  $('#bTheme').title = `Theme: ${t === 'system' ? 'same as Windows' : t} (click to change)`;
  desk?.setTheme(t);
}
$('#bTheme').onclick = () => setTheme(THEMES[(THEMES.indexOf(lsGet('sievphov-theme') || 'system') + 1) % 3]);
// the menu words in the title row (as in Bohpum): each opens its own menu under it; Alt+F/E/P/V/H and F10 too
const MENU_KEYS = { f: 0, e: 1, p: 2, v: 3, h: 4 };
function openAppMenu(i) {
  const b = document.querySelector(`.menu-btn[data-menu="${i}"]`);
  if (!b || !desk || anyModal()) return;
  const r = b.getBoundingClientRect();
  b.classList.add('open');
  Promise.resolve(desk.showMenu(i, r.left, r.bottom)).finally(() => b.classList.remove('open'));
}
document.querySelectorAll('.menu-btn').forEach(b => b.addEventListener('click', () => openAppMenu(+b.dataset.menu)));
$('#bAbout').onclick = openAbout;
$('#bAddFiles').onclick = $('#bAddFiles2').onclick = addFilesCmd;
$('#bAddFolder').onclick = $('#bAddFolder2').onclick = addFolderCmd;
$('#bBlank').onclick = insertBlankCmd;
$('#bOpenJob').onclick = openJobCmd;
$('#bSaveJob').onclick = () => saveJob(false);
$('#bPrintTb').onclick = printCmd;
$('#bRemove').onclick = () => removeItems(selected());
$('#bUp').onclick = () => moveSelected(-1);
$('#bDown').onclick = () => moveSelected(1);
$('#bPreview').onclick = () => openPreview();
$('#bEstimate').onclick = estimateCmd;
// the side panels' inner edges: drag to resize, double-click for the normal width (as Bohpum's Pages panel)
function resizer(id, cssVar, key, min, max, widthAt) {
  const r = $(id);
  const setW = w => { document.documentElement.style.setProperty(cssVar, w + 'px'); lsSet(key, w); };
  r.addEventListener('pointerdown', e => {
    e.preventDefault(); r.setPointerCapture(e.pointerId); document.body.classList.add('resizing'); r.classList.add('active');
    const move = ev => setW(Math.max(min, Math.min(max, Math.round(widthAt(ev.clientX)))));
    const up = () => { document.body.classList.remove('resizing'); r.classList.remove('active'); r.removeEventListener('pointermove', move); r.removeEventListener('pointerup', up); };
    r.addEventListener('pointermove', move); r.addEventListener('pointerup', up);
  });
  r.addEventListener('dblclick', () => { document.documentElement.style.removeProperty(cssVar); try { localStorage.removeItem(key); } catch {} });
}
resizer('#toolsResizer', '--tools-w', 'sievphov-tools-w', 300, 520, x => innerWidth - x);

/* ================================================================== keys and menu commands */
const COMMANDS = {
  addFiles: addFilesCmd, addFolder: addFolderCmd, openJob: openJobCmd, saveJob: () => saveJob(false), saveJobAs: () => saveJob(true), print: printCmd, afterPrint: openAfterPrint,
  selectAll: () => selectOnly(state.items.map(it => it.id)), remove: () => removeItems(selected()),
  insertBlank: insertBlankCmd,
  removePrinted: () => removeItems(state.items.filter(it => it.status === 'printed')), clear: clearList,
  up: () => moveSelected(-1), down: () => moveSelected(1), copySettings, pasteSettings,
  reset: () => { M.resetToPreset(selected(), state.lib); markDirty(); refresh(); },
  managePresets: () => openPresetManager(), saveAsPreset: saveAsPresetCmd,
  importPresets: () => openPresetManager(), exportPresets: () => desk?.exportPresets({ Presets: state.lib.Presets }).then(p => p && toast('Presets exported.')),
  preview: () => openPreview(), estimate: estimateCmd,
  themeSystem: () => setTheme('system'), themeLight: () => setTheme('light'), themeDark: () => setTheme('dark'),
  whatsNew: () => desk?.appVersion().then(openNotes), about: openAbout
};
let altAlone = false;
document.addEventListener('keydown', e => {
  altAlone = e.key === 'Alt' && !e.ctrlKey && !e.shiftKey;
  if (anyModal() || document.querySelector('.cmenu')) return;
  const typing = e.target.closest?.('input,textarea,select');
  const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  const run = (name, ev = e) => { ev.preventDefault(); COMMANDS[name](); };
  if (ctrl && !e.shiftKey && /^[1-9]$/.test(e.key)) { const p = state.lib.Presets[+e.key - 1]; e.preventDefault(); if (p) applyPresetCmd(p); return; }
  if (ctrl && !e.shiftKey && k === 'o') return run('addFiles');
  if (ctrl && e.shiftKey && k === 'o') return run('addFolder');
  if (ctrl && k === 'j') return run('openJob');
  if (ctrl && !e.shiftKey && k === 'b') return run('insertBlank');
  if (ctrl && !e.shiftKey && k === 's') return run('saveJob');
  if (ctrl && e.shiftKey && k === 's') return run('saveJobAs');
  if (ctrl && k === 'p') return run('print');
  if (e.key === 'F5') return run('preview');
  if (e.key === 'F10') { e.preventDefault(); openAppMenu(0); return; }
  if (e.altKey && !ctrl && !e.shiftKey && MENU_KEYS[k] != null) { e.preventDefault(); altAlone = false; openAppMenu(MENU_KEYS[k]); return; }
  if (ctrl && e.shiftKey && k === 'c') return run('copySettings');
  if (ctrl && e.shiftKey && k === 'v') return run('pasteSettings');
  if (typing) return;
  if (ctrl && k === 'a') return run('selectAll');
  if (e.key === 'Delete') return run('remove');
  if (e.altKey && e.key === 'ArrowUp') return run('up');
  if (e.altKey && e.key === 'ArrowDown') return run('down');
  if (!e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && state.items.length) {
    e.preventDefault();
    const at = state.items.findIndex(it => it.id === state.anchor);
    const next = state.items[Math.max(0, Math.min(state.items.length - 1, (at < 0 ? -1 : at) + (e.key === 'ArrowDown' ? 1 : -1)))];
    if (e.shiftKey && state.anchor) { state.sel.add(next.id); state.anchor = next.id; afterSelect(); } else selectOnly([next.id]);
    rowsEl.querySelector(`.row[data-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' });
    return;
  }
  if (e.key === ' ' && state.sel.size) { e.preventDefault(); const on = !selected().every(it => it.checked); for (const it of selected()) if (it.pageCount) it.checked = on; markDirty(); refresh({ estimate: false, panel: false }); }
  if (e.key === 'Escape' && state.sel.size) selectOnly([]);
});
// Alt pressed and let go alone opens the menu (as in Sastra PDF)
document.addEventListener('keyup', e => { if (e.key === 'Alt' && altAlone) { altAlone = false; e.preventDefault(); openAppMenu(0); } });
document.addEventListener('mousedown', () => { altAlone = false; });

/* ================================================================== start */
async function start() {
  setTheme(lsGet('sievphov-theme') || 'system');
  if (!desk) { toast('Sievphov runs as a desktop app. Start it with run.bat or the installed shortcut.', true); renderRows(); buildPanel(); return; }
  desk.onMenu(cmd => { if (COMMANDS[cmd] && !(anyModal() && !['themeSystem', 'themeLight', 'themeDark'].includes(cmd))) COMMANDS[cmd](); });
  desk.onEngineEvent(onEngineEvent);
  desk.onOpenPaths(paths => { if (!state.printing) openPaths(paths); });
  desk.onFullScreen(on => document.documentElement.classList.toggle('fullwin', on));
  desk.onCloseRequest(async () => {
    if (state.printing && !(await askConfirm('Printing is still running. Stop it and close Sievphov?', 'Stop and close'))) return;
    if (state.printing) await eng('stop').catch(() => {});
    desk.closeNow();
  });
  const [lib, settings] = await Promise.all([desk.storeRead('presets'), desk.storeRead('settings')]);
  const read = lib.data && M.readLibrary(lib.data);
  if (read) state.lib = read; else { state.lib = M.starterLibrary(); await savePresets(); }
  if (settings.data && typeof settings.data === 'object') Object.assign(state.settings, settings.data);
  if (!Array.isArray(state.settings.Passwords)) state.settings.Passwords = [];
  if (!Array.isArray(state.settings.TraySwaps)) state.settings.TraySwaps = [];
  await loadPrinters();
  updateTitle(); renderRows(); buildPanel();
  const paths = await desk.initialPaths();
  if (paths.length) await openPaths(paths);
  try {
    const v = await desk.appVersion();
    document.documentElement.dataset.notes = SievphovNotes.shouldShow(v, lsGet(NOTES_SEEN)) && openNotes(v) ? 'shown' : 'none';
  } catch { document.documentElement.dataset.notes = 'none'; }
  document.documentElement.dataset.ready = '1';
}
start();
})();
