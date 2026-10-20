// Makes sure node_modules/electron/dist/electron.exe really exists after "pnpm install".
// Since Electron 42 the package no longer downloads its binary on install (only on first run), and
// Electron 33's installer stalled on Node 24 anyway. Here we fetch the same checksummed download
// and unzip it with Windows' built-in tar.exe, so the binary is ready right after install.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
// pnpm's node_modules/electron is a link to the real folder. Work in the real one: Windows tar won't
// unpack through a link, and @electron/get sits next to it there, not in our node_modules.
const pkgDir = fs.realpathSync(path.join(root, 'node_modules', 'electron'));
const dist = path.join(pkgDir, 'dist');
const exeName = process.platform === 'win32' ? 'electron.exe' : process.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : 'electron';

function installed(version) {
  try {
    return fs.readFileSync(path.join(dist, 'version'), 'utf8').trim().replace(/^v/, '') === version
      && fs.readFileSync(path.join(pkgDir, 'path.txt'), 'utf8') === exeName
      && fs.existsSync(path.join(dist, exeName));
  } catch { return false; }
}

(async () => {
  if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD) return;
  const { version } = require(path.join(pkgDir, 'package.json'));
  if (installed(version)) { console.log('electron: ' + version + ' OK'); return; }
  if (process.platform !== 'win32') { console.error('electron: binary missing; run "node node_modules/electron/install.js"'); process.exit(1); }

  console.log('electron: binary missing after install, unpacking it with Windows tar…');
  const { downloadArtifact } = require(require.resolve('@electron/get', { paths: [pkgDir] }));
  const zip = await downloadArtifact({
    version, artifactName: 'electron', platform: 'win32', arch: process.arch,
    checksums: require(path.join(pkgDir, 'checksums.json'))
  });
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
  // System32 tar is bsdtar and reads .zip; Git Bash's GNU tar does not, so call it by full path.
  const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  execFileSync(tar, ['-xf', zip, '-C', dist], { stdio: 'inherit' });
  const dts = path.join(dist, 'electron.d.ts');
  if (fs.existsSync(dts)) fs.renameSync(dts, path.join(pkgDir, 'electron.d.ts'));
  fs.writeFileSync(path.join(pkgDir, 'path.txt'), exeName);
  if (!installed(version)) { console.error('electron: unpacking failed — delete node_modules and run "pnpm install" again.'); process.exit(1); }
  console.log('electron: ' + version + ' unpacked');
})().catch(e => { console.error('electron: ' + (e && e.stack || e)); process.exit(1); });
