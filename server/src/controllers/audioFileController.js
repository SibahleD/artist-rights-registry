const multer = require('multer');
const pool = require('../db/pool');
const limits = require('../limits');
const storage = require('../services/storage');
const { inspectAudio } = require('../services/mediaInspect');
const { assertRoom, humanMB } = require('../services/usage');

const HARD_CAP = 100 * 1024 * 1024;   // safety net when PILOT_LIMITS=off
const maxBytes = () => (limits.enabled ? limits.maxAudioBytes : HARD_CAP);

const receive = (req, res) => new Promise((resolve) => {
    multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes(), files: 1 } })
        .single('file')(req, res, (err) => resolve(err || null));
});

const cleanName = (n) => String(n || 'audio').replace(/[\x00-\x1f\\/]/g, '_').slice(0, 200);

async function findTrack(client, req, { requireDraft, lock = false }) {
    const { rows } = await client.query(
        `SELECT t.id, r.status FROM tracks t JOIN releases r ON r.id = t.release_id
         WHERE t.id = $1 AND r.id = $2 AND r.owner_id = $3 ${lock ? 'FOR UPDATE OF t' : ''}`,
        [req.params.trackId, req.params.releaseId, req.user.id]
    );
    if (!rows[0]) return { status: 404, error: 'Track not found.' };
    if (requireDraft && rows[0].status !== 'draft') return { status: 409, error: 'Ready releases are locked. Revert to draft to edit.' };
    return { track: rows[0] };
}

async function uploadAudio(req, res) {
    const pre = await findTrack(pool, req, { requireDraft: true });
    if (pre.error) return res.status(pre.status).json({ error: pre.error });

    const err = await receive(req, res);
    if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: `That file is too large. The test limit is ${humanMB(maxBytes())} per song. Export a smaller MP3 and keep your original master.` });
        }
        return res.status(400).json({ error: 'Upload failed. Send one audio file in the "file" field.' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file received. Send one audio file in the "file" field.' });

    const info = await inspectAudio(req.file.buffer);
    if (info.error) return res.status(400).json({ error: info.error });

    const key = storage.newKey('audio', info.ext);
    let client, oldKey = null, stored = false, committed = false;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const found = await findTrack(client, req, { requireDraft: true, lock: true });
        if (found.error) { await client.query('ROLLBACK'); return res.status(found.status).json({ error: found.error }); }

        const old = (await client.query('SELECT storage_key, size_bytes FROM audio_files WHERE track_id = $1', [found.track.id])).rows[0];
        await assertRoom(client, req.user.id, req.file.size, old ? Number(old.size_bytes) : 0);

        await storage.put(key, req.file.buffer); stored = true;
        await client.query(
            `INSERT INTO audio_files (track_id, owner_id, storage_key, mime_type, size_bytes)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (track_id) DO UPDATE SET storage_key = EXCLUDED.storage_key,
                 mime_type = EXCLUDED.mime_type, size_bytes = EXCLUDED.size_bytes, created_at = now()`,
            [found.track.id, req.user.id, key, info.mime, req.file.size]
        );
        
        const { rows } = await client.query(
            `INSERT INTO audio_specs (track_id, file_name, format, bitrate_kbps, sample_rate_hz, channels, size_bytes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (track_id) DO UPDATE SET file_name = EXCLUDED.file_name, format = EXCLUDED.format,
                 bitrate_kbps = EXCLUDED.bitrate_kbps, sample_rate_hz = EXCLUDED.sample_rate_hz,
                 channels = EXCLUDED.channels, size_bytes = EXCLUDED.size_bytes, recorded_at = now()
             RETURNING to_jsonb(audio_specs) - 'track_id' AS audio`,
            [found.track.id, cleanName(req.file.originalname), info.format, info.bitrateKbps, info.sampleRateHz, info.channels, req.file.size]
        );
        // The length always comes from the file itself, replacing whatever was there before.
        await client.query('UPDATE tracks SET duration_seconds = $2 WHERE id = $1', [found.track.id, info.durationSeconds]);
        await client.query('COMMIT'); committed = true;
        oldKey = old ? old.storage_key : null;
        return res.json({ audio: rows[0].audio, durationSeconds: info.durationSeconds });
    } catch (e) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        if (stored && !committed) await storage.delete(key);
        if (e && e.status) return res.status(e.status).json({ error: e.message });
        console.error('uploadAudio error:', e);
        return res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (client) client.release();
        if (oldKey) await storage.delete(oldKey);
    }
}

async function downloadAudio(req, res) {
    try {
        const { rows } = await pool.query(
            `SELECT f.storage_key, f.mime_type, s.file_name
             FROM audio_files f JOIN tracks t ON t.id = f.track_id JOIN releases r ON r.id = t.release_id
             LEFT JOIN audio_specs s ON s.track_id = t.id
             WHERE t.id = $1 AND r.id = $2 AND r.owner_id = $3`,
            [req.params.trackId, req.params.releaseId, req.user.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'No audio file for this track.' });
        const buf = await storage.get(rows[0].storage_key);
        res.set({
            'Content-Type': rows[0].mime_type,
            'Content-Length': buf.length,
            'Content-Disposition': `inline; filename="${encodeURIComponent(rows[0].file_name || 'audio')}"`,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
        });
        return res.send(buf);
    } catch (e) {
        console.error('downloadAudio error:', e);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = { uploadAudio, downloadAudio };