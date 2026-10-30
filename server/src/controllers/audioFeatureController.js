const multer = require('multer');
const rateLimit = require('express-rate-limit');
const pool = require('../db/pool');
const { extractFeatures, FeatureError, MAX_CLIP_BYTES } = require('../services/reccobeats');
const { projections, describe } = require('../lib/playlistFit');

const fail = (res, err, label) => { console.error(`${label} error:`, err); return res.status(500).json({ error: 'Internal server error' }); };

// What the page needs for one song: the numbers, a few words about the sound, and the playlist fits.
const shape = (row) => ({
    track_id: row.track_id,
    features: row.features,
    summary: describe(row.features),
    projections: projections(row.features),
    clip_start_seconds: row.clip_start_seconds,
    analysed_at: row.analysed_at,
});

const receive = (req, res) => new Promise((resolve) => {
    multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_CLIP_BYTES, files: 1, fields: 4 } })
        .single('file')(req, res, (err) => resolve(err || null));
});

// Each analysis sends a clip to a third party, so keep it modest per artist.
const analyseLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: Number(process.env.AUDIO_FEATURES_PER_HOUR) || 30,
    keyGenerator: (req) => req.user.id,
    validate: { keyGeneratorIpFallback: false },
    standardHeaders: true,
    message: { error: 'That is a lot of analyses for one hour. Try again later.' },
});

// POST /api/releases/:releaseId/tracks/:trackId/audio-features   multipart: file (a WAV clip), start (seconds into the song)
// Works on a draft or a ready release: it only reads a clip, it never changes the release.
async function analyseTrack(req, res) {
    try {
        const { rows } = await pool.query(
            `SELECT t.id FROM tracks t JOIN releases r ON r.id = t.release_id WHERE t.id = $1 AND r.id = $2 AND r.owner_id = $3`,
            [req.params.trackId, req.params.releaseId, req.user.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Track not found.' });

        const err = await receive(req, res);
        if (err) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'That clip is over 5 MB.' : 'Send one WAV clip in the "file" field.' });
        if (!req.file) return res.status(400).json({ error: 'No clip received. Send one WAV clip in the "file" field.' });

        const features = await extractFeatures(req.file.buffer);
        const start = Math.max(0, Math.min(36000, Math.round(Number(req.body && req.body.start) || 0)));
        const { rows: [saved] } = await pool.query(
            `INSERT INTO track_audio_features (track_id, features, clip_start_seconds) VALUES ($1, $2, $3)
             ON CONFLICT (track_id) DO UPDATE SET features = EXCLUDED.features, clip_start_seconds = EXCLUDED.clip_start_seconds, analysed_at = now()
             RETURNING track_id, features, clip_start_seconds, analysed_at`,
            [rows[0].id, JSON.stringify(features), start]);
        return res.status(201).json(shape(saved));
    } catch (e) {
        if (e instanceof FeatureError) return res.status(e.status).json({ error: e.message });
        return fail(res, e, 'analyseTrack');
    }
}

// GET /api/streams/projections: every analysed song of this artist.
async function listProjections(req, res) {
    try {
        const { rows } = await pool.query(
            `SELECT f.track_id, f.features, f.clip_start_seconds, f.analysed_at
             FROM track_audio_features f JOIN tracks t ON t.id = f.track_id JOIN releases r ON r.id = t.release_id
             WHERE r.owner_id = $1`, [req.user.id]);
        return res.json({ songs: rows.map(shape) });
    } catch (e) { return fail(res, e, 'listProjections'); }
}

// DELETE /api/releases/:releaseId/tracks/:trackId/audio-features
async function deleteFeatures(req, res) {
    try {
        const r = await pool.query(
            `DELETE FROM track_audio_features f USING tracks t, releases r
             WHERE f.track_id = t.id AND t.release_id = r.id AND t.id = $1 AND r.id = $2 AND r.owner_id = $3`,
            [req.params.trackId, req.params.releaseId, req.user.id]);
        if (!r.rowCount) return res.status(404).json({ error: 'Nothing to remove.' });
        return res.json({ removed: true });
    } catch (e) { return fail(res, e, 'deleteFeatures'); }
}

module.exports = { analyseTrack, listProjections, deleteFeatures, analyseLimiter, shape };
