const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { passwordResetMessage, passwordChangedMessage } = require('../src/services/passwordReset');

test('reset email carries the link and states the 1 hour expiry', () => {
  const m = passwordResetMessage({ artistName: 'Ayo', link: 'http://x/reset-password?token=abc' });
  assert.match(m.text, /reset-password\?token=abc/);
  assert.match(m.text, /1 hour/);
  assert.match(m.subject, /Reset your/);
});

test('password-changed notice mentions sign-out', () => {
  assert.match(passwordChangedMessage({ artistName: 'Ayo' }).text, /signed out/);
});

// Database tests: set TEST_DATABASE_URL (a migrated database) to run them.
const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : 'set TEST_DATABASE_URL to run';
let pool, auth, bcrypt, tokens, user;

async function call(handler, body) {
  const out = { status: 200, body: undefined };
  const res = {
    status(c) { out.status = c; return this; },
    json(b) { out.body = b; return this; },
    end() { return this; },
  };
  await handler({ body }, res);
  return out;
}

// Plants a reset token directly, since the raw token only ever travels by email.
async function plant(userId, { expires = "now() + interval '1 hour'", kind = 'password_reset' } = {}) {
  const { raw, hash } = tokens.newToken();
  await pool.query(`INSERT INTO email_tokens (user_id, token_hash, kind, expires_at) VALUES ($1, $2, $3, ${expires})`, [userId, hash, kind]);
  return raw;
}

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = url;
  process.env.JWT_SECRET ||= 'test-secret';
  process.env.EMAIL_HASH_KEY ||= 'test-key';
  pool = require('../src/db/pool');
  auth = require('../src/controllers/authController');
  tokens = require('../src/services/tokens');
  bcrypt = require('bcrypt');
  const hash = await bcrypt.hash('oldpassword', 4);
  user = (await pool.query(`INSERT INTO users (email, password_hash, artist_name) VALUES ('reset-a@example.com',$1,'Reset') RETURNING id`, [hash])).rows[0];
});

after(async () => {
  if (skip) return;
  await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
  await pool.end();
});

test('forgot-password answers the same for known and unknown emails', { skip }, async () => {
  const known = await call(auth.forgotPassword, { email: 'reset-a@example.com' });
  const unknown = await call(auth.forgotPassword, { email: 'nobody-here@example.com' });
  assert.deepEqual(known, unknown);
  assert.equal((await call(auth.forgotPassword, { email: 'not-an-email' })).status, 400);
  const n = await pool.query(`SELECT count(*)::int AS n FROM email_tokens WHERE user_id = $1 AND kind = 'password_reset'`, [user.id]);
  assert.equal(n.rows[0].n, 1);
});

test('a valid link sets the password once and signs out older sessions', { skip }, async () => {
  const raw = await plant(user.id);
  assert.equal((await call(auth.resetPassword, { token: raw, newPassword: 'short' })).status, 400);

  const ok = await call(auth.resetPassword, { token: raw, newPassword: 'brandnewpass1' });
  assert.equal(ok.status, 200);
  const { rows } = await pool.query('SELECT password_hash, password_changed_at FROM users WHERE id = $1', [user.id]);
  assert.ok(await bcrypt.compare('brandnewpass1', rows[0].password_hash));
  assert.ok(rows[0].password_changed_at);

  const again = await call(auth.resetPassword, { token: raw, newPassword: 'anotherpass2' });
  assert.equal(again.status, 400);
});

test('expired and wrong-kind tokens are refused', { skip }, async () => {
  const expired = await plant(user.id, { expires: "now() - interval '1 minute'" });
  assert.equal((await call(auth.resetPassword, { token: expired, newPassword: 'brandnewpass3' })).status, 400);

  const verifyTok = await plant(user.id, { kind: 'verify' });
  assert.equal((await call(auth.resetPassword, { token: verifyTok, newPassword: 'brandnewpass3' })).status, 400);

  // and a reset token cannot be used to verify an email
  const reset = await plant(user.id);
  assert.equal((await call(auth.verifyEmail, { token: reset })).status, 400);
});
