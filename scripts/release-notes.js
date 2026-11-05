// Release notes from a version's What's new entry (app/notes.js), so the notes are written once (as Sastra PDF and Bohpum):
//   node scripts/release-notes.js [version]            Markdown for the GitHub release (## New / ## Improved / ## Fixed …)
//   node scripts/release-notes.js [version] --store    plain text for Partner Center › What's new in this version
//                                                       (NEW / • …; at most 1500 characters, the Store's limit)
//   … --store --write                                   also saves it as dist/Sievphov-Store-<version>-whats-new.txt
// The version defaults to package.json's. Exit 1 when that version has no entry, or its Store text is too long.
// `pnpm run dist:store` runs the --store --write form, so every Store package comes with its What's new text.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const WORDS = { new: 'New', improved: 'Improved', fixed: 'Fixed', removed: 'Removed' };
const STORE_LIMIT = 1500;

function loadNotes(file = path.join(ROOT, 'app', 'notes.js')) {
  const window = {};
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { window }, { filename: file });
  return window.SievphovNotes;
}
// the kinds in What's new's order, only those the entry has → [[kind, [text…]], …]
const groups = (entry, kinds) => kinds.map(k => [k, entry.notes.filter(n => n.kind === k).map(n => n.text)]).filter(([, l]) => l.length);

// "## New\n- …\n\n## Fixed\n- …\n"
function notesMarkdown(entry, kinds = Object.keys(WORDS)) {
  return groups(entry, kinds).map(([k, list]) => `## ${WORDS[k]}\n${list.map(t => `- ${t}\n`).join('')}`).join('\n');
}
// "NEW\n• …\nFIXED\n• …" — Partner Center shows plain text only
function notesStore(entry, kinds = Object.keys(WORDS)) {
  return groups(entry, kinds).map(([k, list]) => `${WORDS[k].toUpperCase()}\n${list.map(t => `• ${t}`).join('\n')}`).join('\n');
}

if (require.main === module) {
  const args = process.argv.slice(2), store = args.includes('--store'), write = args.includes('--write');
  const version = args.find(a => !a.startsWith('--')) || require('../package.json').version;
  const N = loadNotes(), entry = N.noteFor(version);
  if (!entry) { console.error(`release-notes: app/notes.js has no What's new entry for ${version}`); process.exit(1); }
  if (!store) { process.stdout.write(notesMarkdown(entry, N.KINDS)); process.exit(0); }
  const text = notesStore(entry, N.KINDS);
  if (text.length > STORE_LIMIT) { console.error(`release-notes: ${version}'s What's new is ${text.length} characters; the Store takes ${STORE_LIMIT}. Shorten it in app/notes.js.`); process.exit(1); }
  if (write) {
    const file = path.join(ROOT, 'dist', `Sievphov-Store-${version}-whats-new.txt`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text + '\n', 'utf8');
    console.log(`\nWhat's new in ${version} for Partner Center (${text.length} of ${STORE_LIMIT} characters), saved as ${path.relative(ROOT, file)}:\n\n${text}\n`);
  } else process.stdout.write(text + '\n');
}

module.exports = { loadNotes, notesMarkdown, notesStore, STORE_LIMIT };
