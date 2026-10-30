const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : 'set TEST_DATABASE_URL to run';
let pool, ac, bcrypt, user, other;

async function call(handler, user, body) {
  const out = { status: 200, body: undefined };
  const res = {
    status(c) { out.status = c; return this; },
    json(b) { out.body = b; return this; },
    end() { return this; },
    setHeader() {},
  };
  await handler({ body, user: { id: user.id, email: user.email, artistName: 'Acct' } }, res);
  return out;
}

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = url;
  process.env.MAIL_TRANSPORT = 'console';   // never send real mail from tests, whatever .env says
  process.env.JWT_SECRET ||= 'test-secret';
  process.env.EMAIL_HASH_KEY ||= 'test-key';
  pool = require('../src/db/pool');
  ac = require('../src/controllers/accountController');
  bcrypt = require('bcrypt');
  const hash = await bcrypt.hash('oldpassword', 4);
  user = (await pool.query(`INSERT INTO users (email, password_hash, artist_name) VALUES ('acct-a@example.com',$1,'Acct') RETURNING id, email`, [hash])).rows[0];
  other = (await pool.query(`INSERT INTO users (email, password_hash, artist_name) VALUES ('acct-b@example.com',$1,'Other') RETURNING id, email`, [hash])).rows[0];
});

after(async () => {
  if (skip) return;
  await pool.query('DELETE FROM users WHERE id = ANY($1)', [[user.id, other.id]]);
  await pool.end();
});

test('password change needs the current password and stamps the change', { skip }, async () => {
  assert.equal((await call(ac.changePassword, user, { currentPassword: 'wrong', newPassword: 'newpassword1' })).status, 403);
  const ok = await call(ac.changePassword, user, { currentPassword: 'oldpassword', newPassword: 'newpassword1' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  const row = (await pool.query('SELECT password_hash, password_changed_at FROM users WHERE id = $1', [user.id])).rows[0];
  assert.ok(row.password_changed_at);
  assert.ok(await bcrypt.compare('newpassword1', row.password_hash));
});

test('email change stores a pending request and refuses taken addresses', { skip }, async () => {
  assert.equal((await call(ac.requestEmailChange, user, { email: 'acct-b@example.com', password: 'newpassword1' })).status, 409);
  const ok = await call(ac.requestEmailChange, user, { email: 'Fresh-Address@Example.com', password: 'newpassword1' });
  assert.equal(ok.body.pending_email, 'fresh-address@example.com');
  const cur = (await pool.query('SELECT email FROM users WHERE id = $1', [user.id])).rows[0].email;
  assert.equal(cur, 'acct-a@example.com');   // unchanged until the link is used
});

test('delete refuses while a release is ready, then anonymises', { skip }, async () => {
  const rel = (await pool.query(
    `INSERT INTO releases (owner_id, title, album_artist) VALUES ($1,'Draft','Acct') RETURNING id`, [user.id])).rows[0];
  await pool.query(`UPDATE releases SET status = 'ready', ready_at = now() WHERE id = $1`, [rel.id]).catch(() => {});
  const state = (await pool.query('SELECT status FROM releases WHERE id = $1', [rel.id])).rows[0].status;
  if (state === 'ready') {
    assert.equal((await call(ac.deleteAccount, user, { password: 'newpassword1' })).status, 409);
    await pool.query(`UPDATE releases SET status = 'draft', ready_at = NULL WHERE id = $1`, [rel.id]);
  }
  assert.equal((await call(ac.deleteAccount, user, { password: 'wrong' })).status, 403);
  assert.equal((await call(ac.deleteAccount, user, { password: 'newpassword1' })).status, 204);
  const row = (await pool.query('SELECT email, artist_name, deleted_at FROM users WHERE id = $1', [user.id])).rows[0];
  assert.ok(row.deleted_at);
  assert.equal(row.artist_name, 'Deleted artist');
  assert.match(row.email, /@deleted\.invalid$/);
  assert.equal((await pool.query('SELECT 1 FROM releases WHERE owner_id = $1', [user.id])).rowCount, 0);
});
