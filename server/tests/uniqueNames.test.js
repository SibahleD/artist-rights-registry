const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : 'set TEST_DATABASE_URL to run';
let pool;
const ids = [];

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = url;
  pool = require('../src/db/pool');
});

after(async () => {
  if (skip) return;
  await pool.query('DELETE FROM users WHERE id = ANY($1)', [ids]);
  await pool.end();
});

const add = async (email, artist, username = null) => {
  const r = await pool.query(
    `INSERT INTO users (email, password_hash, artist_name, username) VALUES ($1, 'x', $2, $3) RETURNING id`,
    [email, artist, username]
  );
  ids.push(r.rows[0].id);
  return r.rows[0].id;
};

test('artist names are unique ignoring case and spaces', { skip }, async () => {
  await add('un-a@example.com', 'Unique Name Test');
  await assert.rejects(() => add('un-b@example.com', '  unique name test '), (e) => e.code === '23505' && e.constraint === 'uq_users_artist_name');
});

test('a deleted account frees its artist name', { skip }, async () => {
  const id = await add('un-c@example.com', 'Freed Name Test');
  await pool.query('UPDATE users SET deleted_at = now() WHERE id = $1', [id]);
  await add('un-d@example.com', 'freed name test');
});

test('emails and usernames stay unique', { skip }, async () => {
  await add('un-e@example.com', 'Email Test One', 'un_user_1');
  await assert.rejects(() => add('un-e@example.com', 'Email Test Two'), (e) => e.code === '23505');
  await assert.rejects(() => add('un-f@example.com', 'Email Test Three', 'un_user_1'), (e) => e.code === '23505' && e.constraint === 'uq_users_username');
});
