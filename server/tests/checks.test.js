const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : 'set TEST_DATABASE_URL to run';
let pool, svc, exp, notices, owner, release, t1, t2, collabs;

const hashOf = (e) => notices.emailHash(e);

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = url;
  process.env.EMAIL_HASH_KEY ||= 'test-key';
  pool = require('../src/db/pool');
  svc = require('../src/services/readiness');
  exp = require('../src/services/exportRelease');
  notices = require('../src/services/notices');

  owner = (await pool.query(
    `INSERT INTO users (email, password_hash, artist_name) VALUES ('checks-owner@example.com','x','Kenny TL') RETURNING id, email`)).rows[0];
  release = (await pool.query(
    `INSERT INTO releases (owner_id, title, album_artist, release_type) VALUES ($1,'Air It Out','Kenny TL','ep') RETURNING *`, [owner.id])).rows[0];
  t1 = (await pool.query(`INSERT INTO tracks (release_id, track_number, title) VALUES ($1,1,'One') RETURNING id`, [release.id])).rows[0].id;
  t2 = (await pool.query(`INSERT INTO tracks (release_id, track_number, title, artist_name, isrc) VALUES ($1,2,'Two','kenny tl','USABC2400001') RETURNING id`, [release.id])).rows[0].id;
  await pool.query(`INSERT INTO audio_specs (track_id, file_name, format) VALUES ($1,'a.mp3','mp3')`, [t2]);
  await pool.query(`INSERT INTO audio_files (track_id, owner_id, storage_key, mime_type, size_bytes) VALUES ($1,$2,'audio/00000000-0000-0000-0000-000000000000.mp3','audio/mpeg',1000)`, [t2, owner.id]);
  collabs = {};
  collabs.me = (await pool.query(
    `INSERT INTO collaborators (track_id, user_id, invited_email, legal_name, ownership_percent) VALUES ($1,$2,$3,'Ada Obi',60) RETURNING id`,
    [t2, owner.id, owner.email])).rows[0].id;
  collabs.jean = (await pool.query(
    `INSERT INTO collaborators (track_id, invited_email, legal_name, ownership_percent) VALUES ($1,'jean-checks@example.com','Jean Mugisha',40) RETURNING id`,
    [t2])).rows[0].id;
});

after(async () => {
  if (skip) return;
  await pool.query('DELETE FROM releases WHERE id = $1', [release.id]);
  await pool.query('DELETE FROM users WHERE id = $1', [owner.id]);
  await pool.end();
});

const fresh = async () => (await pool.query('SELECT * FROM releases WHERE id = $1', [release.id])).rows[0];

test('checks carry level, message and a fix route, errors first', { skip }, async () => {
  const rel = { ...(await fresh()), release_date: '2026-12-01' };
  const checks = await svc.readinessChecks(rel);
  const audio = checks.find((c) => c.id === 'track-audio');
  assert.equal(audio.level, 'error');
  assert.equal(audio.track, 1);
  assert.equal(audio.fix, `/releases/${release.id}/edit?track=1`);
  const levels = checks.map((c) => c.level);
  assert.deepEqual(levels, [...levels].sort((a, b) => ['error', 'warn', 'info'].indexOf(a) - ['error', 'warn', 'info'].indexOf(b)));
  // track 1 has no audio and no splits, so it blocks
  assert.ok(checks.some((c) => c.id === 'track-splits' && c.track === 1));
  assert.ok((await svc.readinessProblems(rel)).includes('Track 1 ("One") has no audio file.'));
});

test('a stored audio file and cover art are required, typed specs alone are not enough', { skip }, async () => {
  const rel = { ...(await fresh()), release_date: '2026-12-01' };
  let checks = await svc.readinessChecks(rel);
  const art = checks.find((c) => c.id === 'release-artwork');
  assert.equal(art.level, 'error');

  // audio_specs without an audio_files row does not count as audio
  await pool.query('DELETE FROM audio_files WHERE track_id = $1', [t2]);
  checks = await svc.readinessChecks(rel);
  assert.ok(checks.some((c) => c.id === 'track-audio' && c.track === 2));
  await pool.query(`INSERT INTO audio_files (track_id, owner_id, storage_key, mime_type, size_bytes) VALUES ($1,$2,'audio/00000000-0000-0000-0000-000000000000.mp3','audio/mpeg',1000)`, [t2, owner.id]);
  checks = await svc.readinessChecks(rel);
  assert.ok(!checks.some((c) => c.id === 'track-audio' && c.track === 2));

  await pool.query(`INSERT INTO media (kind, owner_id, release_id, mime_type, width, height, size_bytes, data) VALUES ('artwork',$1,$2,'image/png',1400,1400,4,decode('89504e47','hex'))`, [owner.id, release.id]);
  checks = await svc.readinessChecks(rel);
  assert.ok(!checks.some((c) => c.id === 'release-artwork'));
});

