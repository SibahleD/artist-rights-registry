const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { inspectAudio } = require('../src/services/mediaInspect');

// A silent mono 16-bit WAV of an exact length: the real file format, no fixtures to keep around.
function wav(seconds, rate = 8000) {
  const n = Math.round(seconds * rate) * 2;
  const b = Buffer.alloc(44 + n);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n, 40);
  return b;
}

test('the length is read from the file and rounded to whole seconds', async () => {
  assert.equal((await inspectAudio(wav(3.4))).durationSeconds, 3);
  assert.equal((await inspectAudio(wav(2.6))).durationSeconds, 3);
  const info = await inspectAudio(wav(185));
  assert.equal(info.durationSeconds, 185);
  assert.equal(info.format, 'wav');
});

test('a file with no usable length is refused rather than stored without one', async () => {
  const tiny = await inspectAudio(wav(0.2));
  assert.match(tiny.error, /how long/);
  assert.ok(!tiny.durationSeconds);
  assert.ok((await inspectAudio(Buffer.from('definitely not audio'))).error);
});

// A silent 128 kbps / 44.1 kHz MP3 made of bare frames (417 bytes each, about 26 ms), for the upload route, which now
// accepts only MP3 and FLAC.
function mp3(seconds) {
  const frames = Math.round(seconds / 0.026122);
  const f = Buffer.alloc(417); f[0] = 0xff; f[1] = 0xfb; f[2] = 0x90; f[3] = 0x00;
  return Buffer.concat(Array.from({ length: frames }, () => f));
}

test('only MP3 and FLAC pass the format check', async () => {
  const { audioFormatError } = require('../src/services/mediaInspect');
  assert.equal(audioFormatError({ format: 'mp3' }), null);
  assert.equal(audioFormatError({ format: 'flac' }), null);
  for (const format of ['wav', 'aac', 'other']) assert.match(audioFormatError({ format }), /MP3 and FLAC/);
});

const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : 'set TEST_DATABASE_URL to run';
let pool, server, base, owner, releaseId, trackId;

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = url;
  pool = require('../src/db/pool');
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { id: owner.id, email: owner.email }; next(); });
  app.use('/releases/:releaseId/tracks', require('../src/routes/tracks'));
  server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  base = `http://127.0.0.1:${server.address().port}`;

  owner = (await pool.query(`INSERT INTO users (email, password_hash, artist_name) VALUES ('duration@example.com','x','Dur') RETURNING id, email`)).rows[0];
  releaseId = (await pool.query(`INSERT INTO releases (owner_id, title, album_artist) VALUES ($1,'R','Dur') RETURNING id`, [owner.id])).rows[0].id;
  trackId = (await pool.query(`INSERT INTO tracks (release_id, track_number, title) VALUES ($1,1,'T') RETURNING id`, [releaseId])).rows[0].id;
});

after(async () => {
  if (skip) return;
  const keys = (await pool.query('SELECT storage_key FROM audio_files WHERE track_id = $1', [trackId])).rows;
  const storage = require('../src/services/storage');
  await Promise.all(keys.map((k) => storage.delete(k.storage_key)));
  await pool.query('DELETE FROM releases WHERE id = $1', [releaseId]);
  await pool.query('DELETE FROM users WHERE id = $1', [owner.id]);
  await new Promise((r) => server.close(r));
  await pool.end();
});

const dur = async () => (await pool.query('SELECT duration_seconds FROM tracks WHERE id = $1', [trackId])).rows[0].duration_seconds;
const put = (buf, name = 'song.mp3') => {
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'audio/mpeg' }), name);
  return fetch(`${base}/releases/${releaseId}/tracks/${trackId}/audio/file`, { method: 'PUT', body: fd });
};

test('upload sets the duration, typing one in is ignored, replacing updates it, a bad file changes nothing, delete clears it', { skip }, async () => {
  assert.equal(await dur(), null);

  // WAV is no longer accepted
  const refused = await put(wav(3.4), 'song.wav');
  assert.equal(refused.status, 400);
  assert.equal(await dur(), null);

  const up = await put(mp3(3.4));
  assert.equal(up.status, 200);
  assert.equal((await up.json()).durationSeconds, 3);
  assert.equal(await dur(), 3);

  // a typed value cannot override what the file says
  const patch = await fetch(`${base}/releases/${releaseId}/tracks/${trackId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'T2', durationSeconds: 999 }),
  });
  assert.equal(patch.status, 200);
  assert.equal(await dur(), 3);

  assert.equal((await put(mp3(5))).status, 200);
  assert.equal(await dur(), 5);

  const bad = await put(mp3(0.2));
  assert.equal(bad.status, 400);
  assert.equal(await dur(), 5);
  assert.equal((await pool.query('SELECT 1 FROM audio_files WHERE track_id = $1', [trackId])).rowCount, 1);

  const del = await fetch(`${base}/releases/${releaseId}/tracks/${trackId}/audio`, { method: 'DELETE' });
  assert.equal(del.status, 204);
  assert.equal(await dur(), null);
});
