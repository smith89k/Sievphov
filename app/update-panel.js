// Sievphov — the Microsoft Store copy's update badge and panel, as Sastra PDF's (E:\_httdocs\SastraPDF\app\update-panel.js;
// keep the two in step). main.js keeps one update state (store-update.js) and sends it here. The badge paints from it; the
// panel opens only from the badge or Help › Check for Updates, never by itself. In every other copy main answers null and
// nothing here does anything (app.js then points Check for Updates to the Store).
(() => {
'use strict';

const MB = 1048576;
const LIVE = ['available', 'downloading', 'ready'];   // what the update state itself decides; the others are the panel's own

function badgeText(s) {
  if (!s) return '';
  if (s.stage === 'downloading') return `↓ Update ${Math.round(Number(s.percent) || 0)}%`;
  if (s.stage === 'ready') return 'Update ready';
  if (s.stage === 'available') return 'Update available';
  return '';
}
function sizeText(transferred, total) { return total ? `${Math.round(transferred / MB)} of ${Math.round(total / MB)} MB` : ''; }
function timeLeftText(remaining, bytesPerSecond) {
  if (!(bytesPerSecond > 0)) return '';
  const seconds = remaining / bytesPerSecond;
  if (seconds < 60) return 'less than a minute left';
  const minutes = Math.ceil(seconds / 60);
  return `about ${minutes} minute${minutes === 1 ? '' : 's'} left`;
}

// A stage's words and buttons. Buttons: [label, kind, action]; the last has the focus (but Later on ready).
function stageParts(view) {
  const next = view.next, later = ['Later', 'outline', 'close'], store = ['Open in Store', 'outline', 'store'], okBtn = ['OK', 'primary', 'close'];
  const tryLater = 'Try again later, or update from the Store.';
  switch (view.stage) {
    case 'checking': return { title: 'Checking for updates…', spin: true, buttons: [['Close', 'outline', 'close']] };
    case 'current': return { title: 'You have the latest version', line: `Version ${view.current} is the newest one.`, buttons: [okBtn] };
    case 'available': return { title: 'Update available', line: 'Windows will ask before downloading.', versions: true, buttons: [later, ['Download', 'primary', 'download']] };
    case 'downloading': return { title: 'Update available', line: 'You can keep working.', versions: true, bar: true, buttons: [['Hide', 'outline', 'close']] };
    case 'ready': return {
      title: 'Update ready', versions: true, bar: true,
      line: `Sievphov will close to install ${next || 'the update'}. If it doesn't open again, start it from the Start menu.${view.silent ? '' : ' Windows may ask first.'}`,
      buttons: [later, ['Install', 'primary', 'install']],
      hint: view.silent ? 'Later: the Store installs it in its own time.' : 'Later: it stays ready. Click the badge when you want to install.'
    };
    case 'installing': return { title: 'Installing…', spin: true, line: 'Sievphov will close in a moment.', buttons: [] };
    case 'install-failed': return { title: "The update couldn't be installed", line: tryLater, buttons: [store, okBtn] };
    case 'download-failed': return { title: "The download didn't finish", line: tryLater, buttons: [store, okBtn] };
    default: return { title: "Couldn't check for updates", line: 'Check the internet connection and try again later.', buttons: [store, okBtn] };
  }
}
function progressParts(view) {
  const ready = view.stage === 'ready', size = sizeText(view.transferred, view.total);
  return {
    percent: ready ? 100 : Math.max(0, Math.min(100, Math.round(Number(view.percent) || 0))),
    said: ready ? 'Downloaded' : `Downloading${size ? ` · ${size}` : ''}`,
    left: ready ? '' : timeLeftText(view.total - view.transferred, view.bytesPerSecond)
  };
}

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function panelHtml(view) {
  const p = stageParts(view);
  const versions = p.versions ? `<div class="u-versions"><div class="u-old"><div class="u-k">This version</div><div class="u-v">${esc(view.current)}</div></div><div class="u-arrow" aria-hidden="true">→</div><div class="u-new"><div class="u-k">New version</div>${view.next ? `<div class="u-v">${esc(view.next)}</div>` : ''}</div></div>` : '';
  const bar = p.bar ? '<div class="u-bar"><i></i></div><div class="u-prog"><span></span><span></span></div>' : '';
  const line = p.line ? `<p class="detail">${esc(p.line)}</p>` : '';
  const hint = p.hint ? `<p class="u-hint">${esc(p.hint)}</p>` : '';
  const acts = p.buttons.map(([label, kind, act]) => `<button class="btn ${kind}" data-act="${act}">${esc(label)}</button>`).join('');
  return `<h2>${p.spin ? '<span class="spin"></span>' : ''}${esc(p.title)}</h2>${versions}${bar}${line}${hint}<div class="acts${acts ? '' : ' empty'}">${acts}</div>`;
}

let desk = null, ask = null, screenFree = () => true, printing = () => false, badge = null;
let current = null, bg = null, view = null, turn = 0, ready = Promise.resolve(), shownAt = 0;
const INSTALL_SETTLE_MS = 500;   // Install takes Hide's place when a download ends: a click meant for Hide must not install
const onTop = () => [...document.querySelectorAll('.modal-bg')].at(-1) === bg;   // a question over the panel keeps the keys

function paintProgress(box, v) {
  const fill = box.querySelector('.u-bar i');
  if (!fill) return;
  const { percent, said, left } = progressParts(v);
  fill.style.width = `${percent}%`;
  const [a, b] = box.querySelectorAll('.u-prog span');
  a.textContent = said; b.textContent = left;
}
function show(v) {
  if (!bg) {
    bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = '<div class="modal update-panel" role="dialog" aria-modal="true"></div>';
    bg.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (b) act(b.dataset.act);
      else if (e.target === bg && view.stage !== 'installing') close();
    });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(bg);
  }
  const box = bg.firstChild;
  // Progress comes often: while the same download runs only the bar and its words change, so the focus stays.
  const same = view && view.stage === 'downloading' && v.stage === 'downloading' && view.next === v.next;
  view = v; box.dataset.stage = v.stage;
  if (!same) {
    box.innerHTML = panelHtml(v); shownAt = performance.now();
    // Enter must never install: on ready the focus goes to Later
    if (onTop()) box.querySelector(v.stage === 'ready' ? '.acts button' : '.acts button:last-child')?.focus();
  }
  paintProgress(box, v);
}
function close() {
  if (!bg) return;
  bg.remove(); bg = null; view = null; turn++;
  document.removeEventListener('keydown', onKey, true);
}
function onKey(e) {
  if (e.key !== 'Escape') return;
  if (!onTop()) return;
  e.stopPropagation();
  if (view.stage !== 'installing') close();
}
function showState() {
  if (LIVE.includes(current?.stage)) return show(current);
  if (current?.failed) return show({ ...current, stage: 'download-failed' });
  close();
}
function paint() {
  const text = badgeText(current);
  badge.textContent = text; badge.hidden = !text;
  badge.classList.toggle('ready', current?.stage === 'ready');
  badge.title = current?.stage === 'downloading' ? 'A new version of Sievphov is downloading. Click to see it.' : text ? 'A new version of Sievphov. Click to see it.' : '';
  document.documentElement.classList.toggle('has-update', !!text);
}
function onState(s) {
  current = s; paint();
  if (bg && LIVE.includes(view.stage)) showState();
}

