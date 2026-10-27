const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

// Needs a migrated database: set TEST_DATABASE_URL to run.
const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : 'set TEST_DATABASE_URL to run';
let pool, user;

const insert = (isrc, platform, period, streams) => pool.query(
  `INSERT INTO stream_stats (user_id, isrc, platform, period, streams) VALUES ($1,$2,$3,$4,$5)
   ON CONFLICT (user_id, isrc, platform, period) DO UPDATE SET streams = EXCLUDED.streams, updated_at = now()
   RETURNING streams`, [user.id, isrc, platform, period, streams]);

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = url;
  pool = require('../src/db/pool');
  user = (await pool.query(`INSERT INTO users (email, password_hash, artist_name) VALUES ('streams-a@example.com','x','Streams') RETURNING id`)).rows[0];
});

after(async () => {
  if (skip) return;
  await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
  await pool.end();
});

test('re-importing a month replaces the earlier figure', { skip }, async () => {
  await insert('KEABC2600001', 'spotify', '2026-09-01', 100);
  const again = await insert('KEABC2600001', 'spotify', '2026-09-01', 150);
  assert.equal(again.rows[0].streams, '150');
  const n = await pool.query('SELECT count(*)::int AS n FROM stream_stats WHERE user_id = $1', [user.id]);
  assert.equal(n.rows[0].n, 1);
});

test('the same track on another platform or month is a separate row', { skip }, async () => {
  await insert('KEABC2600001', 'apple_music', '2026-09-01', 40);
  await insert('KEABC2600001', 'spotify', '2026-10-01', 60);
  const n = await pool.query('SELECT count(*)::int AS n FROM stream_stats WHERE user_id = $1', [user.id]);
  assert.equal(n.rows[0].n, 3);
});

test('bad values are refused by the database', { skip }, async () => {
  await assert.rejects(insert('KEABC2600001', 'spotify', '2026-09-15', 1), /check/i);   // not the first of the month
  await assert.rejects(insert('not-an-isrc', 'spotify', '2026-09-01', 1), /check/i);
  await assert.rejects(insert('KEABC2600001', 'Spotify!', '2026-09-01', 1), /check/i);
  await assert.rejects(insert('KEABC2600001', 'spotify', '2026-09-01', -5), /check/i);
});
