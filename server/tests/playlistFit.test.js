const { test } = require('node:test');
const assert = require('node:assert');
const { cleanFeatures, projections, describe, closeness } = require('../src/lib/playlistFit');
const { extractFeatures, looksLikeWav, FeatureError } = require('../src/services/reccobeats');

const dance = { acousticness: 0.12, danceability: 0.82, energy: 0.78, instrumentalness: 0.01, liveness: 0.1, loudness: -6, speechiness: 0.06, tempo: 118, valence: 0.74 };
const mellow = { acousticness: 0.8, danceability: 0.4, energy: 0.2, instrumentalness: 0.05, liveness: 0.1, loudness: -14, speechiness: 0.04, tempo: 76, valence: 0.25 };

test('cleanFeatures keeps the nine numbers in range and drops the rest', () => {
    const f = cleanFeatures({ ...dance, energy: 1.7, loudness: -99, id: 'x', key: 5 });
    assert.equal(f.energy, 1);
    assert.equal(f.loudness, -60);
    assert.ok(!('id' in f) && !('key' in f));
});

test('cleanFeatures refuses a result without the three core measures', () => {
    assert.equal(cleanFeatures({ tempo: 120 }), null);
    assert.equal(cleanFeatures(null), null);
    assert.equal(cleanFeatures({ ...dance, valence: 'abc' }), null);
});

test('closeness is 1 inside the range and falls to 0 at the soft edge', () => {
    const r = { lo: 0.5, hi: 0.8, soft: 0.2 };
    assert.equal(closeness(0.6, r), 1);
    assert.ok(Math.abs(closeness(0.9, r) - 0.5) < 1e-9);
    assert.equal(closeness(1.2, r), 0);
});

test('a danceable, high-energy song fits party and workout best; a mellow one fits chill and acoustic', () => {
    const top = (f) => projections(f).slice(0, 4).map((p) => p.id);
    assert.ok(top(dance).includes('party') && top(dance).includes('workout'));
    assert.ok(top(mellow).includes('chill') && top(mellow).includes('acoustic'));
    assert.ok(projections(mellow).find((p) => p.id === 'workout').fit < 35);
});

test('projections are sorted, bounded 0 to 100, and explain themselves', () => {
    const list = projections(dance);
    assert.equal(list.length, 9);
    assert.ok(list.every((p, i) => p.fit >= 0 && p.fit <= 100 && (i === 0 || list[i - 1].fit >= p.fit)));
    assert.ok(list[0].why.length > 0 && list[0].band);
    assert.deepEqual(projections({}), []);
});

test('describe gives plain words and a BPM', () => {
    const d = describe(dance);
    assert.ok(d.includes('High energy') && d.includes('Very danceable') && d.includes('118 BPM'));
});

// ---- ReccoBeats service, with a fake fetch ----
const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(64)]);
const ok = (body) => async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => body });

test('looksLikeWav checks the header', () => {
    assert.ok(looksLikeWav(wav));
    assert.ok(!looksLikeWav(Buffer.from('ID3 not a wav file at all, nope nope nope nope nope nope nope')));
});

test('extractFeatures posts the clip as audioFile and returns cleaned numbers', async () => {
    let sent;
    const f = await extractFeatures(wav, async (url, opts) => { sent = { url, opts }; return ok({ ...dance, id: 'zzz' })(); });
    assert.equal(sent.opts.method, 'POST');
    assert.ok(sent.opts.body.get('audioFile'));
    assert.equal(f.tempo, 118);
    assert.ok(!('id' in f));
});

test('extractFeatures turns service problems into plain errors', async () => {
    await assert.rejects(() => extractFeatures(Buffer.from('nope')), (e) => e instanceof FeatureError && e.status === 400);
    await assert.rejects(() => extractFeatures(wav, async () => ({ ok: false, status: 429, headers: { get: () => '12' } })), (e) => e.status === 503 && /12 seconds/.test(e.message));
    await assert.rejects(() => extractFeatures(wav, async () => ({ ok: false, status: 400, headers: { get: () => null } })), (e) => e.status === 502);
    await assert.rejects(() => extractFeatures(wav, async () => { throw new Error('offline'); }), (e) => e.status === 503);
    await assert.rejects(() => extractFeatures(wav, ok({ tempo: 100 })), (e) => e.status === 502);
});
