const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

// Needs a migrated database: set TEST_DATABASE_URL to run.
const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : 'set TEST_DATABASE_URL to run';
let pool, sc, a, b;

async function call(handler, user, { body, query, params } = {}) {
  const out = { status: 200, body: undefined };
  const res = { status(c) { out.status = c; return this; }, json(x) { out.body = x; return this; }, end() { return this; } };
  await handler({ body, query: query || {}, params: params || {}, user: { id: user.id } }, res);
  return out;
}

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = url;
  process.env.JWT_SECRET ||= 'test-secret';
  pool = require('../src/db/pool');
  sc = require('../src/controllers/streamController');
  const mk = async (email) => (await pool.query(`INSERT INTO users (email, password_hash, artist_name) VALUES ($1,'x','Streams') RETURNING id`, [email])).rows[0];
  a = await mk('streams-ctl-a@example.com');
  b = await mk('streams-ctl-b@example.com');
  const rel = (await pool.query(`INSERT INTO releases (owner_id, title, album_artist) VALUES ($1,'Head in the Clouds','Me') RETURNING id`, [a.id])).rows[0];
  await pool.query(`INSERT INTO tracks (release_id, track_number, title, isrc) VALUES ($1,1,'Cloud One','KEABC2600001'), ($1,2,'No ISRC yet',NULL)`, [rel.id]);
});

after(async () => {
  if (skip) return;
  await pool.query('DELETE FROM releases WHERE owner_id = $1', [a.id]);
  await pool.query('DELETE FROM users WHERE id = ANY($1)', [[a.id, b.id]]);
  await pool.end();
});

test('an import saves merged rows, logs itself and counts ISRCs not in the catalogue', { skip }, async () => {
  const r = await call(sc.importStreams, a, { body: { source: 'csv', platform: 'spotify', fileName: 'sep.csv', rows: [
    { isrc: 'KEABC2600001', period: '2026-09', streams: 100 },
    { isrc: 'KEABC2600001', period: '2026-09-20', streams: 20 },
    { isrc: 'KEABC2600099', period: '2026-09', streams: 5 },
    { isrc: 'bad', period: '2026-09', streams: 5 },
  ] } });
  assert.equal(r.status, 201);
  assert.equal(r.body.import.rows_read, 4);
  assert.equal(r.body.import.rows_saved, 2);
  assert.equal(r.body.import.rows_skipped, 1);
  assert.equal(r.body.unmatched_isrcs, 1);
  const got = await call(sc.getStreams, a);
  const mine = got.body.stats.find((s) => s.isrc === 'KEABC2600001');
  assert.equal(mine.streams, 120);
  assert.equal(got.body.tracks.length, 2);
  assert.equal(got.body.first_period, '2026-09-01');
});

test('re-importing a month replaces the earlier figure', { skip }, async () => {
  await call(sc.importStreams, a, { body: { platform: 'spotify', rows: [{ isrc: 'KEABC2600001', period: '2026-09', streams: 500 }] } });
  const got = await call(sc.getStreams, a);
  const rows = got.body.stats.filter((s) => s.isrc === 'KEABC2600001');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].streams, 500);
});

test('an import with no usable rows is refused and saves nothing', { skip }, async () => {
  const before = (await pool.query('SELECT count(*)::int n FROM stream_imports WHERE user_id = $1', [a.id])).rows[0].n;
  const r = await call(sc.importStreams, a, { body: { platform: 'spotify', rows: [{ isrc: 'x', period: 'y', streams: 'z' }] } });
  assert.equal(r.status, 400);
  const after = (await pool.query('SELECT count(*)::int n FROM stream_imports WHERE user_id = $1', [a.id])).rows[0].n;
  assert.equal(after, before);
});

test('artists only see their own figures and cannot delete anyone else\'s import', { skip }, async () => {
  assert.equal((await call(sc.getStreams, b)).body.stats.length, 0);
  const imp = (await call(sc.listImports, a)).body.imports[0];
  assert.equal((await call(sc.deleteImport, b, { params: { id: imp.id } })).status, 404);
});

test('the date range filters figures', { skip }, async () => {
  await call(sc.importStreams, a, { body: { platform: 'tidal', rows: [{ isrc: 'KEABC2600001', period: '2026-08', streams: 3 }] } });
  const got = await call(sc.getStreams, a, { query: { from: '2026-09', to: '2026-09' } });
  assert.ok(got.body.stats.every((s) => s.period === '2026-09-01'));
  assert.equal((await call(sc.getStreams, a, { query: { from: 'nonsense' } })).status, 400);
});

test('deleting an import removes the figures it set', { skip }, async () => {
  const imp = (await call(sc.listImports, a)).body.imports[0];   // the tidal one
  const r = await call(sc.deleteImport, a, { params: { id: imp.id } });
  assert.equal(r.body.removed, 1);
  const left = await call(sc.getStreams, a);
  assert.ok(!left.body.stats.some((s) => s.platform === 'tidal'));
});
