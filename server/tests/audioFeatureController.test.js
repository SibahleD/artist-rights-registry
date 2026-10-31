const { test, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');

// Fake database, so the real controller runs with no Postgres.
const poolPath = require.resolve('../src/db/pool');
let owns = true, saved = null;
require.cache[poolPath] = { id: poolPath, filename: poolPath, loaded: true, exports: { query: async (sql, args) => {
    if (/FROM tracks t JOIN releases r/.test(sql) && /SELECT t.id/.test(sql)) return { rows: owns ? [{ id: args[0] }] : [] };
    if (/INSERT INTO track_audio_features/.test(sql)) { saved = args; return { rows: [{ track_id: args[0], features: JSON.parse(args[1]), source: 'manual', analysed_at: new Date().toISOString() }] }; }
    if (/DELETE FROM track_audio_features/.test(sql)) return { rowCount: owns ? 1 : 0 };
    if (/FROM track_audio_features f/.test(sql)) return { rows: [{ track_id: 't1', features: { energy: 0.8, danceability: 0.8, valence: 0.7, tempo: 120 }, source: 'manual', analysed_at: new Date().toISOString() }] };
    return { rows: [] };
} } };
const { saveFeatures, listProjections, deleteFeatures } = require('../src/controllers/audioFeatureController');

let server, base;
before(async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = { id: 'u1' }; next(); });
    app.put('/api/releases/:releaseId/tracks/:trackId/audio-features', saveFeatures);
    app.delete('/api/releases/:releaseId/tracks/:trackId/audio-features', deleteFeatures);
    app.get('/api/streams/projections', listProjections);
    await new Promise((r) => { server = app.listen(0, r); });
    base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

const put = (body) => fetch(`${base}/releases/r1/tracks/t1/audio-features`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('saves the numbers the artist sets and returns projections', async () => {
    owns = true; saved = null;
    const res = await put({ energy: 0.8, danceability: 0.8, valence: 0.7, tempo: 120, id: 'junk' });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.summary.includes('High energy'));
    assert.equal(body.projections.length, 9);
    assert.equal(body.source, 'manual');
    assert.ok(!('id' in JSON.parse(saved[1])));
});

test('a song that is not the artist\'s is a 404 and nothing is saved', async () => {
    owns = false; saved = null;
    assert.equal((await put({ energy: 0.8, danceability: 0.8, valence: 0.7 })).status, 404);
    assert.equal(saved, null);
    owns = true;
});

test('missing energy, danceability or mood is a 400', async () => {
    assert.equal((await put({ tempo: 120 })).status, 400);
    assert.equal((await put({ energy: 0.5, danceability: 0.5 })).status, 400);
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
