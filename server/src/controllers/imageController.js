const multer = require('multer');
const pool = require('../db/pool');
const limits = require('../limits');
const { inspectImage } = require('../services/mediaInspect');
const { assertRoom, humanMB } = require('../services/usage');

const cap = (kind) => (kind === 'avatar' ? limits.effective.avatarBytes : limits.effective.coverBytes);

const receive = (req, res, max) => new Promise((resolve) => {
    multer({ storage: multer.memoryStorage(), limits: { fileSize: max, files: 1 } })
        .single('file')(req, res, (err) => resolve(err || null));
});

async function saveImage(req, res, scope) {
    const max = cap(scope.kind);
    const err = await receive(req, res, max);
    if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: `That image is too large. The test limit is ${humanMB(max)} for ${scope.kind === 'avatar' ? 'a profile picture' : 'cover art'}. Export a smaller JPEG or PNG.` });
        }
        return res.status(400).json({ error: 'Upload failed. Send one image in the "file" field.' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file received. Send one image in the "file" field.' });

    const info = inspectImage(req.file.buffer);
    if (info.error) return res.status(400).json({ error: info.error });

    const warnings = [];
    if (scope.kind === 'artwork') {
        if (info.width !== info.height) warnings.push('Cover art should be square. Most stores will reject other shapes.');
        if (Math.min(info.width, info.height) < 1400) warnings.push('Most stores want at least 1400 x 1400 pixels. This image is smaller.');
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const where = scope.kind === 'avatar' ? 'owner_id = $1 AND kind = \'avatar\'' : 'release_id = $1 AND kind = \'artwork\'';
        const old = (await client.query(`SELECT size_bytes FROM media WHERE ${where}`, [scope.kind === 'avatar' ? scope.ownerId : scope.releaseId])).rows[0];
        await assertRoom(client, scope.ownerId, req.file.size, old ? old.size_bytes : 0);

        const sql = scope.kind === 'avatar'
            ? `INSERT INTO media (kind, owner_id, mime_type, width, height, size_bytes, data) VALUES ('avatar', $1, $2, $3, $4, $5, $6)
               ON CONFLICT (owner_id) WHERE kind = 'avatar' DO UPDATE SET mime_type = EXCLUDED.mime_type, width = EXCLUDED.width,
                 height = EXCLUDED.height, size_bytes = EXCLUDED.size_bytes, data = EXCLUDED.data, created_at = now()
               RETURNING id, mime_type, width, height, size_bytes`
            : `INSERT INTO media (kind, owner_id, release_id, mime_type, width, height, size_bytes, data) VALUES ('artwork', $7, $1, $2, $3, $4, $5, $6)
               ON CONFLICT (release_id) WHERE kind = 'artwork' DO UPDATE SET mime_type = EXCLUDED.mime_type, width = EXCLUDED.width,
                 height = EXCLUDED.height, size_bytes = EXCLUDED.size_bytes, data = EXCLUDED.data, created_at = now()
               RETURNING id, mime_type, width, height, size_bytes`;
        const args = [scope.kind === 'avatar' ? scope.ownerId : scope.releaseId, info.mime, info.width, info.height, req.file.size, req.file.buffer];
        if (scope.kind === 'artwork') args.push(scope.ownerId);
        const { rows } = await client.query(sql, args);
        await client.query('COMMIT');
        return res.json({ media: rows[0], warnings });
    } catch (e) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        if (e && e.status) return res.status(e.status).json({ error: e.message });
        console.error('saveImage error:', e);
        return res.status(500).json({ error: 'Internal server error' });
    } finally { if (client) client.release(); }
}

const putAvatar = (req, res) => saveImage(req, res, { kind: 'avatar', ownerId: req.user.id });

async function putArtwork(req, res) {
    const { rows } = await pool.query('SELECT id, status FROM releases WHERE id = $1 AND owner_id = $2', [req.params.id, req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Release not found.' });
    if (rows[0].status !== 'draft') return res.status(409).json({ error: 'Ready releases are locked. Revert to draft to edit.' });
    return saveImage(req, res, { kind: 'artwork', ownerId: req.user.id, releaseId: rows[0].id });
}

async function deleteAvatar(req, res) {
    await pool.query(`DELETE FROM media WHERE owner_id = $1 AND kind = 'avatar'`, [req.user.id]);
    return res.status(204).end();
}

async function deleteArtwork(req, res) {
    const { rows } = await pool.query('SELECT id, status FROM releases WHERE id = $1 AND owner_id = $2', [req.params.id, req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Release not found.' });
    if (rows[0].status !== 'draft') return res.status(409).json({ error: 'Ready releases are locked. Revert to draft to edit.' });
    await pool.query(`DELETE FROM media WHERE release_id = $1 AND kind = 'artwork'`, [rows[0].id]);
    return res.status(204).end();
}

async function getMedia(req, res) {
    try {
        const { rows } = await pool.query(
            `SELECT m.mime_type, m.data FROM media m
             WHERE m.id = $1 AND (
               m.owner_id = $2
               OR EXISTS (
                 SELECT 1 FROM collaborators c JOIN tracks t ON t.id = c.track_id JOIN releases r ON r.id = t.release_id
                 WHERE c.user_id = $2 AND r.status = 'ready' AND r.owner_id = m.owner_id
                   AND (m.release_id IS NULL OR r.id = m.release_id)))`,
            [req.params.id, req.user.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Image not found.' });
        res.set({ 'Content-Type': rows[0].mime_type, 'Content-Length': rows[0].data.length,
                  'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' });
        return res.send(rows[0].data);
    } catch (e) {
        console.error('getMedia error:', e);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = { putAvatar, putArtwork, deleteAvatar, deleteArtwork, getMedia };