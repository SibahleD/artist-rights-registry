const pool = require('../db/pool');
const { cleanFeatures, projections, describe } = require('../lib/playlistFit');

const fail = (res, err, label) => { console.error(`${label} error:`, err); return res.status(500).json({ error: 'Internal server error' }); };

// What the page needs for one song: the numbers, a few words about the sound, and the playlist fits.
const shape = (row) => ({
    track_id: row.track_id,
    features: row.features,
    summary: describe(row.features),
    projections: projections(row.features),
    source: row.source || 'manual',
    analysed_at: row.analysed_at,
});

// PUT /api/releases/:releaseId/tracks/:trackId/audio-features   JSON: { energy, danceability, valence, acousticness, instrumentalness, speechiness, tempo }
// The artist describes their own song, so nothing leaves the server and no outside service is involved.
// Works on a draft or a ready release: it never changes the release.
async function saveFeatures(req, res) {
    try {
        const { rows } = await pool.query(
            `SELECT t.id FROM tracks t JOIN releases r ON r.id = t.release_id WHERE t.id = $1 AND r.id = $2 AND r.owner_id = $3`,
            [req.params.trackId, req.params.releaseId, req.user.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Track not found.' });

        const features = cleanFeatures(req.body);
        if (!features) return res.status(400).json({ error: 'Set energy, danceability and mood to see projections.' });
        const { rows: [saved] } = await pool.query(
            `INSERT INTO track_audio_features (track_id, features, source) VALUES ($1, $2, 'manual')
             ON CONFLICT (track_id) DO UPDATE SET features = EXCLUDED.features, source = 'manual', clip_start_seconds = 0, analysed_at = now()
             RETURNING track_id, features, source, analysed_at`,
            [rows[0].id, JSON.stringify(features)]);
        return res.status(201).json(shape(saved));
    } catch (e) { return fail(res, e, 'saveFeatures'); }
}

// GET /api/streams/projections: every analysed song of this artist.
async function listProjections(req, res) {
    try {
        const { rows } = await pool.query(
            `SELECT f.track_id, f.features, f.source, f.analysed_at
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

module.exports = { saveFeatures, listProjections, deleteFeatures, shape };
