const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : 'set TEST_DATABASE_URL to run';
let pool, rc, pn, tokens, notices, owner, releaseId, trackId;

async function call(handler, { params = {}, body, query = {} } = {}) {
  const out = { status: 200, body: undefined };
  const res = {
    status(c) { out.status = c; return this; },
    json(b) { out.body = b; return this; },
    end() { return this; },
  };
  await handler({ params: { id: releaseId, ...params }, body, query, user: { id: owner.id, artistName: 'Life Cycle' } }, res);
  return out;
}

const link = (store, u) => ({ store, url: u });

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = url;
  process.env.EMAIL_HASH_KEY ||= 'test-key';
  pool = require('../src/db/pool');
  rc = require('../src/controllers/releaseController');
  pn = require('../src/controllers/publicNoticeController');
  tokens = require('../src/services/tokens');
  notices = require('../src/services/notices');
  owner = (await pool.query(
    `INSERT INTO users (email, password_hash, artist_name) VALUES ('lifecycle@example.com','x','Life Cycle') RETURNING id`)).rows[0];
  releaseId = (await pool.query(
    `INSERT INTO releases (owner_id, title, album_artist) VALUES ($1,'Live','Life Cycle') RETURNING id`, [owner.id])).rows[0].id;
  trackId = (await pool.query(`INSERT INTO tracks (release_id, track_number, title) VALUES ($1,1,'Live') RETURNING id`, [releaseId])).rows[0].id;
});

after(async () => {
  if (skip) return;
  await pool.query('DELETE FROM releases WHERE id = $1', [releaseId]);
  await pool.query('DELETE FROM users WHERE id = $1', [owner.id]);
  await pool.end();
});

const makeReady = () => pool.query(`UPDATE releases SET release_date = '2026-12-01', status = 'ready', ready_at = now() WHERE id = $1`, [releaseId]);

test('a draft cannot be marked as released', { skip }, async () => {
  const r = await call(rc.markReleased, { body: { links: [link('Spotify', 'https://open.spotify.com/album/x')] } });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /marked ready/);
});

test('links are validated: at least one, real web addresses, no duplicates, capped', { skip }, async () => {
  await makeReady();
  const bad = async (links, re) => {
    const r = await call(rc.markReleased, { body: { links } });
    assert.equal(r.status, 400, JSON.stringify(links));
    assert.match(r.body.error, re);
  };
  await bad([], /at least one/i);
  await bad(undefined, /at least one/i);
  await bad([link('', 'https://a.example/x')], /store name/);
  await bad([link('Spotify', 'javascript:alert(1)')], /https/);
  await bad([link('Spotify', 'ftp://a.example/x')], /https/);
  await bad([link('Spotify', 'not a url')], /https/);
  await bad([link('Spotify', 'https://a.example/x'), link('Apple', 'https://A.example/X')], /twice/);
  await bad(Array.from({ length: 11 }, (_, i) => link('S', `https://a.example/${i}`)), /at most 10/);
  const { rows } = await pool.query('SELECT released_at FROM releases WHERE id = $1', [releaseId]);
  assert.equal(rows[0].released_at, null); // nothing was half-saved
});

test('marking released stores the links in order and sets released_at', { skip }, async () => {
  const r = await call(rc.markReleased, { body: { links: [link('Spotify', ' https://open.spotify.com/album/x '), link('Apple Music', 'https://music.apple.com/album/y')] } });
  assert.equal(r.status, 200);
  assert.ok(r.body.released_at);
  const got = await call(rc.getRelease);
  assert.deepEqual(got.body.links, [link('Spotify', 'https://open.spotify.com/album/x'), link('Apple Music', 'https://music.apple.com/album/y')]);
  assert.ok(got.body.release.released_at);
  assert.ok(got.body.links.every((l) => Object.keys(l).join() === 'store,url'));
});

test('re-submitting replaces the links but keeps the original released_at', { skip }, async () => {
  const before = (await call(rc.getRelease)).body.release.released_at;
  const r = await call(rc.markReleased, { body: { links: [link('YouTube Music', 'https://music.youtube.com/playlist?list=z')] } });
  assert.equal(r.status, 200);
  const got = (await call(rc.getRelease)).body;
  assert.deepEqual(got.links, [link('YouTube Music', 'https://music.youtube.com/playlist?list=z')]);
  assert.equal(new Date(got.release.released_at).getTime(), new Date(before).getTime());
});

test('a released release is locked: it cannot be reverted to draft', { skip }, async () => {
  const r = await call(rc.revertToDraft);
  assert.equal(r.status, 409);
  assert.match(r.body.error, /released/);
});

test('the database refuses released_at on a draft', { skip }, async () => {
  await assert.rejects(
    pool.query(`UPDATE releases SET status = 'draft', ready_at = NULL WHERE id = $1`, [releaseId]),
    (e) => e.code === '23514');
});

test('un-marking clears released_at, keeps the links, and is refused when not released', { skip }, async () => {
  assert.equal((await call(rc.unmarkReleased)).status, 204);
  const got = (await call(rc.getRelease)).body;
  assert.equal(got.release.released_at, null);
  assert.equal(got.links.length, 1);
  assert.equal((await call(rc.unmarkReleased)).status, 409);
  assert.equal((await call(rc.revertToDraft)).status, 200);   // revert is allowed again
  await makeReady();
});

test('pending_notices counts pending and disputed, not confirmed or expired', { skip }, async () => {
  const mk = (n, status, expires = "now() + interval '1 day'") => pool.query(
    `INSERT INTO collaborator_notices (track_id, email_hash, email, co_writer_name, role, share_percent, token_hash, notice_version, status, sent_by, expires_at)
     VALUES ($1,$2,$3,'X','songwriter',10,$4,'v',$5,$6,${expires})`,
    [trackId, notices.emailHash(`n${n}@example.com`), `n${n}@example.com`, `tok-life-${n}`, status, owner.id]);
  await mk(1, 'pending'); await mk(2, 'disputed'); await mk(3, 'confirmed');
  await mk(4, 'pending', "now() - interval '1 day'");
  const list = await call(rc.listReleases);
  const row = list.body.releases.find((r) => r.id === releaseId);
  assert.equal(row.pending_notices, 2);
  assert.equal(row.released_at, null);
  assert.equal(row.status, 'ready');
});

test('a co-writer removing themselves sends a released release back to draft and clears released_at', { skip }, async () => {
  await call(rc.markReleased, { body: { links: [link('Spotify', 'https://open.spotify.com/album/x')] } });
  const raw = 'life-cycle-removal-token-0123456789';
  await pool.query(`UPDATE collaborator_notices SET token_hash = $1, status = 'pending', email = 'n1@example.com' WHERE token_hash = 'tok-life-1'`, [tokens.hashToken(raw)]);
  await pool.query(`INSERT INTO collaborators (track_id, invited_email, legal_name, ownership_percent) VALUES ($1,'n1@example.com','N One',10),($1,$2,'Me',90)`, [trackId, 'lifecycle@example.com']);
  const out = { status: 200 };
  await pn.respond({ params: { token: raw }, body: { choice: 'remove' } }, { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } });
  assert.equal(out.status, 200, JSON.stringify(out.body));
  const { rows } = await pool.query('SELECT status, ready_at, released_at FROM releases WHERE id = $1', [releaseId]);
  assert.deepEqual([rows[0].status, rows[0].ready_at, rows[0].released_at], ['draft', null, null]);
});
