const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCollaborators } = require('../src/lib/splits');

const body = (...c) => ({ collaborators: c });
const person = (legalName, ownershipPercent, extra = {}) => ({ legalName, ownershipPercent, ...extra });

test('accepts a valid 60/40 split and defaults the role', () => {
  const r = parseCollaborators(body(person('Ada Obi', 60), person('Jean Mugisha', 40)));
  assert.equal(r.error, undefined);
  assert.equal(r.data.length, 2);
  assert.equal(r.data[0].role, 'songwriter');
});

test('rejects splits that total 99.99', () => {
  const r = parseCollaborators(body(person('Ada Obi', 60), person('Jean Mugisha', 39.99)));
  assert.match(r.error, /exactly 100%/);
});

test('33.33 + 33.33 + 33.34 totals exactly 100 (cent maths, no float drift)', () => {
  const r = parseCollaborators(body(person('A A', 33.33), person('B B', 33.33), person('C C', 33.34)));
  assert.equal(r.error, undefined);
});

test('allows a 0% credit-only entry', () => {
  const r = parseCollaborators(body(person('Ada Obi', 100), person('Jean Mugisha', 0, { role: 'producer' })));
  assert.equal(r.error, undefined);
});

test('rejects more than two decimals', () => {
  const r = parseCollaborators(body(person('Ada Obi', 33.333), person('Jean Mugisha', 66.667)));
  assert.match(r.error, /2 decimals/);
});

test('rejects the same name twice, ignoring case', () => {
  const r = parseCollaborators(body(person('Ada Obi', 50), person('ada obi', 50)));
  assert.match(r.error, /only appear once/);
});

test('rejects an unknown role', () => {
  const r = parseCollaborators(body(person('Ada Obi', 100, { role: 'dj' })));
  assert.match(r.error, /role must be one of/);
});

test('rejects an invalid email and an empty list', () => {
  assert.match(parseCollaborators(body(person('Ada Obi', 100, { invitedEmail: 'nope' }))).error, /invalid email/);
  assert.match(parseCollaborators({ collaborators: [] }).error, /1 to 50/);
});
test('removed lines are ignored and their locked share counts toward 100', () => {
  const removed = [{ id: 'r1', cents: 3000 }];
  const ok = parseCollaborators(body(person('Ada Obi', 70), { id: 'r1', removedByWriter: true }), removed);
  assert.equal(ok.error, undefined);
  assert.deepEqual(ok.keepIds, ['r1']);
  const bad = parseCollaborators(body(person('Ada Obi', 100), { id: 'r1', removedByWriter: true }), removed);
  assert.match(bad.error, /should total 70%/);
});

test('discard frees the share of a removed line', () => {
  const removed = [{ id: 'r1', cents: 3000 }];
  const r = parseCollaborators(body(person('Ada Obi', 100), { id: 'r1', removedByWriter: true, discard: true }), removed);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.discardIds, ['r1']);
});

test('omitting a removed line does not free its share', () => {
  const r = parseCollaborators(body(person('Ada Obi', 100)), [{ id: 'r1', cents: 3000 }]);
  assert.match(r.error, /should total 70%/);
});