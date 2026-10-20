// Run first by `pnpm run dist` and the release workflow: stops the build when app/notes.js has no What's new
// entry for package.json's version, or an entry is broken — a release would otherwise ship an empty What's new
// and nobody would notice. `node scripts/check-notes.js [file]` checks another copy (tests).
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const file = path.resolve(process.argv[2] || path.join(ROOT, 'app', 'notes.js'));
const version = require(path.join(ROOT, 'package.json')).version;
const problems = [];
let N = null;
try { const window = {}; vm.runInNewContext(fs.readFileSync(file, 'utf8'), { window }, { filename: file }); N = window.SievphovNotes || null; }
catch (e) { problems.push(`could not run it: ${e.message}`); }
if (N) {
  const list = Array.isArray(N.NOTES) ? N.NOTES : [], kinds = Array.isArray(N.KINDS) ? N.KINDS : [];
  if (!list.length) problems.push('there are no entries');
  else if (list[0].version !== version) problems.push(`the newest entry is ${list[0].version}, but package.json says ${version}: write its notes at the top`);
  const seen = new Set();
  for (const e of list) {
    const v = e && e.version;
    if (typeof v !== 'string' || !v) { problems.push('an entry has no version'); continue; }
    if (seen.has(v)) problems.push(`${v} is listed twice`);
    seen.add(v);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) problems.push(`${v} has no date (YYYY-MM-DD)`);
    if (!Array.isArray(e.notes) || !e.notes.length) { problems.push(`${v} has no notes`); continue; }
    for (const n of e.notes) {
      if (!kinds.includes(n && n.kind)) problems.push(`${v}: unknown kind "${n && n.kind}" (use ${kinds.join(', ')})`);
      if (typeof (n && n.text) !== 'string' || !n.text.trim()) problems.push(`${v}: a note has no text`);
    }
  }
} else if (!problems.length) problems.push('it does not set window.SievphovNotes');
if (problems.length) {
  console.error(`What's new (${path.relative(ROOT, file)}) is not ready:\n` + problems.map(p => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(`What's new: ${N.NOTES.length} versions, newest ${N.NOTES[0].version} = package.json`);
