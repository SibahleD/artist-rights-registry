const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

// Needs a migrated database: set TEST_DATABASE_URL (use artist_rights_test, never the dev database).
const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : 'set TEST_DATABASE_URL to run';
let pool, sc, ac, withDefaults, wantsOptionalEmail, a, b;

async function call(handler, user, { body, query, params } = {}) {
  const out = { status: 200, body: undefined, headers: {} };
  const res = {
    status(c) { out.status = c; return this; },
    json(x) { out.body = x; return this; },
    send(x) { out.body = x; return this; },
    end() { return this; },
    setHeader(k, v) { out.headers[k.toLowerCase()] = v; },
  };
  await handler({ body, query: query || {}, params: params || {}, user: { id: user.id } }, res);
  return out;
}

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = url;
  process.env.JWT_SECRET ||= 'test-secret';
  pool = require('../src/db/pool');
  sc = require('../src/controllers/streamController');
  ac = require('../src/controllers/accountController');
  ({ withDefaults, wantsOptionalEmail } = require('../src/lib/account'));
  const mk = async (email) => (await pool.query(`INSERT INTO users (email, password_hash, artist_name) VALUES ($1,'x','Export') RETURNING id`, [email])).rows[0];
  a = await mk('streams-export-a@example.com');
  b = await mk('streams-export-b@example.com');
  const rel = (await pool.query(`INSERT INTO releases (owner_id, title, album_artist) VALUES ($1,'Head, in the "Clouds"','Me') RETURNING id`, [a.id])).rows[0];
  await pool.query(`INSERT INTO tracks (release_id, track_number, title, isrc) VALUES ($1,1,'Cloud One','KEABC2600001')`, [rel.id]);
  await sc.importStreams({ user: { id: a.id }, body: { source: 'csv', platform: 'spotify', rows: [
    { isrc: 'KEABC2600001', period: '2026-08', streams: 100 },
    { isrc: 'KEABC2600001', period: '2026-09', streams: 250 },
    { isrc: 'KEABC2600077', period: '2026-09', streams: 7 },        // not in the catalogue
  ] } }, { status() { return this; }, json() { return this; } });
  await sc.importStreams({ user: { id: b.id }, body: { source: 'csv', platform: 'spotify', rows: [
    { isrc: 'KEABC2600001', period: '2026-09', streams: 999 },
  ] } }, { status() { return this; }, json() { return this; } });
});

after(async () => {
  if (skip) return;
  await pool.query('DELETE FROM releases WHERE owner_id = $1', [a.id]);
  await pool.query('DELETE FROM users WHERE id = ANY($1)', [[a.id, b.id]]);
  await pool.end();
});

test('export JSON: only my rows, titles joined, unmatched ISRC kept with null titles', { skip }, async () => {
  const r = await call(sc.exportStreams, a, { query: { format: 'json' } });
  assert.equal(r.status, 200);
  assert.match(r.headers['content-disposition'], /^attachment; filename="play-counts-\d{4}-\d{2}-\d{2}\.json"$/);
  assert.deepEqual(r.body.rows.map((x) => x.streams), [100, 250, 7]);          // b's 999 never appears
  assert.deepEqual(r.body.rows[0], { period: '2026-08-01', platform: 'spotify', isrc: 'KEABC2600001', track_title: 'Cloud One', release_title: 'Head, in the "Clouds"', streams: 100 });
  assert.equal(r.body.rows[2].track_title, null);
  assert.equal(r.body.rows[2].release_title, null);
});

test('export CSV: header, escaped titles, download headers', { skip }, async () => {
  const r = await call(sc.exportStreams, a, { query: { format: 'csv' } });
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /^text\/csv/);
  assert.match(r.headers['content-disposition'], /\.csv"$/);
  const lines = r.body.split('\r\n');
  assert.equal(lines[0], '\uFEFFperiod,platform,isrc,track_title,release_title,streams');
  assert.equal(lines[1], '2026-08-01,spotify,KEABC2600001,Cloud One,"Head, in the ""Clouds""",100');
  assert.equal(lines[3], '2026-09-01,spotify,KEABC2600077,,,7');
});

test('export: date range narrows rows; bad format or date is refused', { skip }, async () => {
  const r = await call(sc.exportStreams, a, { query: { format: 'json', from: '2026-09', to: '2026-09' } });
  assert.deepEqual(r.body.rows.map((x) => x.streams), [250, 7]);
  assert.equal((await call(sc.exportStreams, a, { query: { format: 'xml' } })).status, 400);
  assert.equal((await call(sc.exportStreams, a, { query: { from: 'soon' } })).status, 400);
});

test('export: an artist with no figures gets an empty list, not an error', { skip }, async () => {
  const c = (await pool.query(`INSERT INTO users (email, password_hash, artist_name) VALUES ('streams-export-c@example.com','x','Empty') RETURNING id`)).rows[0];
  try {
    const r = await call(sc.exportStreams, c, { query: { format: 'json' } });
    assert.deepEqual(r.body.rows, []);
  } finally { await pool.query('DELETE FROM users WHERE id = $1', [c.id]); }
});

test('a new account has notification emails off; switching the toggle on enables them', { skip }, async () => {
  const stored = async () => (await pool.query('SELECT preferences FROM users WHERE id = $1', [a.id])).rows[0].preferences;
  assert.equal(withDefaults(await stored()).notify_emails, false);
  assert.equal(wantsOptionalEmail(await stored(), 'disputes'), false);
  const r = await call(ac.updatePreferences, a, { body: { notify_emails: true } });
  assert.equal(r.status, 200);
  assert.equal(r.body.preferences.notify_emails, true);
  assert.equal(wantsOptionalEmail(await stored(), 'disputes'), true);
  assert.equal(wantsOptionalEmail(await stored(), 'approvals'), true);
});
