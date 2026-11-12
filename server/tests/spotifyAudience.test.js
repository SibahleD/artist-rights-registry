process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAudience, normalizeDay } = require('../src/lib/spotifyAudience');

const NOW = new Date('2026-11-11T10:00:00Z');
const row = (date, o = {}) => ({ date, listeners: 0, monthly_listeners: 0, monthly_active_listeners: 0, super_listeners: 0, streams: 0, playlist_adds: 0, saves: 0, followers: 0, ...o });

test('drops leading all-zero days but keeps zeros after activity', () => {
  const p = parseAudience({ fileName: 'a.csv', rows: [row('2024-01-01'), row('2024-01-02'), row('2024-01-03', { streams: 5 }), row('2024-01-04')] }, NOW);
  assert.equal(p.trimmed, 2);
  assert.deepEqual(p.rows.map((r) => r.day), ['2024-01-03', '2024-01-04']);
  assert.equal(p.fileName, 'a.csv');
});

test('skips bad rows with a reason and keeps the rest', () => {
  const p = parseAudience({ rows: [row('2024-01-03', { streams: 1 }), row('not a date'), row('2024-01-05', { saves: -1 }), row('2024-01-06', { followers: '1.5' }), row('2027-01-01')] }, NOW);
  assert.equal(p.rows.length, 1);
  assert.equal(p.skippedCount, 4);
});

test('a repeated date keeps the last row; rows come back sorted', () => {
  const p = parseAudience({ rows: [row('2024-02-02', { streams: 2 }), row('2024-02-01', { streams: 1 }), row('2024-02-02', { streams: 9 })] }, NOW);
  assert.deepEqual(p.rows.map((r) => [r.day, r.streams]), [['2024-02-01', 1], ['2024-02-02', 9]]);
});

test('accepts numeric strings, as read from a CSV', () => {
  const p = parseAudience({ rows: [row('2024-02-02', { streams: '315', followers: '17' })] }, NOW);
  assert.equal(p.rows[0].streams, 315);
});

test('rejects empty and oversized input', () => {
  assert.ok(parseAudience({ rows: [] }, NOW).error);
  assert.ok(parseAudience({ rows: new Array(4001).fill(row('2024-01-01')) }, NOW).error);
  assert.ok(parseAudience(null, NOW).error);
});

test('date check', () => {
  assert.equal(normalizeDay('2024-02-29', NOW), '2024-02-29');
  assert.equal(normalizeDay('2025-02-29', NOW), null);
  assert.equal(normalizeDay('2024-13-01', NOW), null);
});