test('missing ISRC, ISWC, UPC and IPI are info only, never errors', { skip }, async () => {
  const checks = await svc.readinessChecks({ ...(await fresh()), release_date: '2026-12-01' });
  const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
  assert.equal(byId['isrc-missing'].level, 'info');
  assert.match(byId['isrc-missing'].message, /track 1\b/);
  assert.equal(byId['iswc-missing'].level, 'info');
  assert.equal(byId['upc-missing'].level, 'info');
  assert.equal(byId['ipi-missing'].level, 'info');
  assert.match(byId['ipi-missing'].message, /Ada Obi/);
  assert.ok(!svc.errorsOf(checks).some((m) => /ISRC|ISWC|UPC|IPI/.test(m)));
});

test('inconsistent artist spelling is a warning that does not need acknowledging', { skip }, async () => {
  const checks = await svc.readinessChecks({ ...(await fresh()), release_date: '2026-12-01' });
  const w = checks.find((c) => c.id === 'artist-name-spelling');
  assert.equal(w.level, 'warn');
  assert.ok(!w.needsAck);
  assert.match(w.message, /Kenny TL/);
  assert.ok(!svc.blockingWarnings(checks).some((c) => c.id === 'artist-name-spelling'));
});

test('an unconfirmed co-writer is a warning that blocks until acknowledged', { skip }, async () => {
  let rel = { ...(await fresh()), release_date: '2026-12-01' };
  let checks = await svc.readinessChecks(rel);
  const w = checks.find((c) => c.id === 'cowriter-unconfirmed');
  assert.equal(w.level, 'warn');
  assert.equal(w.needsAck, true);
  assert.equal(w.acknowledged, false);
  assert.equal(svc.blockingWarnings(checks).length, 1);

  rel = { ...rel, unconfirmed_acknowledged_at: new Date() };
  checks = await svc.readinessChecks(rel);
  assert.equal(svc.blockingWarnings(checks).length, 0);
  assert.equal(checks.find((c) => c.id === 'cowriter-unconfirmed').acknowledged, true);
});

test('export marks credits confirmed / unconfirmed / removed and leaks nothing', { skip }, async () => {
  const rel = await fresh();
  let out = await exp.buildExport(rel);
  assert.deepEqual(exp.findIdKeys(out), []);
  const credits = out.tracks[1].credits;
  assert.deepEqual(credits.map((c) => [c.legal_name, c.confirmation]), [['Ada Obi', 'confirmed'], ['Jean Mugisha', 'unconfirmed']]);
  assert.ok(!JSON.stringify(out).includes('example.com'));
  assert.equal(out.tracks[0].audio, null);
  assert.equal(out.tracks[1].audio.format, 'mp3');

  // a confirmed notice with matching role and share flips Jean to confirmed
  await pool.query(
    `INSERT INTO collaborator_notices (track_id, email_hash, email, co_writer_name, role, share_percent, token_hash, notice_version, status, sent_by, expires_at)
     VALUES ($1,$2,'jean-checks@example.com','Jean Mugisha','songwriter',40,'tok-checks-1','v','confirmed',$3, now() + interval '1 day')`,
    [t2, hashOf('jean-checks@example.com'), owner.id]);
  out = await exp.buildExport(rel);
  assert.equal(out.tracks[1].credits[1].confirmation, 'confirmed');

  // changing the share after confirmation sends it back to unconfirmed
  await pool.query('UPDATE collaborators SET ownership_percent = 35 WHERE id = $1', [collabs.jean]);
  out = await exp.buildExport(rel);
  assert.equal(out.tracks[1].credits[1].confirmation, 'unconfirmed');
  await pool.query('UPDATE collaborators SET ownership_percent = 40 WHERE id = $1', [collabs.jean]);

  // the owner's own credit, pre-filled with their name and no email, counts as confirmed
  const own = (await pool.query(
    `INSERT INTO collaborators (track_id, legal_name, ownership_percent, role) VALUES ($1,'Kenny TL',0,'producer') RETURNING id`, [t2])).rows[0].id;
  out = await exp.buildExport(rel);
  assert.equal(out.tracks[1].credits.find((c) => c.legal_name === 'Kenny TL').confirmation, 'confirmed');
  await pool.query('DELETE FROM collaborators WHERE id = $1', [own]);

  // removed by the writer
  await pool.query(`UPDATE collaborators SET removed_by_writer = true, invited_email = NULL, user_id = NULL, legal_name = 'Removed by writer' WHERE id = $1`, [collabs.jean]);
  out = await exp.buildExport(rel);
  assert.equal(out.tracks[1].credits[1].confirmation, 'removed');
  const checks = await svc.readinessChecks({ ...rel, release_date: '2026-12-01' });
  assert.ok(checks.some((c) => c.id === 'cowriter-removed' && c.level === 'error' && c.fix.endsWith('?track=2')));
});
