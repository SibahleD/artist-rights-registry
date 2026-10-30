const { test, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');

// Fake database and fake ReccoBeats, so the real controller, multer and rate limiter run with no Postgres and no internet.
const poolPath = require.resolve('../src/db/pool');
let owns = true, saved = null;
require.cache[poolPath] = { id: poolPath, filename: poolPath, loaded: true, exports: { query: async (sql, args) => {
    if (/FROM tracks t JOIN releases r/.test(sql) && /SELECT t.id/.test(sql)) return { rows: owns ? [{ id: args[0] }] : [] };
    if (/INSERT INTO track_audio_features/.test(sql)) { saved = args; return { rows: [{ track_id: args[0], features: JSON.parse(args[1]), clip_start_seconds: args[2], analysed_at: new Date().toISOString() }] }; }
    if (/DELETE FROM track_audio_features/.test(sql)) return { rowCount: owns ? 1 : 0 };
    if (/FROM track_audio_features f/.test(sql)) return { rows: [{ track_id: 't1', features: { energy: 0.8, danceability: 0.8, valence: 0.7, tempo: 120 }, clip_start_seconds: 10, analysed_at: new Date().toISOString() }] };
    return { rows: [] };
} } };
const svcPath = require.resolve('../src/services/reccobeats');
const real = require(svcPath);
let extractCalls = 0;
require.cache[svcPath].exports = { ...real, extractFeatures: async (buf) => { extractCalls++; return { energy: 0.8, danceability: 0.8, valence: 0.7, tempo: 120 }; } };
const { analyseTrack, listProjections, deleteFeatures, analyseLimiter } = require('../src/controllers/audioFeatureController');

let server, base;
before(async () => {
    const app = express();
    app.use((req, _res, next) => { req.user = { id: 'u1' }; next(); });
    app.post('/api/releases/:releaseId/tracks/:trackId/audio-features', analyseLimiter, analyseTrack);
    app.delete('/api/releases/:releaseId/tracks/:trackId/audio-features', deleteFeatures);
    app.get('/api/streams/projections', listProjections);
    await new Promise((r) => { server = app.listen(0, r); });
    base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(64)]);
const post = (fileBuf, fields = {}) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    if (fileBuf) fd.append('file', new Blob([fileBuf], { type: 'audio/wav' }), 'clip.wav');
    return fetch(`${base}/releases/r1/tracks/t1/audio-features`, { method: 'POST', body: fd });
};

test('saves the numbers and returns projections for the owner', async () => {
    owns = true; extractCalls = 0;
    const res = await post(wav, { start: '45' });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(extractCalls, 1);
    assert.equal(saved[2], 45);
    assert.equal(body.clip_start_seconds, 45);
    assert.ok(body.summary.includes('High energy'));
    assert.equal(body.projections.length, 9);
});

test('a song that is not the artist\'s is a 404 and nothing is sent to the service', async () => {
    owns = false; extractCalls = 0;
    const res = await post(wav);
    assert.equal(res.status, 404);
    assert.equal(extractCalls, 0);
    owns = true;
});

test('a request with no clip is a 400', async () => {
    const res = await post(null, { start: '0' });
    assert.equal(res.status, 400);
});

test('lists and removes', async () => {
    owns = true;
    const list = await (await fetch(`${base}/streams/projections`)).json();
    assert.equal(list.songs.length, 1);
    assert.ok(list.songs[0].projections[0].fit >= 0);
    assert.equal((await fetch(`${base}/releases/r1/tracks/t1/audio-features`, { method: 'DELETE' })).status, 200);
    owns = false;
    assert.equal((await fetch(`${base}/releases/r1/tracks/t1/audio-features`, { method: 'DELETE' })).status, 404);
});
