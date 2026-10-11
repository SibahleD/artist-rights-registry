const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : 'set TEST_DATABASE_URL to run';
let pool, readinessProblems, releaseId, trackId, userId;

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = url;
  pool = require('../src/db/pool');
  ({ readinessProblems } = require('../src/controllers/releaseController'));
  userId = (await pool.query(
    `INSERT INTO users (email, password_hash, artist_name) VALUES ('readiness@example.com','x','Test Artist') RETURNING id`
  )).rows[0].id;
  releaseId = (await pool.query(
    `INSERT INTO releases (owner_id, title, album_artist) VALUES ($1,'Test','Test Artist') RETURNING id`, [userId]
  )).rows[0].id;
});

after(async () => {
  if (skip) return;
  await pool.query('DELETE FROM releases WHERE id = $1', [releaseId]); // cascades tracks, audio, splits
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await pool.end();
});

test('no date and no tracks', { skip }, async () => {
  const p = await readinessProblems({ id: releaseId, release_date: null });
  assert.ok(p.includes('Release date is required.'));
  assert.ok(p.includes('At least one track is required.'));
});

test('track without audio or splits', { skip }, async () => {
  trackId = (await pool.query(
    `INSERT INTO tracks (release_id, track_number, title) VALUES ($1,1,'Song') RETURNING id`, [releaseId]
  )).rows[0].id;
  const p = await readinessProblems({ id: releaseId, release_date: '2026-12-01' });
  assert.ok(p.some((m) => m.includes('no audio file')));
  assert.ok(p.some((m) => m.includes('must total 100%')));
});

test('complete release has no problems', { skip }, async () => {
  await pool.query(`INSERT INTO audio_specs (track_id, file_name, format) VALUES ($1,'a.mp3','mp3')`, [trackId]);
  await pool.query(
    `INSERT INTO collaborators (track_id, legal_name, ownership_percent) VALUES ($1,'Ada Obi',100)`, [trackId]
  );
  const p = await readinessProblems({ id: releaseId, release_date: '2026-12-01' });
  assert.deepEqual(p, []);
});