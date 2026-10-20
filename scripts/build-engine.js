// Builds the print engine (engine/src/Sievphov.Engine) into engine-dist/Sievphov.Engine.exe: one self-contained file for
// 64-bit Windows, which electron-builder packs into resources\engine. Needs the .NET 8 SDK
// (winget install Microsoft.DotNet.SDK.8).
//   pnpm run engine                 always builds (runs the C# tests first); `pnpm run dist` uses this
//   --if-needed                     only when the exe is missing or older than the engine's code (pnpm install /
//                                   pnpm start use this); without the .NET SDK it explains and stops
//   --no-test                       skip the C# tests
//   --warn                          a missing SDK or a failed build only warns (pnpm install must not fail for it)
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const engineDir = path.join(root, 'engine');
const project = path.join(engineDir, 'src', 'Sievphov.Engine', 'Sievphov.Engine.csproj');
const out = path.join(root, 'engine-dist');
const exe = path.join(out, 'Sievphov.Engine.exe');
const ifNeeded = process.argv.includes('--if-needed');
const stop = () => process.exit(process.argv.includes('--warn') ? 0 : 1);
const run = args => execFileSync('dotnet', args, { stdio: 'inherit', cwd: root });

// the newest change to the engine's own files (code, projects, publish profile); bin/obj are build output
function newestSource(dir) {
  let newest = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'bin' || e.name === 'obj') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) newest = Math.max(newest, newestSource(p));
    else if (/\.(cs|csproj|props|pubxml|sln|ico)$/i.test(e.name)) newest = Math.max(newest, fs.statSync(p).mtimeMs);
  }
  return newest;
}

if (ifNeeded) {
  if (fs.existsSync(exe) && fs.statSync(exe).mtimeMs >= Math.max(newestSource(engineDir), fs.statSync(path.join(root, 'build', 'icon.ico')).mtimeMs)) {
    console.log('engine: engine-dist/Sievphov.Engine.exe is up to date');
    process.exit(0);
  }
  console.log(fs.existsSync(exe) ? 'engine: the engine\'s code changed, building it again…' : 'engine: building the print engine (first time, about a minute)…');
}

try { execFileSync('dotnet', ['--version'], { stdio: 'ignore' }); }
catch {
  console.error('\nengine: Sievphov needs its print engine, and building it needs the .NET 8 SDK, which is not installed.\n' +
    '        Install it with:  winget install Microsoft.DotNet.SDK.8\n' +
    '        then open a new terminal and run:  pnpm run engine\n');
  stop();
}

try {
  if (!process.argv.includes('--no-test')) run(['test', path.join(engineDir, 'tests', 'Sievphov.Tests'), '-c', 'Release']);
  fs.rmSync(out, { recursive: true, force: true });
  run(['publish', project, '-p:PublishProfile=win-x64', '-o', out]);
} catch {
  console.error('\nengine: building the print engine failed (see the messages above). Run "pnpm run engine" to try again.\n');
  stop();
}
if (!fs.existsSync(exe)) { console.error('engine: ' + exe + ' was not made'); stop(); }
console.log(`engine: ${path.relative(root, exe)} (${(fs.statSync(exe).size / 1048576).toFixed(1)} MB)`);
