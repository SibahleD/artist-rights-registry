const pool = require('../db/pool');

const { ROLES, parseCollaborators } = require('../lib/splits');
const { emailHash } = require('../services/notices');


async function claimInvites(user) {
    if (!user.emailVerified) return;
    await pool.query(
        `UPDATE collaborators c SET user_id = $1
         WHERE c.user_id IS NULL AND c.invited_email = $2
           AND NOT EXISTS (SELECT 1 FROM collaborators o
                           WHERE o.track_id = c.track_id AND o.user_id = $1)`,
        [user.id, user.email]
    );
}

const COLLAB_COLS = 'id, track_id, user_id, invited_email, legal_name, role, ownership_percent, removed_by_writer,\n    ipi, writer_status, publisher_name, is_self_published, created_at';

async function listCollaborators(req, res) {
    try {
        const { rows: own } = await pool.query(
            `SELECT t.id FROM tracks t JOIN releases r ON r.id = t.release_id
             WHERE t.id = $1 AND r.id = $2 AND r.owner_id = $3`,
            [req.params.trackId, req.params.releaseId, req.user.id]
        );
        if (!own[0]) return res.status(404).json({ error: 'Track not found.' });

        const { rows } = await pool.query(
            `SELECT ${COLLAB_COLS} FROM collaborators WHERE track_id = $1
             ORDER BY ownership_percent DESC, created_at`,
            [req.params.trackId]
        );
        return res.json({ collaborators: rows });
    } catch (err) {
        console.error('listCollaborators error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function replaceCollaborators(req, res) {
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const { rows: found } = await client.query(
            `SELECT t.id, r.status FROM tracks t JOIN releases r ON r.id = t.release_id
             WHERE t.id = $1 AND r.id = $2 AND r.owner_id = $3
             FOR UPDATE OF t`,
            [req.params.trackId, req.params.releaseId, req.user.id]
        );
        if (!found[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Track not found.' });
        }
        if (found[0].status !== 'draft') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Ready releases are locked. Revert to draft to edit.' });
        }

        const { rows: removedRows } = await client.query(
            `SELECT id, ownership_percent FROM collaborators WHERE track_id = $1 AND removed_by_writer`,
            [found[0].id]
        );
        const { data, discardIds, error } = parseCollaborators(
            req.body,
            removedRows.map((r) => ({ id: r.id, cents: Math.round(Number(r.ownership_percent) * 100) }))
        );
        if (error) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error });
        }

        const emails = data.map((c) => c.email).filter(Boolean);
        const users = emails.length
            ? await client.query('SELECT id, email FROM users WHERE email = ANY($1) AND deleted_at IS NULL AND email_verified_at IS NOT NULL', [emails])
            : { rows: [] };
        const idByEmail = new Map(users.rows.map((u) => [u.email, u.id]));

        await client.query(
            `DELETE FROM collaborators WHERE track_id = $1 AND (removed_by_writer = false OR id = ANY($2::uuid[]))`,
            [found[0].id, discardIds]
        );
        for (const c of data) {
            await client.query(
                `INSERT INTO collaborators (track_id, user_id, invited_email, legal_name, role, ownership_percent,
                                            ipi, writer_status, publisher_name, is_self_published)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [found[0].id, c.email ? idByEmail.get(c.email) || null : null, c.email, c.legalName, c.role, c.percent,
                 c.ipi, c.writerStatus, c.publisherName, c.isSelfPublished]
            );
        }

        await client.query(
            `UPDATE collaborator_notices
                SET status = 'cancelled', email = NULL, co_writer_name = NULL, consent_at = NULL
              WHERE track_id = $1 AND status IN ('pending','confirmed','disputed')
                AND NOT (email_hash = ANY($2::text[]))`,
            [found[0].id, emails.map(emailHash)]
        );
        
        await client.query('UPDATE releases SET unconfirmed_acknowledged_at = NULL WHERE id = $1', [req.params.releaseId]);

        const { rows } = await client.query(
            `SELECT ${COLLAB_COLS} FROM collaborators WHERE track_id = $1
             ORDER BY removed_by_writer, ownership_percent DESC, created_at`,
            [found[0].id]
        );
        await client.query('COMMIT');
        return res.json({ collaborators: rows });
    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Each person can only appear once per track.' });
        }
        if (err.code === '23503') {
            return res.status(409).json({ error: 'Splits on a disputed track cannot be changed.' });
        }
        console.error('replaceCollaborators error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
}

async function listSharedTracks(req, res) {
    try {
        await claimInvites(req.user);
        const { rows } = await pool.query(
            `SELECT t.id, t.title, t.track_number, t.isrc, t.iswc,
                    r.id AS release_id, r.title AS release_title, r.album_artist,
                    r.release_date::text AS release_date,
                    u.artist_name AS owner_artist_name,
                    c.role, c.ownership_percent
             FROM collaborators c
             JOIN tracks t   ON t.id = c.track_id
             JOIN releases r ON r.id = t.release_id
             JOIN users u    ON u.id = r.owner_id
             WHERE c.user_id = $1 AND r.status = 'ready'
             ORDER BY r.release_date DESC, t.track_number`,
            [req.user.id]
        );
        return res.json({ tracks: rows });
    } catch (err) {
        console.error('listSharedTracks error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function getSharedTrack(req, res) {
    try {
        await claimInvites(req.user);
        const { rows } = await pool.query(
            `SELECT t.id, t.title, t.composition_title, t.artist_name, t.track_number, t.isrc, t.iswc,
                    t.duration_seconds, t.explicit,
                    r.id AS release_id, r.title AS release_title, r.album_artist,
                    r.release_date::text AS release_date,
                    u.artist_name AS owner_artist_name
             FROM tracks t
             JOIN releases r ON r.id = t.release_id
             JOIN users u    ON u.id = r.owner_id
             WHERE t.id = $1 AND r.status = 'ready'
               AND EXISTS (SELECT 1 FROM collaborators c WHERE c.track_id = t.id AND c.user_id = $2)`,
            [req.params.trackId, req.user.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Track not found.' });

        const splits = await pool.query(
            `SELECT legal_name, role, ownership_percent, COALESCE(user_id = $2, false) AS is_you
             FROM collaborators WHERE track_id = $1
             ORDER BY ownership_percent DESC, created_at`,
            [req.params.trackId, req.user.id]
        );
        return res.json({ track: rows[0], splits: splits.rows });
    } catch (err) {
        console.error('getSharedTrack error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = { listCollaborators, replaceCollaborators, listSharedTracks, getSharedTrack };