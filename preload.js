// Sievphov — safe bridge between the page and the main process (window.sievphov)
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const arg = name => (process.argv.find(a => a.startsWith(name + '=')) || '').slice(name.length + 1);

contextBridge.exposeInMainWorld('sievphov', {
  isDesktop: true,
  // window title tag from main.js: "Sievphov v2.0.0", or "Sievphov v2.0.0 (dev)" when run from source
  appTitle: arg('--sievphov-title') || 'Sievphov',
  fakeEngine: process.argv.includes('--sievphov-fake'),
  appVersion: () => ipcRenderer.invoke('app-version'),
  // the Store copy's updates (store-update.js): 'state' | 'check' | 'download' | 'install' | 'open-store'; null when not the Store copy
  storeUpdate: action => ipcRenderer.invoke('store-update', action),
  onStoreUpdate: fn => ipcRenderer.on('store-update', (_e, s) => fn(s)),
  initialPaths: () => ipcRenderer.invoke('initial-paths'),
  // the app's own files in its settings folder: 'presets' | 'settings'
  storeRead: name => ipcRenderer.invoke('store-read', name),
  storeWrite: (name, value) => ipcRenderer.invoke('store-write', name, value),
  addFilesDialog: () => ipcRenderer.invoke('add-files-dialog'),
  addFolderDialog: () => ipcRenderer.invoke('add-folder-dialog'),
  replaceFileDialog: oldPath => ipcRenderer.invoke('replace-file-dialog', oldPath),   // → a PDF path or null
  expandPaths: (paths, sub) => ipcRenderer.invoke('expand-paths', paths, sub),
  fileExists: p => ipcRenderer.invoke('file-exists', p),
  samplePdf: wide => ipcRenderer.invoke('sample-pdf', !!wide),   // → { path, pageCount, pageSizes }
  openJobDialog: () => ipcRenderer.invoke('open-job-dialog'),
  readJob: p => ipcRenderer.invoke('read-job', p),
  saveJob: (filePath, job, name) => ipcRenderer.invoke('save-job', { filePath, job, name }),
  resolveJobPaths: (jobPath, items) => ipcRenderer.invoke('resolve-job-paths', jobPath, items),
  exportPresets: data => ipcRenderer.invoke('export-presets', data),
  importPresets: () => ipcRenderer.invoke('import-presets'),
  saveReport: csv => ipcRenderer.invoke('save-report', csv),
  pickFolder: title => ipcRenderer.invoke('pick-folder', title),
  pickPicture: () => ipcRenderer.invoke('pick-picture'),
  engine: (cmd, args) => ipcRenderer.invoke('engine', cmd, args),
  printerPrefs: name => ipcRenderer.invoke('printer-prefs', name),
  closeNow: () => ipcRenderer.send('close-now'),
  setTitle: t => ipcRenderer.send('set-title', t),
  setTheme: t => ipcRenderer.send('set-theme', t),
  showMenu: (index, x, y) => ipcRenderer.invoke('show-menu', index, x, y),
  showInFolder: p => ipcRenderer.send('show-folder', p),
  pathForFile: f => { try { return webUtils.getPathForFile(f) || null; } catch { return null; } },
  onMenu: fn => ipcRenderer.on('menu', (_e, cmd) => fn(cmd)),
  onEngineEvent: fn => ipcRenderer.on('engine-event', (_e, ev) => fn(ev)),
  onOpenPaths: fn => ipcRenderer.on('open-paths', (_e, paths) => fn(paths)),
  onCloseRequest: fn => ipcRenderer.on('close-request', () => fn()),
  onFullScreen: fn => ipcRenderer.on('full-screen', (_e, on) => fn(!!on))
});
