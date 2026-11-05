// Builds the Store copy's update helpers into store-update/out/ (gitignored; only the Store package's config takes them,
// build/store.config.js), as Sastra PDF does (E:\_httdocs\SastraPDF\scripts\build-explorer-menu.js):
//   SievphovStoreUpdate.exe  asks the Microsoft Store (store-update/update.cpp)
//   SievphovRestart.node     asks Windows to open Sievphov again after the update closes it (store-update/restart.cpp)
// Needs Visual Studio Build Tools ("Desktop development with C++", x64) and the Windows 10/11 SDK. Run by
// `pnpm run dist:store`; alone: `pnpm run store-helper`.
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..'), SRC = path.join(ROOT, 'store-update'), OUT = path.join(SRC, 'out'), OBJ = path.join(OUT, 'obj');
const PF86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
const fail = msg => { console.error('build-store-update: ' + msg); process.exit(1); };

function vcvars() {
  const vswhere = path.join(PF86, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  if (!fs.existsSync(vswhere)) fail('Visual Studio Build Tools not found. Install "Desktop development with C++".');
  const r = spawnSync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { encoding: 'utf8' });
  const dir = (r.stdout || '').trim().split(/\r?\n/)[0];
  const bat = dir && path.join(dir, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat');
  if (!bat || !fs.existsSync(bat)) fail('the C++ x64 build tools are not installed (Visual Studio Installer → Desktop development with C++).');
  return bat;
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OBJ, { recursive: true });
// /MT: no Visual C++ runtime needed on the user's PC. A .bat because vcvars sets the environment. C++20: this C++/WinRT
// needs the standard <coroutine>.
const bat = path.join(OBJ, 'build.bat');
fs.writeFileSync(bat, [
  '@echo off',
  `call "${vcvars()}" >nul 2>&1 || exit /b 1`,
  `cd /d "${OBJ}"`,
  `cl /nologo /std:c++20 /EHsc /O2 /MT /W3 /utf-8 "${path.join(SRC, 'update.cpp')}" /Fe"${path.join(OUT, 'SievphovStoreUpdate.exe')}" /link windowsapp.lib ole32.lib user32.lib || exit /b 1`,
  `cl /nologo /std:c++17 /EHsc /O2 /MT /LD /W3 /utf-8 "${path.join(SRC, 'restart.cpp')}" /Fe"${path.join(OUT, 'SievphovRestart.node')}" /link /IMPLIB:SievphovRestart.lib || exit /b 1`
].join('\r\n'));
const r = spawnSync('cmd.exe', ['/d', '/s', '/c', `""${bat}""`], { windowsVerbatimArguments: true, stdio: 'inherit' });
if (r.status !== 0) fail('the C++ build failed (see the messages above).');
fs.rmSync(OBJ, { recursive: true, force: true });
for (const f of fs.readdirSync(OUT)) if (!/^Sievphov(StoreUpdate\.exe|Restart\.node)$/.test(f)) fs.rmSync(path.join(OUT, f), { force: true });
console.log('build-store-update: store-update/out/SievphovStoreUpdate.exe and SievphovRestart.node ready');
