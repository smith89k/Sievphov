# Manage presets: sample on top, settings in tabs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Manage presets box two columns: preset list on the left; on the right the name, a big Sample paper strip, and the settings in tabs (one section at a time, opening on Layout).

**Architecture:** `buildEditor` (app/app.js) gets a `tabs` option that builds a tab bar and shows one section at a time; the side panel keeps calling it without `tabs`. `openPresetManager` gets new markup (`.pmain`) and passes `tabs`. CSS replaces the three-column rules. Spec: `docs/superpowers/specs/2026-10-29-preset-box-tabs-design.md`.

**Tech Stack:** Electron, plain JS (no bundler), CSS; window test in `tests/ui/run.js`, node tests via `pnpm test`.

## Global Constraints

- Tab state key: `sievphov-preset-tab`, via the existing `lsGet` / `lsSet`; default tab `layout`.
- Side heights: 220 px; 150 px under `max-height:820px`; 110 px under `max-height:680px`. Tab body `min-height:200px`.
- The main window's settings panel must not change (it calls `buildEditor` without `tabs`).
- The window test (`pnpm run test:ui`) is run only after the user says yes.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Tabs in the editor, new box shape

**Files:**
- Modify: `app/app.js` — `buildEditor` (around line 707), `openPresetManager` markup and `drawEditor` (around line 990–1023)
- Modify: `app/app.css` — lines 316 (`.modal.presets`), 340–353 (`.pedit`, sample, media query)
- Test: `tests/ui/run.js` (Task 2)

**Interfaces:**
- Produces: `buildEditor(root, ctx, { sections, folded, tabs })`, `tabs = { bar: HTMLElement, key: string, first: string } | null`. Tab buttons: `.ptab[role=tab][data-sec][aria-selected]`, dot `.ptab .dot` (only for sections with `on`). Sections in tab mode: `.tsec.tabbed`, the hidden ones have `hidden`. Box ids: `#pmName`, `#pmTabs`, `#pmEdit`, `#pmSample`, `#pmSampleSum`.

- [ ] **Step 1: `buildEditor` — option and tab buttons.** Change the signature and the top of the loop:

```js
function buildEditor(root, ctx, { sections = SECTIONS, folded = true, tabs = null } = {}) {
  const bound = [];
  const foldedList = new Set(JSON.parse(lsGet('sievphov-folded') || '["watermark","logo"]'));
  const settingsOf = () => ctx.items().map(x => x.settings);
  // tabs = { bar, key, first }: one section at a time, picked in a tab bar (Manage presets)
  const tabBtns = [];
  let tab = tabs ? lsGet(tabs.key) : null;
  if (tabs) { if (!sections.some(s => s.sec === tab)) tab = tabs.first; tabs.bar.innerHTML = ''; tabs.bar.setAttribute('role', 'tablist'); }
  for (const sec of sections) {
    const el = document.createElement('section');
    el.className = 'tsec' + (tabs ? ' tabbed' : folded && foldedList.has(sec.sec) ? ' folded' : '');
```

  After the existing `el.querySelector('.tsec-head').addEventListener(...)` block, replace the `if (sec.on) bound.push(...)` line with:

```js
    let dot = null;
    if (tabs) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ptab'; b.dataset.sec = sec.sec; b.setAttribute('role', 'tab');
      b.innerHTML = `${svg(sec.icon)}<span>${esc(sec.title)}</span>${sec.on ? '<i class="dot" title="On" hidden></i>' : ''}`;
      b.addEventListener('click', () => showTab(sec.sec));
      b.addEventListener('keydown', e => {
        const d = { ArrowLeft: -1, ArrowRight: 1 }[e.key]; if (!d) return;
        e.preventDefault(); const n = tabBtns[(tabBtns.indexOf(b) + d + tabBtns.length) % tabBtns.length]; showTab(n.dataset.sec); n.focus();
      });
      tabs.bar.appendChild(b); tabBtns.push(b); dot = b.querySelector('.dot');
    }
    if (sec.on) bound.push({ sync: list => { const on = list.some(s => M.get(s, sec.on)); el.querySelector('.count').hidden = !on; if (dot) dot.hidden = !on; } });
```

