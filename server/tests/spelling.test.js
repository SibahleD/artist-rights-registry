const test = require('node:test');
const assert = require('node:assert/strict');
const { spellingConflicts } = require('../src/services/readiness');

const names = (...pairs) => pairs.map(([label, name]) => ({ label, name }));

test('identical spellings are fine', () => {
  assert.deepEqual(spellingConflicts(names(['release', 'Kenny TL'], ['track 1', 'Kenny TL'])), []);
});

test('case, spacing and punctuation differences are flagged', () => {
  const r = spellingConflicts(names(['release', 'Kenny TL'], ['track 1', 'kenny tl'], ['track 2', 'Kenny  T.L']));
  assert.equal(r.length, 3);
});

test('accents are ignored when comparing', () => {
  const r = spellingConflicts(names(['release', 'Beyoncé'], ['track 1', 'Beyonce']));
  assert.equal(r.length, 2);
});

test('one character apart is flagged on longer names', () => {
  const r = spellingConflicts(names(['release', 'Mugisha'], ['track 3', 'Mugishaa']));
  assert.deepEqual(r.map((c) => c.labels).flat().sort(), ['release', 'track 3']);
});

test('short or clearly different names are not flagged', () => {
  assert.deepEqual(spellingConflicts(names(['release', 'Ada'], ['track 1', 'Ade'])), []);
  assert.deepEqual(spellingConflicts(names(['release', 'Kenny TL'], ['track 1', 'Jean Mugisha'])), []);
});

test('blank and missing names are skipped', () => {
  assert.deepEqual(spellingConflicts(names(['release', 'Kenny TL'], ['track 1', null], ['track 2', '  '])), []);
});
