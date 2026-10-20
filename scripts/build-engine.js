// Builds the print engine (engine/src/Sievphov.Engine) into engine-dist/Sievphov.Engine.exe: one self-contained file for
// 64-bit Windows, which electron-builder packs into resources\engine. Run by `pnpm run dist`; alone: `pnpm run engine`.
// Needs the .NET 8 SDK (winget install Microsoft.DotNet.SDK.8).
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const project = path.join(root, 'engine', 'src', 'Sievphov.Engine', 'Sievphov.Engine.csproj');
const out = path.join(root, 'engine-dist');
const run = args => execFileSync('dotnet', args, { stdio: 'inherit', cwd: root });

try { execFileSync('dotnet', ['--version'], { stdio: 'ignore' }); }
catch { console.error('engine: the .NET 8 SDK is missing. Install it with "winget install Microsoft.DotNet.SDK.8" and run this again.'); process.exit(1); }

if (!process.argv.includes('--no-test')) run(['test', path.join(root, 'engine', 'tests', 'Sievphov.Tests'), '-c', 'Release']);
fs.rmSync(out, { recursive: true, force: true });
run(['publish', project, '-p:PublishProfile=win-x64', '-o', out]);
const exe = path.join(out, 'Sievphov.Engine.exe');
if (!fs.existsSync(exe)) { console.error('engine: ' + exe + ' was not made'); process.exit(1); }
console.log(`engine: ${path.relative(root, exe)} (${(fs.statSync(exe).size / 1048576).toFixed(1)} MB)`);
