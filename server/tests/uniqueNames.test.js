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

// Calls the real controller with a minimal request and response, so the 409 mapping is tested without starting a server.
const callUpdateMe = async (id, body) => {
  const { updateMe } = require('../src/controllers/userController');
  const out = {};
  const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
  await updateMe({ user: { id }, body }, res);
  return out;
};

test('renaming to a taken artist name answers 409, ignoring case and spaces', { skip }, async () => {
  await add('un-g@example.com', 'Rename Target Test');
  const mine = await add('un-h@example.com', 'Rename Source Test');
  const r = await callUpdateMe(mine, { artistName: '  rename TARGET test ' });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /already taken.*city or a number/i);
});

test('renaming to a free artist name works, and keeping your own name is fine', { skip }, async () => {
  const mine = await add('un-i@example.com', 'Rename Free Test');
  assert.equal((await callUpdateMe(mine, { artistName: 'Rename Free Test Two' })).body.user.artistName, 'Rename Free Test Two');
  assert.equal((await callUpdateMe(mine, { artistName: 'rename free test two' })).status, undefined);   // own name, other case: no conflict
});
