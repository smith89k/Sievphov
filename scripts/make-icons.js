// Makes the Microsoft Store package's app icon without a plate (pnpm run icons; run it again after changing
// build/icon.png). As in Bohpum: the taskbar, Start, "Open with" and Settings › Apps ask for the icon at these sizes.
// Without them Windows shrinks the 44 px logo and sets it on a plate (a box behind the icon), which looks small and
// blurred. lightunplated: the same, for a light taskbar. electron-builder sees the targetsize names and makes the
// package's resources.pri, so Windows finds them. Runs in Electron (canvas, good downscaling).
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = 'build/icon.png';
const SIZES = [16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 256];
const OUT = SIZES.flatMap(s => ['unplated', 'lightunplated'].map(f => [`build/appx/Square44x44Logo.targetsize-${s}_altform-${f}.png`, s]));

app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await w.loadURL('data:text/html,<body></body>');
  const src = fs.readFileSync(path.join(ROOT, SRC)).toString('base64');
  const out = await w.webContents.executeJavaScript(`(async () => {
    const img = new Image(); img.src = 'data:image/png;base64,${src}'; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0);
    // halve step by step, then the last step: sharper than one big jump
    const scaled = h => {
      let cur = c;
      while (cur.height / 2 >= h) { const n = document.createElement('canvas'); n.width = Math.round(cur.width / 2); n.height = Math.round(cur.height / 2);
        const g = n.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, n.width, n.height); cur = n; }
      const o = document.createElement('canvas'); o.width = o.height = h;
      const g = o.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, h, h);
      return o.toDataURL('image/png').split(',')[1];
    };
    const res = {}; for (const s of ${JSON.stringify(SIZES)}) res[s] = scaled(s); return res;
  })()`);
  for (const [file, s] of OUT) fs.writeFileSync(path.join(ROOT, file), Buffer.from(out[s], 'base64'));
  console.log(`make-icons: ${SRC} → ${OUT.length} unplated Store icons in build/appx`);
  app.exit(0);
});