- [ ] **Step 2: `buildEditor` — show one section.** Just before `const api = { sync() ...`, add:

```js
  function showTab(id) {
    tab = id; lsSet(tabs.key, id);
    for (const el of root.querySelectorAll(':scope > .tsec.tabbed')) el.hidden = el.dataset.sec !== id;
    for (const b of tabBtns) { const on = b.dataset.sec === id; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; }
    root.scrollTop = 0;
  }
  if (tabs) showTab(tab);
```

- [ ] **Step 3: `openPresetManager` markup.** Replace the two lines

```html
    <div class="pedit" id="pmEdit"></div>
    <div class="psample"><div class="ps-head"><b>Sample paper</b><span id="pmSampleSum"></span></div><div class="ps-body" id="pmSample"></div></div>
```
  with

```html
    <div class="pmain"><div class="pname" id="pmName"></div>
      <div class="psample"><div class="ps-head"><b>Sample paper</b><span id="pmSampleSum"></span></div><div class="ps-body" id="pmSample"></div></div>
      <div class="ptabs" id="pmTabs" aria-label="Settings"></div>
      <div class="pedit" id="pmEdit"></div></div>
```
  and change `const listEl2 = ..., editEl = box.querySelector('#pmEdit');` to also take `nameEl = box.querySelector('#pmName'), tabsEl = box.querySelector('#pmTabs')`.

- [ ] **Step 4: `drawEditor`.** Replace the whole function with:

```js
  function drawEditor() {
    editEl.innerHTML = ''; nameEl.innerHTML = ''; tabsEl.innerHTML = '';
    box.querySelector('.pmain').classList.toggle('empty', !cur);
    if (!cur) { editEl.innerHTML = '<p class="hint" style="padding:20px">Pick a preset on the left, or make a new one.</p>'; sampleSoon(0); return; }
    nameEl.innerHTML = `<input type="text" value="${esc(cur.Name)}" aria-label="Preset name">`;
    const input = nameEl.querySelector('input');
    input.addEventListener('change', () => { const v = input.value.trim(); if (v) cur.Name = M.uniqueName(draft, v, cur); input.value = cur.Name; drawList(); });
    const holder = { get settings() { return cur.Settings; } };
    ed = buildEditor(editEl, { items: () => [holder], lib: null, set(path, value) { M.setField([{ settings: cur.Settings, presetId: null }], path, value, draft); ed.sync(); drawList(); sampleSoon(); } },
      { folded: false, tabs: { bar: tabsEl, key: 'sievphov-preset-tab', first: 'layout' } });
    sampleSoon(0);
  }
```

- [ ] **Step 5: CSS.** In `app/app.css`:
  - line 316 → `.modal.presets{max-width:min(1360px,calc(100vw - 40px));height:min(880px,calc(100vh - 40px));display:grid;grid-template-columns:240px minmax(0,1fr);grid-template-rows:auto minmax(0,1fr) auto}`
  - line 340 (`.presets .pedit{...}`) → the block below; delete the old `.psample`, `.ps-body`, `.ps-sheet` rules and the `@media (max-width:1180px)` line, keep `.ps-head`, `.ps-head span`, `.psample.busy .ps-body`, `.ps-side.land`, `.ps-side img`, `.ps-sheet figcaption`:

