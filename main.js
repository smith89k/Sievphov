// Sievphov — Electron main process: the window and its title bar, the ☰ menu, file dialogs, the app's JSON files
// (presets, settings, jobs), and the print engine (engine.js → the C# helper Sievphov.Engine.exe).
const { app, BrowserWindow, Menu, dialog, ipcMain, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { createEngine } = require('./engine');
const samplePdf = require('./sample-pdf');

const APP_NAME = 'Sievphov';
// package.json's version (also when main.js is loaded by tests/ui/run.js, where app.getVersion() would be Electron's)
const VERSION = require('./package.json').version;
// Window title: "Sievphov v2.0.0", plus " (dev)" when run from source (pnpm start / run.bat).
const APP_TITLE = `${APP_NAME} v${VERSION}${app.isPackaged ? '' : ' (dev)'}`;
const JOB_EXT = 'svpv', PRESET_EXT = 'svpreset';
let win = null;
let pendingPaths = [];      // .svpv / .pdf passed before the window was ready
let allowClose = false;

// The print engine: in the installed app resources\engine\Sievphov.Engine.exe; from source engine-dist\ (pnpm run engine).
// The stand-in engine (engine.js) runs when asked (SIEVPHOV_FAKE_ENGINE=1) or off Windows, so the screens can be worked on anywhere.
const ENGINE_EXE = app.isPackaged
  ? path.join(process.resourcesPath, 'engine', 'Sievphov.Engine.exe')
  : path.join(__dirname, 'engine-dist', 'Sievphov.Engine.exe');
const FAKE = process.env.SIEVPHOV_FAKE_ENGINE === '1' || process.platform !== 'win32';
const logFile = path.join(os.tmpdir(), 'Sievphov', 'engine.log');
const log = line => { try { fsSync.mkdirSync(path.dirname(logFile), { recursive: true }); fsSync.appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`); } catch {} };
const engine = createEngine({ exe: ENGINE_EXE, fake: FAKE, log, missing: app.isPackaged
  ? 'The print engine is missing (Sievphov.Engine.exe). Reinstall Sievphov.'
  : 'The print engine is not built yet. Close Sievphov and run "pnpm run engine" (needs the .NET 8 SDK: winget install Microsoft.DotNet.SDK.8), then start it again.' });
engine.onEvent(ev => { if (win) win.webContents.send('engine-event', ev); });

// Only one Sievphov window; a second launch (double-clicked .svpv, "Open with") hands its files to the first.
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', (_e, argv) => {
    const files = fileArgs(argv);
    if (!win) { pendingPaths = files; createWindow(); return; }
    bringUp(win);
    if (files.length) win.webContents.send('open-paths', files);
  });
}

function fileArgs(argv) {
  return argv.slice(1).filter(a => !a.startsWith('--') && /\.(pdf|svpv)$/i.test(a)).map(a => path.resolve(a));
}

// Windows won't let a program in the background take the front (its taskbar button only flashes);
// a moment "always on top" still puts the window above the others (as in Sastra PDF).
function bringUp(w) {
  if (w.isMinimized()) w.restore();
  w.setAlwaysOnTop(true); w.show(); w.focus(); w.setAlwaysOnTop(false);
}

// The title row is the window's title bar (as in Bohpum). Windows still draws minimize / maximize / close over its right
// end in the page's colours (--chrome / --ink in app/app.css, KEEP IN SYNC); the menus open from its menu words.
const BAR_H = 36;   // the title row without its 1 px bottom line (as in Bohpum)
const BAR_COLORS = { light: { color: '#f7f5f1', symbolColor: '#23201b' }, dark: { color: '#1f1d1b', symbolColor: '#ece8e2' } };
const barColors = () => BAR_COLORS[nativeTheme.shouldUseDarkColors ? 'dark' : 'light'];
function paintBar() { if (win && process.platform === 'win32') win.setTitleBarOverlay(barColors()); }

function createWindow() {
  allowClose = false;
  win = new BrowserWindow({
    width: 1400, height: 880, minWidth: 900, minHeight: 540,
    title: APP_TITLE,
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1f1d1b' : '#f7f5f1',
    titleBarStyle: 'hidden', titleBarOverlay: { ...barColors(), height: BAR_H },
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      additionalArguments: ['--sievphov-title=' + APP_TITLE, ...(FAKE ? ['--sievphov-fake'] : [])]
    }
  });
  win.once('ready-to-show', () => { if (!process.env.SIEVPHOV_TEST) win.maximize(); bringUp(win); });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.on('enter-full-screen', () => win.webContents.send('full-screen', true));
  win.on('leave-full-screen', () => win.webContents.send('full-screen', false));
  // The page asks (unsaved job, printing still running) in its own box before closing.
  win.on('close', e => {
    if (allowClose) return;
    e.preventDefault();
    if (win.isMinimized()) win.restore();
    win.focus();
    win.webContents.send('close-request');
  });
  win.on('closed', () => { win = null; });
}

function send(cmd) { if (win) win.webContents.send('menu', cmd); }

function buildMenu() {
  // registerAccelerator:false = the shortcut is shown in the menu, but the page handles the key itself.
  const k = (label, accelerator, cmd) => ({ label, accelerator, registerAccelerator: false, click: () => send(cmd) });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '&File', submenu: [
      k('Add &Files…', 'Ctrl+O', 'addFiles'),
      k('Add F&older…', 'Ctrl+Shift+O', 'addFolder'),
      { type: 'separator' },
      k('Open &Job…', 'Ctrl+J', 'openJob'),
      k('&Save Job', 'Ctrl+S', 'saveJob'),
      k('Save Job &As…', 'Ctrl+Shift+S', 'saveJobAs'),
      { type: 'separator' },
      k('&Print…', 'Ctrl+P', 'print'),
      k('After Printin&g…', undefined, 'afterPrint'),
      { type: 'separator' },
      { label: 'E&xit', accelerator: 'Alt+F4', click: () => win && win.close() }
    ]},
    { label: '&Edit', submenu: [
      k('Select &All', 'Ctrl+A', 'selectAll'),
      k('&Remove from List', 'Delete', 'remove'),
      k('Insert &Blank Paper', 'Ctrl+B', 'insertBlank'),
      k('Remove &Printed', undefined, 'removePrinted'),
      k('&Clear List', undefined, 'clear'),
      { type: 'separator' },
      k('Move &Up', 'Alt+Up', 'up'),
      k('Move &Down', 'Alt+Down', 'down'),
      { type: 'separator' },
      k('&Copy Settings', 'Ctrl+Shift+C', 'copySettings'),
      k('Pa&ste Settings', 'Ctrl+Shift+V', 'pasteSettings'),
      k('Reset to Pr&eset', undefined, 'reset')
    ]},
    { label: '&Presets', submenu: [
      k('&Manage Presets…', undefined, 'managePresets'),
      k('&Save as Preset…', undefined, 'saveAsPreset'),
      { type: 'separator' },
      k('&Import Presets…', undefined, 'importPresets'),
      k('&Export Presets…', undefined, 'exportPresets')
    ]},
    { label: '&View', submenu: [
      k('&Preview', 'F5', 'preview'),
      k('&Estimate', undefined, 'estimate'),
      { type: 'separator' },
      { label: '&Theme', submenu: [
        { id: 'theme-system', label: '&System', type: 'radio', click: () => send('themeSystem') },
        { id: 'theme-light', label: '&Light', type: 'radio', click: () => send('themeLight') },
        { id: 'theme-dark', label: '&Dark', type: 'radio', click: () => send('themeDark') }
      ]},
      { label: '&Full Screen', accelerator: 'F11', click: () => win && win.setFullScreen(!win.isFullScreen()) },
      { type: 'separator' },
      { label: 'Developer Tools', accelerator: 'Ctrl+Shift+I', click: () => win && win.webContents.toggleDevTools() }
    ]},
    { label: '&Help', submenu: [
      { label: "What's &New", click: () => send('whatsNew') },
      { label: '&About Sievphov', click: () => send('about') }
    ]}
  ]));
}

/* ---------- folders remembered across restarts (as in Sastra PDF): <userData>\folders.json ---------- */
const folders = { open: null, save: null };
let foldersRead = null;
const userFile = name => path.join(app.getPath('userData'), name);
const readFolders = () => foldersRead ??= fs.readFile(userFile('folders.json'), 'utf8').then(t => {
  const o = JSON.parse(t); for (const key of ['open', 'save']) if (typeof o[key] === 'string' && path.isAbsolute(o[key])) folders[key] = o[key];
}, () => {}).catch(() => {});
async function remember(kind, dir) {
  await readFolders();
  if (!dir || folders[kind] === dir) return;
  folders[kind] = dir;
  await fs.writeFile(userFile('folders.json'), JSON.stringify(folders)).catch(() => {});
}
const isDir = p => fs.stat(p).then(s => s.isDirectory(), () => false);
async function startIn(kind) { await readFolders(); const d = folders[kind]; return d && await isDir(d) ? d : app.getPath('documents'); }

/* ---------- JSON files: presets, settings (in userData), jobs and preset files (anywhere) ---------- */
async function readJson(p) {
  try { return { data: JSON.parse((await fs.readFile(p, 'utf8')).replace(/^﻿/, '')) }; }
  catch (e) { return { error: e.code === 'ENOENT' ? 'missing' : e instanceof SyntaxError ? 'damaged' : e.message }; }
}
// a temp file first, so a crash never leaves half a file
async function writeJson(p, value) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(tmp, p);
}
const STORE_FILES = { presets: 'presets.json', settings: 'settings.json' };
ipcMain.handle('store-read', async (_e, name) => {
  if (!STORE_FILES[name]) return { error: 'bad name' };
  const p = userFile(STORE_FILES[name]), r = await readJson(p);
  // an unreadable presets file is kept aside, never overwritten
  if (r.error === 'damaged') await fs.copyFile(p, userFile(`${name}.unreadable-${Date.now()}.json`)).catch(() => {});
  return r;
});
ipcMain.handle('store-write', async (_e, name, value) => {
  if (!STORE_FILES[name]) return false;
  await writeJson(userFile(STORE_FILES[name]), value);
  return true;
});

/* ---------- adding files ---------- */
const PDF_FILTER = [{ name: 'PDF documents', extensions: ['pdf'] }];
ipcMain.handle('add-files-dialog', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Add PDF files', defaultPath: await startIn('open'), properties: ['openFile', 'multiSelections'], filters: PDF_FILTER });
  if (r.canceled || !r.filePaths.length) return [];
  remember('open', path.dirname(r.filePaths[0]));
  return r.filePaths;
});
ipcMain.handle('add-folder-dialog', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Add a folder of PDF files', buttonLabel: 'Add folder', defaultPath: await startIn('open'), properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths.length) return null;
  remember('open', r.filePaths[0]);
  return r.filePaths[0];
});
// Folders (Add folder, drag & drop) → their PDFs in name order like Explorer; files stay as they are.
const byName = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
async function pdfsIn(dir, sub, out, depth = 0) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  entries.sort((a, b) => byName(a.name, b.name));
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isFile() && /\.pdf$/i.test(e.name)) out.push(p);
    else if (e.isDirectory() && sub && depth < 32) await pdfsIn(p, sub, out, depth + 1);
  }
}
ipcMain.handle('expand-paths', async (_e, paths, sub) => {
  const out = [], jobs = [];
  for (const raw of Array.isArray(paths) ? paths : []) {
    const p = path.resolve(String(raw));
    if (await isDir(p)) await pdfsIn(p, !!sub, out);
    else if (/\.pdf$/i.test(p)) out.push(p);
    else if (new RegExp(`\\.${JOB_EXT}$`, 'i').test(p)) jobs.push(p);
  }
  return { pdfs: out, jobs };
});
ipcMain.handle('file-exists', async (_e, p) => fs.access(String(p)).then(() => true, () => false));
// the sample paper in Manage presets: 8 numbered pages, written once per run to the temp folder
let samplePath = null;
ipcMain.handle('sample-pdf', async () => {
  const s = samplePdf.sample();
  if (!samplePath) { samplePath = path.join(app.getPath('temp'), `sievphov-sample-${process.pid}.pdf`); await fs.writeFile(samplePath, s.data); }
  return { path: samplePath, pageCount: s.pageCount, pageSizes: s.pageSizes };
});
app.on('will-quit', () => { if (samplePath) try { fsSync.unlinkSync(samplePath); } catch {} });

/* ---------- jobs (.svpv) and preset files (.svpreset) ---------- */
ipcMain.handle('open-job-dialog', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Open job', defaultPath: await startIn('save'), properties: ['openFile'], filters: [{ name: 'Sievphov job', extensions: [JOB_EXT] }] });
  if (r.canceled || !r.filePaths.length) return null;
  return r.filePaths[0];
});
ipcMain.handle('read-job', async (_e, p) => {
  const r = await readJson(String(p));
  if (r.data) remember('save', path.dirname(String(p)));
  return { ...r, path: String(p) };
});
// path given = Save; none = Save As (dialog). Paths in the job are also kept relative to it, so a folder moved with
// its PDFs still opens.
ipcMain.handle('save-job', async (_e, { filePath, job, name }) => {
  let target = filePath;
  if (!target) {
    const r = await dialog.showSaveDialog(win, { title: 'Save job', defaultPath: path.join(await startIn('save'), (name || 'Print job') + '.' + JOB_EXT), filters: [{ name: 'Sievphov job', extensions: [JOB_EXT] }] });
    if (r.canceled || !r.filePath) return null;
    target = r.filePath;
  }
  remember('save', path.dirname(target));
  const dir = path.dirname(target);
  job.Items = (job.Items || []).map(it => it.Blank ? it : { ...it, RelativePath: path.relative(dir, it.FilePath) });
  await writeJson(target, job);
  return target;
});
ipcMain.handle('resolve-job-paths', async (_e, jobPath, items) => {
  const dir = path.dirname(String(jobPath));
  const out = [];
  for (const it of Array.isArray(items) ? items : []) {
    if (it.Blank === true) { out.push(null); continue; }   // blank paper has no file
    let p = String(it.FilePath || '');
    if (!(await fs.access(p).then(() => true, () => false)) && it.RelativePath) {
      const rel = path.resolve(dir, String(it.RelativePath));
      if (await fs.access(rel).then(() => true, () => false)) p = rel;
    }
    out.push(p);
  }
  return out;
});
ipcMain.handle('export-presets', async (_e, data) => {
  const r = await dialog.showSaveDialog(win, { title: 'Export presets', defaultPath: path.join(await startIn('save'), 'Sievphov presets.' + PRESET_EXT), filters: [{ name: 'Sievphov presets', extensions: [PRESET_EXT] }] });
  if (r.canceled || !r.filePath) return null;
  await writeJson(r.filePath, data);
  return r.filePath;
});
ipcMain.handle('import-presets', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Import presets', defaultPath: await startIn('save'), properties: ['openFile'], filters: [{ name: 'Sievphov presets', extensions: [PRESET_EXT] }] });
  if (r.canceled || !r.filePaths.length) return null;
  return readJson(r.filePaths[0]);
});
ipcMain.handle('save-report', async (_e, csv) => {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '');
  const r = await dialog.showSaveDialog(win, { title: 'Save report', defaultPath: path.join(await startIn('save'), `Sievphov report ${stamp}.csv`), filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }] });
  if (r.canceled || !r.filePath) return null;
  await fs.writeFile(r.filePath, '﻿' + String(csv), 'utf8');   // BOM: Excel then reads Khmer names right
  return r.filePath;
});
ipcMain.handle('pick-folder', async (_e, title) => {
  const r = await dialog.showOpenDialog(win, { title: String(title || 'Choose a folder'), defaultPath: await startIn('save'), properties: ['openDirectory', 'createDirectory'] });
  return r.canceled || !r.filePaths.length ? null : r.filePaths[0];
});
ipcMain.handle('pick-picture', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Choose a picture', defaultPath: await startIn('open'), properties: ['openFile'], filters: [{ name: 'Pictures', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif'] }] });
  return r.canceled || !r.filePaths.length ? null : r.filePaths[0];
});

/* ---------- the print engine ---------- */
const ENGINE_CMDS = new Set(['printers', 'caps', 'open', 'estimate', 'preview', 'print', 'pause', 'resume', 'stop']);
ipcMain.handle('engine', async (_e, cmd, args) => {
  if (!ENGINE_CMDS.has(cmd)) return { ok: false, error: 'bad command', reason: 'other' };
  try { return { ok: true, result: await engine.request(cmd, args || {}) }; }
  catch (e) { return { ok: false, error: e.message, reason: e.reason || 'other' }; }
});
// "Printer Properties": Windows' own Printing preferences for that printer (as in Sastra PDF and Bohpum).
ipcMain.handle('printer-prefs', async (_e, name) => {
  if (process.platform !== 'win32' || typeof name !== 'string' || !name) return false;
  const list = await engine.request('printers').catch(() => []);
  if (!list.some(p => p.name === name)) return false;
  execFile('rundll32.exe', ['printui.dll,PrintUIEntry', '/e', '/n', name], () => {});
  return true;
});

/* ---------- window, theme, menu ---------- */
ipcMain.on('close-now', () => { allowClose = true; if (win) win.close(); });
ipcMain.on('set-title', (_e, t) => { if (win) win.setTitle(String(t)); });
ipcMain.on('set-theme', (_e, t) => {
  if (!['system', 'light', 'dark'].includes(t)) return;
  nativeTheme.themeSource = t;
  const item = Menu.getApplicationMenu()?.getMenuItemById('theme-' + t);
  if (item) item.checked = true;
  paintBar();
});
// a menu word in the title row (as in Bohpum): that menu drops down under it; resolves when it closes
ipcMain.handle('show-menu', (e, index, x, y) => new Promise(resolve => {
  const item = Menu.getApplicationMenu()?.items[index | 0];
  if (!win || e.sender !== win.webContents || !item || !item.submenu) return resolve(false);
  item.submenu.popup({ window: win, x: Math.max(0, Math.round(+x) || 0), y: Math.max(0, Math.round(+y) || 0), callback: () => resolve(true) });
}));
ipcMain.on('show-folder', (_e, p) => { if (p) shell.showItemInFolder(String(p)); });
ipcMain.handle('app-version', () => VERSION);
ipcMain.handle('initial-paths', () => { const p = pendingPaths; pendingPaths = []; return p; });

app.whenReady().then(() => {
  app.setAppUserModelId('kh.sievphov.app');
  buildMenu();
  nativeTheme.on('updated', paintBar);
  pendingPaths = fileArgs(process.argv);
  createWindow();
});
app.on('window-all-closed', () => { engine.stop(); app.quit(); });
