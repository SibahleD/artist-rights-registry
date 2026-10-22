const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : 'set TEST_DATABASE_URL to run';
let pool, nc, pn, readiness, owner, other, releaseId, trackId, collabId, mails;

const call = (handler, { user = owner, params = {}, body = {} } = {}) => new Promise((resolve, reject) => {
  const out = { status: 200, body: undefined };
  const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; resolve(out); return this; }, end() { resolve(out); return this; } };
  Promise.resolve(handler({ params: { id: releaseId, ...params }, body, query: {}, user: { id: user.id, email: user.email, artistName: 'Resolver' } }, res))
    .then(() => resolve(out), reject);
});
const lastToken = () => /notice\/([A-Za-z0-9_-]+)/.exec(mails[mails.length - 1].text)[1];
const respond = (token, choice, message) => call(pn.respond, { params: { token }, body: { choice, message } });
const noticeRow = async () => (await pool.query('SELECT * FROM collaborator_notices WHERE track_id = $1', [trackId])).rows[0];

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = url;
  process.env.EMAIL_HASH_KEY ||= 'test-key';
  mails = [];
  const mailerPath = require.resolve('../src/services/mailer');
  require.cache[mailerPath] = { id: mailerPath, filename: mailerPath, loaded: true, exports: { sendMail: async (m) => { mails.push(m); } } };
  pool = require('../src/db/pool');
  nc = require('../src/controllers/noticesController');
  pn = require('../src/controllers/publicNoticeController');
  readiness = require('../src/services/readiness');

  owner = (await pool.query(`INSERT INTO users (email, password_hash, artist_name) VALUES ('resolver@example.com','x','Resolver') RETURNING id, email`)).rows[0];
  other = (await pool.query(`INSERT INTO users (email, password_hash, artist_name) VALUES ('resolver-other@example.com','x','Other') RETURNING id, email`)).rows[0];
  releaseId = (await pool.query(`INSERT INTO releases (owner_id, title, album_artist) VALUES ($1,'R','Resolver') RETURNING id`, [owner.id])).rows[0].id;
  trackId = (await pool.query(`INSERT INTO tracks (release_id, track_number, title) VALUES ($1,1,'T') RETURNING id`, [releaseId])).rows[0].id;
  collabId = (await pool.query(
    `INSERT INTO collaborators (track_id, invited_email, legal_name, role, ownership_percent) VALUES ($1,'cw-resolve@example.com','Co Writer','songwriter',40) RETURNING id`,
    [trackId])).rows[0].id;
  await pool.query(`INSERT INTO collaborators (track_id, user_id, invited_email, legal_name, role, ownership_percent) VALUES ($1,$2,$3,'Me','songwriter',60)`, [trackId, owner.id, owner.email]);
});

after(async () => {
  if (skip) return;
  await pool.query('DELETE FROM releases WHERE id = $1', [releaseId]);
  await pool.query('DELETE FROM users WHERE id = ANY($1)', [[owner.id, other.id]]);
  await pool.end();
});

test('a dispute with unchanged numbers cannot be re-sent until it is resolved', { skip }, async () => {
  const sent = await call(nc.sendNotices);
  assert.equal(sent.body.results.find((r) => r.email === 'cw-resolve@example.com').action, 'sent');
  assert.equal((await respond(lastToken(), 'dispute', 'My share should be 50%')).status, 200);

  const again = await call(nc.sendNotices);
  assert.equal(again.body.results.find((r) => r.email === 'cw-resolve@example.com').action, 'unchanged');
  const checks = await readiness.readinessChecks({ ...(await pool.query('SELECT * FROM releases WHERE id = $1', [releaseId])).rows[0], release_date: '2026-12-01' });
  assert.ok(checks.some((c) => c.id === 'cowriter-disputed' && c.level === 'error'));
});

test('input and ownership are checked', { skip }, async () => {
  const n = await noticeRow();
  assert.equal((await call(nc.resolveNotice, { params: { noticeId: n.id }, body: { decision: 'maybe' } })).status, 400);
  assert.equal((await call(nc.resolveNotice, { params: { noticeId: n.id }, body: {} })).status, 400);
  // someone else's release is a 404, whoever the notice belongs to
  assert.equal((await call(nc.resolveNotice, { user: other, params: { noticeId: n.id }, body: { decision: 'keep' } })).status, 404);
  assert.equal((await noticeRow()).status, 'disputed');
});

test("'use_theirs' needs the credit to have been changed first", { skip }, async () => {
  const n = await noticeRow();
  const r = await call(nc.resolveNotice, { params: { noticeId: n.id }, body: { decision: 'use_theirs' } });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /track editor/);
  assert.equal((await noticeRow()).status, 'disputed');
});

test('keep my numbers: closes the dispute, wipes personal data, and the notice can be sent again', { skip }, async () => {
  const n = await noticeRow();
  const r = await call(nc.resolveNotice, { params: { noticeId: n.id }, body: { decision: 'keep', note: '  Agreed 40% in the studio  ' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.notice.resolution, 'kept');

  const row = await noticeRow();
  assert.deepEqual([row.status, row.email, row.co_writer_name, row.resolution_note], ['cancelled', null, null, 'Agreed 40% in the studio']);

  // resolving twice is refused
  assert.equal((await call(nc.resolveNotice, { params: { noticeId: n.id }, body: { decision: 'keep' } })).status, 409);

  // the disputed error is gone, replaced by an unconfirmed error that says what to do
  const rel = { ...(await pool.query('SELECT * FROM releases WHERE id = $1', [releaseId])).rows[0], release_date: '2026-12-01' };
  const checks = await readiness.readinessChecks(rel);
  assert.ok(!checks.some((c) => c.id === 'cowriter-disputed'));
  assert.match(checks.find((c) => c.id === 'cowriter-unconfirmed').message, /resolved the dispute/);

  // re-send: same details, new link, clean slate
  const resent = await call(nc.sendNotices);
  assert.equal(resent.body.results.find((x) => x.email === 'cw-resolve@example.com').action, 'resent');
  const fresh = await noticeRow();
  assert.deepEqual([fresh.status, fresh.resolution, fresh.resolved_at, fresh.note], ['pending', null, null, null]);

  // confirm, and the release no longer has anything awaiting approval
  assert.equal((await respond(lastToken(), 'confirm')).status, 200);
  const after = await readiness.readinessChecks(rel);
  assert.ok(!after.some((c) => c.id === 'cowriter-unconfirmed' || c.id === 'cowriter-disputed'));
});

test('use theirs: after changing the split the dispute can be closed and an updated notice goes out', { skip }, async () => {
  assert.equal((await respond(lastToken(), 'dispute', 'Please make it 50%')).status, 200);
  await pool.query('UPDATE collaborators SET ownership_percent = 50 WHERE id = $1', [collabId]);
  await pool.query(`UPDATE collaborators SET ownership_percent = 50 WHERE track_id = $1 AND user_id = $2`, [trackId, owner.id]);

  const n = await noticeRow();
  // once the numbers differ, 'keep' makes no sense
  assert.equal((await call(nc.resolveNotice, { params: { noticeId: n.id }, body: { decision: 'keep' } })).status, 409);
  const r = await call(nc.resolveNotice, { params: { noticeId: n.id }, body: { decision: 'use_theirs' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.notice.resolution, 'adopted');

  const sent = await call(nc.sendNotices);
  assert.equal(sent.body.results.find((x) => x.email === 'cw-resolve@example.com').action, 'updated');
  assert.equal(Number((await noticeRow()).share_percent), 50);
});
