// Release notes come from What's new (app/notes.js): Markdown for GitHub, plain text for the Microsoft Store.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadNotes, notesMarkdown, notesStore, STORE_LIMIT } = require('../scripts/release-notes.js');

const N = loadNotes();
const entry = { notes: [{ kind: 'fixed', text: 'C' }, { kind: 'new', text: 'A' }, { kind: 'new', text: 'B' }] };

test('Markdown: the kinds in What\'s new order, only those the entry has', () => {
  assert.equal(notesMarkdown(entry, N.KINDS), '## New\n- A\n- B\n\n## Fixed\n- C\n');
});

test('Store text, as the Store page shows it: New in this version: / Improved: / Fixed:, "- " lines, a blank line between', () => {
  assert.equal(notesStore(entry, N.KINDS), 'New in this version:\n- A\n- B\n\nFixed:\n- C');
  assert.equal(notesStore({ notes: [{ kind: 'improved', text: 'D' }] }, N.KINDS), 'Improved:\n- D');
});

test('every Store version\'s What\'s new fits the Store\'s 1500 characters (the Store began with 2.2.0)', () => {
  const store = N.NOTES.slice(0, N.NOTES.findIndex(e => e.version === '2.2.0') + 1);
  assert.ok(store.length >= 6);   // 2.2.0 … 2.3.4, and every one after
  for (const e of store) assert.ok(notesStore(e, N.KINDS).length <= STORE_LIMIT, `${e.version} is too long for the Store`);
});

test('the version being built has notes', () => {
  assert.ok(N.noteFor(require('../package.json').version));
});