```css
.presets .pmain{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden;background:var(--chrome)}
.presets .pmain.empty>:not(.pedit){display:none}
.presets .pedit{flex:1;overflow:auto;min-height:200px;background:var(--chrome)}
.tsec.tabbed{border-bottom:0}
.tsec.tabbed>h3{display:none}
/* settings in tabs, one section at a time */
.presets .ptabs{flex:none;display:flex;gap:2px;padding:0 12px;border-bottom:1px solid var(--line);overflow-x:auto}
.presets .ptab{display:flex;align-items:center;gap:7px;height:42px;padding:0 12px;margin-bottom:-1px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--ink-2);font:inherit;font-size:12.5px;white-space:nowrap;cursor:pointer}
.presets .ptab:hover{color:var(--ink)}
.presets .ptab[aria-selected="true"]{color:var(--accent);border-bottom-color:var(--accent);font-weight:500}
.presets .ptab:focus-visible{outline:2px solid var(--accent);outline-offset:-2px;border-radius:6px 6px 0 0}
.presets .ptab svg{width:15px;height:15px;color:var(--accent)}
.presets .ptab .dot{width:6px;height:6px;border-radius:50%;background:var(--accent)}
/* Sample paper: the chosen preset on 8 numbered pages, the sheets in a row */
.presets .psample{flex:none;display:flex;flex-direction:column;border-bottom:1px solid var(--line);background:var(--pasteboard)}
.presets .ps-body{display:flex;align-items:flex-start;justify-content:safe center;gap:22px;overflow-x:auto;overflow-y:hidden;padding:16px 18px;transition:opacity .15s}
.ps-sheet{flex:none;margin:0;display:flex;flex-direction:column;align-items:center;gap:6px}
.ps-side{height:220px;aspect-ratio:827/1169;background:#fff;box-shadow:var(--page-shadow)}
@media (max-height:820px){.ps-side{height:150px}}
@media (max-height:680px){.ps-side{height:110px}}
```
  - `.presets .pname` keeps its rule (it now sits at the top of `.pmain`).

- [ ] **Step 6: Checks.** Run `node --check app/app.js` (expect no output) and `pnpm test` (expect all pass, 0 fail).

- [ ] **Step 7: Commit.**

```bash
git add app/app.js app/app.css
git commit -m "Manage presets: sample paper on top, settings in tabs (opens on Layout)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Window test for the tabs

**Files:**
- Modify: `tests/ui/run.js` lines 168–181 (the Manage presets part)

**Interfaces:**
- Consumes: ids and classes from Task 1 (`#pmTabs`, `.ptab[data-sec]`, `.dot`, `#pmEdit > .tsec`).

- [ ] **Step 1: Before `await click('#pManage');`** add `await js(`localStorage.removeItem('sievphov-preset-tab')`);` and after the `'presets box'` wait add:

```js
    const shownSecs = () => js(`[...document.querySelectorAll('#pmEdit > .tsec')].filter(s => !s.hidden).map(s => s.dataset.sec).join()`);
    check(await js(`document.querySelector('#pmTabs [aria-selected="true"]')?.dataset.sec`) === 'layout', 'Manage presets opens on the Layout tab');
    check(await shownSecs() === 'layout', 'only the Layout section shows');
```

- [ ] **Step 2: After `await shot('06a-manage-presets-4-per-sheet');`** (before Cancel) add:

```js
    await click('#pmTabs [data-sec="paper"]');
    check(await shownSecs() === 'paper', 'the Paper & tray tab shows only that section');
    await click('#pmTabs [data-sec="watermark"]');
    check(await js(`document.querySelector('#pmTabs [data-sec="watermark"] .dot').hidden`) === true, 'no Watermark dot while it is off');
    await js(`(() => { const c = document.querySelector('#pmEdit .tsec[data-sec="watermark"] input[type=checkbox]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    check(await js(`document.querySelector('#pmTabs [data-sec="watermark"] .dot').hidden`) === false, 'the Watermark tab shows a dot when it is on');
```

  and after the Cancel click add:

```js
    await click('#pManage'); await waitFor(() => js(`!!document.querySelector('.modal.presets')`), 'presets box again');
    check(await js(`document.querySelector('#pmTabs [aria-selected="true"]')?.dataset.sec`) === 'watermark', 'the box remembers the last tab');
    await click('.modal.presets [data-a="cancel"]');
```

- [ ] **Step 3: Checks.** `node --check tests/ui/run.js`. Ask the user before running `env -u ELECTRON_RUN_AS_NODE pnpm run test:ui` (needs no sandbox). Expected: every line `ok`, look at screenshots 06 / 06a.

- [ ] **Step 4: Commit.**

```bash
git add tests/ui/run.js
git commit -m "Window test: Manage presets tabs, Watermark dot, remembered tab

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
