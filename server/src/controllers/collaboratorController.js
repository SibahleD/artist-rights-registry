const pool = require('../db/pool');

const ROLES = ['composer', 'songwriter', 'publisher', 'producer', 'performer', 'other'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCollaborators(body) {
    const list = body && body.collaborators;
    if (!Array.isArray(list) || list.length === 0 || list.length > 50) {
        return { error: 'collaborators must be a list of 1 to 50 entries.' };
    }

    const data = [];
    const seenEmails = new Set();
    const seenNames = new Set();
    let totalCents = 0;

    for (const [i, c] of list.entries()) {
        const n = i + 1;
        if (!c || typeof c !== 'object') return { error: `Collaborator ${n} is invalid.` };

        const legalName = typeof c.legalName === 'string' ? c.legalName.trim() : '';
        if (!legalName || legalName.length > 200) {
            return { error: `Collaborator ${n}: legal name is required (max 200 characters).` };
        }

        const role = c.role === undefined ? 'songwriter' : c.role;
        if (!ROLES.includes(role)) {
            return { error: `Collaborator ${n}: role must be one of: ${ROLES.join(', ')}.` };
        }

        const pct = c.ownershipPercent;
        if (typeof pct !== 'number' || !Number.isFinite(pct) || pct < 0 || pct > 100) {
            return { error: `Collaborator ${n}: ownership percent must be a number between 0 and 100.` };
        }
        const cents = Math.round(pct * 100);
        if (Math.abs(pct * 100 - cents) > 1e-6) {
            return { error: `Collaborator ${n}: ownership percent can have at most 2 decimals.` };
        }

        let email = null;
        if (c.invitedEmail !== undefined && c.invitedEmail !== null && c.invitedEmail !== '') {
            email = typeof c.invitedEmail === 'string' ? c.invitedEmail.trim().toLowerCase() : '';
            if (!EMAIL_RE.test(email) || email.length > 254) {
                return { error: `Collaborator ${n}: invalid email.` };
            }
        }

        const nameKey = legalName.toLowerCase();
        if (seenNames.has(nameKey) || (email && seenEmails.has(email))) {
            return { error: `Collaborator ${n}: each person can only appear once per track. Combine their share into one entry.` };
        }
        seenNames.add(nameKey);
        if (email) seenEmails.add(email);

        totalCents += cents;
        data.push({ legalName, role, percent: cents / 100, email });
    }

    if (totalCents !== 10000) {
        return { error: `Splits must total exactly 100% (currently ${totalCents / 100}%).` };
    }
    return { data };
}

async function claimInvites(user) {
    await pool.query(
        `UPDATE collaborators c SET user_id = $1
         WHERE c.user_id IS NULL AND c.invited_email = $2
           AND NOT EXISTS (SELECT 1 FROM collaborators o
                           WHERE o.track_id = c.track_id AND o.user_id = $1)`,
        [user.id, user.email]
    );
}

const COLLAB_COLS = 'id, track_id, user_id, invited_email, legal_name, role, ownership_percent, created_at';

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
    const { data, error } = parseCollaborators(req.body);
    if (error) return res.status(400).json({ error });

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

        const emails = data.map((c) => c.email).filter(Boolean);
        const users = emails.length
            ? await client.query('SELECT id, email FROM users WHERE email = ANY($1) AND deleted_at IS NULL', [emails])
            : { rows: [] };
        const idByEmail = new Map(users.rows.map((u) => [u.email, u.id]));

        await client.query('DELETE FROM collaborators WHERE track_id = $1', [found[0].id]);
        for (const c of data) {
            await client.query(
                `INSERT INTO collaborators (track_id, user_id, invited_email, legal_name, role, ownership_percent)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [found[0].id, c.email ? idByEmail.get(c.email) || null : null, c.email, c.legalName, c.role, c.percent]
            );
        }

        const { rows } = await client.query(
            `SELECT ${COLLAB_COLS} FROM collaborators WHERE track_id = $1
             ORDER BY ownership_percent DESC, created_at`,
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