async function install() {
  if (printing()) {
    await ask.choice("Sievphov can't install while it is printing.", [['OK', 'primary']], { detail: 'Let the printing finish, then click Install again.' });
    return;
  }
  if (!await ask.unsaved()) return;
  const was = current;
  show({ ...was, stage: 'installing' });
  let r; try { r = await desk.storeUpdate('install'); } catch { r = { ok: false, reason: 'failed' }; }
  if (r && r.ok) return;   // Windows is closing the app
  const reason = r && r.reason;
  if (reason === 'failed') return show({ ...was, stage: 'install-failed' });
  if (reason === 'none') return close();
  show(was);   // No in Windows' box
}
function act(what) {
  if (what === 'close') return close();
  if (what === 'install') return performance.now() - shownAt < INSTALL_SETTLE_MS ? undefined : install();
  if (what === 'download') return void desk.storeUpdate('download').catch(() => {});
  if (what === 'store') { desk.storeUpdate('open-store').catch(() => {}); close(); }
}

// Help › Check for Updates: the panel, on its answer. Closing it meanwhile drops the answer.
async function check() {
  await ready;
  if (!screenFree() || !current) return;
  show({ ...current, stage: 'checking' });
  const mine = ++turn;
  let a; try { a = await desk.storeUpdate('check'); } catch { a = { kind: 'failed' }; }
  if (mine !== turn) return;
  try { current = await desk.storeUpdate('state') || current; paint(); } catch {}
  if (mine !== turn) return;
  if (a && a.kind === 'current') return show({ ...current, stage: 'current' });
  if (a && a.kind === 'update') return showState();
  show({ ...current, stage: 'failed' });
}

// o: { desk, askUnsaved() → true to go on, askChoice, screenFree() → no other box open, printing() → printing now }
function init(o) {
  desk = o.desk; ask = { unsaved: o.askUnsaved, choice: o.askChoice }; screenFree = o.screenFree; printing = o.printing;
  badge = document.getElementById('bUpdate');
  ready = desk.storeUpdate('state').then(s => {
    if (!s) return;
    current = s; paint();
    desk.onStoreUpdate(onState);
    badge.onclick = () => { if (screenFree()) showState(); };
  }).catch(e => console.warn(e));
  return ready;
}

window.SievphovUpdatePanel = { init, check, active: async () => { await ready; return !!current; }, badgeText, sizeText, timeLeftText, stageParts };
})();
