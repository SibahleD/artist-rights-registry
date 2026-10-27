const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseImport, normalizeIsrc, normalizePeriod, normalizeStreams } = require('../src/lib/streams');

const NOW = new Date('2026-10-27T12:00:00Z');

test('ISRCs are tidied and checked', () => {
  assert.equal(normalizeIsrc(' ke-abc-26-00001 '), 'KEABC2600001');
  assert.equal(normalizeIsrc('KEABC260000'), null);
  assert.equal(normalizeIsrc(12345), null);
});

test('periods become the first of the month, and future months are refused', () => {
  assert.equal(normalizePeriod('2026-09', NOW), '2026-09-01');
  assert.equal(normalizePeriod('2026-09-17', NOW), '2026-09-01');
  assert.equal(normalizePeriod('2026-10', NOW), '2026-10-01');
  assert.equal(normalizePeriod('2026-11', NOW), null);
  assert.equal(normalizePeriod('2026-02-30', NOW), null);
  assert.equal(normalizePeriod('2026-13', NOW), null);
  assert.equal(normalizePeriod('09/2026', NOW), null);
});

test('stream counts must be whole and not negative', () => {
  assert.equal(normalizeStreams(1200), 1200);
  assert.equal(normalizeStreams('1,200'), 1200);
  assert.equal(normalizeStreams('12,00'), null);
  assert.equal(normalizeStreams(-1), null);
  assert.equal(normalizeStreams(1.5), null);
  assert.equal(normalizeStreams('abc'), null);
  assert.equal(normalizeStreams(2e12), null);
});

test('rows are merged per track, platform and month; bad rows are skipped with a reason', () => {
  const out = parseImport({
    platform: 'spotify',
    fileName: 'sept.csv',
    rows: [
      { isrc: 'KEABC2600001', period: '2026-09', streams: 100 },
      { isrc: 'keabc2600001', period: '2026-09-15', streams: '50' },
      { isrc: 'KEABC2600001', platform: 'apple_music', period: '2026-09', streams: 7 },
      { isrc: 'nope', period: '2026-09', streams: 1 },
      { isrc: 'KEABC2600002', period: '2027-01', streams: 1 },
      { isrc: 'KEABC2600002', period: '2026-09', streams: -4 },
    ],
  }, NOW);
  assert.equal(out.read, 6);
  assert.equal(out.skippedCount, 3);
  assert.deepEqual(out.skipped.map((s) => s.row), [4, 5, 6]);
  assert.deepEqual(out.rows, [
    { isrc: 'KEABC2600001', platform: 'spotify', period: '2026-09-01', streams: 150 },
    { isrc: 'KEABC2600001', platform: 'apple_music', period: '2026-09-01', streams: 7 },
  ]);
  assert.equal(out.fileName, 'sept.csv');
});

test('a row with no platform and no default is skipped', () => {
  const out = parseImport({ rows: [{ isrc: 'KEABC2600001', period: '2026-09', streams: 1 }] }, NOW);
  assert.equal(out.rows.length, 0);
  assert.match(out.skipped[0].reason, /platform/i);
});

test('empty, oversized and malformed requests are refused', () => {
  assert.ok(parseImport({}).error);
  assert.ok(parseImport({ rows: [] }).error);
  assert.ok(parseImport({ rows: new Array(20001).fill({}) }).error);
  assert.ok(parseImport({ platform: 'Not Valid!', rows: [{}] }).error);
});
