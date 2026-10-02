const pool = require('../db/pool');

const RELEASE_COLUMNS = `id, owner_id, title, release_type, album_artist, genre,
    creation_date::text AS creation_date, release_date::text AS release_date,
    upc, p_line, c_line, status, created_at, ready_at`;
const RELEASE_TYPES = ['single', 'ep', 'album'];

function requiredText(label, max) {
    return (v) => {
        if (typeof v !== 'string' || !v.trim()) return { error: `${label} cannot be empty.` };
        if (v.trim().length > max) return { error: `${label} must be at most ${max} characters.` };
        return { value: v.trim() };
    };
}

function optionalText(label, max) {
    return (v) => {
        if (v === null || v === '') return { value: null };
        if (typeof v !== 'string') return { error: `${label} must be a string.` };
        const t = v.trim();
        if (t.length > max) return { error: `${label} must be at most ${max} characters.` };
        return { value: t || null };
    };
}

function oneOf(label, allowed) {
    return (v) =>
        allowed.includes(v) ? { value: v } : { error: `${label} must be one of: ${allowed.join(', ')}.` };
}

function optionalDate(label) {
    return (v) => {
        if (v === null || v === '') return { value: null };
        const bad = { error: `${label} must be a valid date (YYYY-MM-DD).` };
        if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return bad;
        const d = new Date(`${v}T00:00:00Z`);
        if (isNaN(d) || d.toISOString().slice(0, 10) !== v) return bad;
        return { value: v };
    };
}

function optionalUpc(v) {
    if (v === null || v === '') return { value: null };
    if (typeof v !== 'string' || !/^[0-9]{12,13}$/.test(v.trim())) {
        return { error: 'UPC must be 12 or 13 digits.' };
    }
    return { value: v.trim() };
}

const FIELDS = {
    title:       { column: 'title',        validate: requiredText('Title', 200) },
    releaseType: { column: 'release_type', validate: oneOf('Release type', RELEASE_TYPES) },
    albumArtist: { column: 'album_artist', validate: requiredText('Album artist', 200) },
    genre:       { column: 'genre',        validate: optionalText('Genre', 100) },
    releaseDate: { column: 'release_date', validate: optionalDate('Release date') },
    upc:         { column: 'upc',          validate: optionalUpc },
    pLine:       { column: 'p_line',       validate: optionalText('P line', 200) },
    cLine:       { column: 'c_line',       validate: optionalText('C line', 200) },
};

function parseBody(body) {
    const data = {};
    for (const [key, { column, validate }] of Object.entries(FIELDS)) {
        if (!(key in body)) continue;
        const result = validate(body[key]);
        if (result.error) return { error: result.error };
        data[column] = result.value;
    }
    return { data };
}

async function findOwned(id, ownerId) {
    const { rows } = await pool.query(
        `SELECT ${RELEASE_COLUMNS} FROM releases WHERE id = $1 AND owner_id = $2`,
        [id, ownerId]
    );
    return rows[0];
}

async function readinessProblems(release) {
    const problems = [];
    if (!release.release_date) problems.push('Release date is required.');

    const { rows } = await pool.query(
        `SELECT t.track_number, t.title, (a.track_id IS NOT NULL) AS has_audio,
                (SELECT COALESCE(SUM(c.ownership_percent), 0) FROM collaborators c WHERE c.track_id = t.id) AS split_total
         FROM tracks t
         LEFT JOIN audio_specs a ON a.track_id = t.id
         WHERE t.release_id = $1
         ORDER BY t.track_number`,
        [release.id]
    );
    if (rows.length === 0) problems.push('At least one track is required.');
    for (const r of rows) {
        if (!r.has_audio) problems.push(`Track ${r.track_number} ("${r.title}") has no audio file.`);
        if (Math.round(Number(r.split_total) * 100) !== 10000) {
            problems.push(`Track ${r.track_number} ("${r.title}") splits must total 100% (currently ${Number(r.split_total)}%).`);
        }
    }
    return problems;
}


async function createRelease(req, res) {
    const { data, error } = parseBody(req.body);
    if (error) return res.status(400).json({ error });
    if (!('title' in data)) return res.status(400).json({ error: 'Title is required.' });
    if (!('album_artist' in data)) data.album_artist = req.user.artistName;

    const columns = ['owner_id', ...Object.keys(data)];
    const values = [req.user.id, ...Object.values(data)];
    const placeholders = values.map((_, i) => `$${i + 1}`);

    try {
        const { rows } = await pool.query(
            `INSERT INTO releases (${columns.join(', ')})
             VALUES (${placeholders.join(', ')})
             RETURNING ${RELEASE_COLUMNS}`,
            values
        );
        return res.status(201).json({ release: rows[0] });
    } catch (err) {
        console.error('createRelease error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function listReleases(req, res) {
    const { status } = req.query;
    if (status !== undefined && !['draft', 'ready'].includes(status)) {
        return res.status(400).json({ error: 'Status must be draft or ready.' });
    }

    const values = [req.user.id];
    let where = 'owner_id = $1';
    if (status) {
        values.push(status);
        where += ' AND status = $2';
    }

    try {
        const { rows } = await pool.query(
            `SELECT ${RELEASE_COLUMNS},
                    (SELECT count(*)::int FROM tracks t WHERE t.release_id = releases.id) AS track_count
             FROM releases
             WHERE ${where}
             ORDER BY created_at DESC`,
            values
        );
        return res.json({ releases: rows });
    } catch (err) {
        console.error('listReleases error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function getRelease(req, res) {
    try {
        const release = await findOwned(req.params.id, req.user.id);
        if (!release) return res.status(404).json({ error: 'Release not found.' });

        const tracks = await pool.query(
            `SELECT id, track_number, title, artist_name, isrc, duration_seconds, explicit
             FROM tracks WHERE release_id = $1 ORDER BY track_number`,
            [release.id]
        );
        return res.json({ release, tracks: tracks.rows });
    } catch (err) {
        console.error('getRelease error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function updateRelease(req, res) {
    const { data, error } = parseBody(req.body);
    if (error) return res.status(400).json({ error });
    if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'No updatable fields provided.' });
    }

    try {
        const existing = await findOwned(req.params.id, req.user.id);
        if (!existing) return res.status(404).json({ error: 'Release not found.' });
        if (existing.status !== 'draft') {
            return res.status(409).json({ error: 'Ready releases are locked. Revert to draft to edit.' });
        }

        const columns = Object.keys(data);
        const values = [...Object.values(data), existing.id, req.user.id];
        const sets = columns.map((c, i) => `${c} = $${i + 1}`);

        const { rows } = await pool.query(
            `UPDATE releases SET ${sets.join(', ')}
             WHERE id = $${columns.length + 1} AND owner_id = $${columns.length + 2}
             RETURNING ${RELEASE_COLUMNS}`,
            values
        );
        return res.json({ release: rows[0] });
    } catch (err) {
        console.error('updateRelease error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function markReady(req, res) {
    try {
        const release = await findOwned(req.params.id, req.user.id);
        if (!release) return res.status(404).json({ error: 'Release not found.' });
        if (release.status === 'ready') {
            return res.status(409).json({ error: 'Release is already ready.' });
        }

        const problems = await readinessProblems(release);
        if (problems.length > 0) {
            return res.status(400).json({ error: 'Release is not ready.', problems });
        }

        const { rows } = await pool.query(
            `UPDATE releases SET status = 'ready', ready_at = now()
             WHERE id = $1 AND owner_id = $2
             RETURNING ${RELEASE_COLUMNS}`,
            [release.id, req.user.id]
        );
        return res.json({ release: rows[0] });
    } catch (err) {
        console.error('markReady error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function revertToDraft(req, res) {
    try {
        const release = await findOwned(req.params.id, req.user.id);
        if (!release) return res.status(404).json({ error: 'Release not found.' });
        if (release.status === 'draft') {
            return res.status(409).json({ error: 'Release is already a draft.' });
        }

        const disputed = await pool.query(
            `SELECT 1 FROM disputes d JOIN tracks t ON t.id = d.track_id WHERE t.release_id = $1 LIMIT 1`,
            [release.id]
        );
        if (disputed.rowCount > 0) {
            return res.status(409).json({ error: 'Ownership cannot be reverted once a dispute has been raised on this release.' });
        }

        const { rows } = await pool.query(
            `UPDATE releases SET status = 'draft', ready_at = NULL
             WHERE id = $1 AND owner_id = $2
             RETURNING ${RELEASE_COLUMNS}`,
            [release.id, req.user.id]
        );
        return res.json({ release: rows[0] });
    } catch (err) {
        console.error('revertToDraft error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function deleteRelease(req, res) {
    try {
        const release = await findOwned(req.params.id, req.user.id);
        if (!release) return res.status(404).json({ error: 'Release not found.' });
        if (release.status !== 'draft') {
            return res.status(409).json({ error: 'Only draft releases can be deleted. Revert to draft first.' });
        }

        await pool.query('DELETE FROM releases WHERE id = $1 AND owner_id = $2', [release.id, req.user.id]);
        return res.status(204).end();
    } catch (err) {
        if (err.code === '23503') { 
            return res.status(409).json({ error: 'Release has tracks with disputes and cannot be deleted.' });
        }
        console.error('deleteRelease error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    createRelease, listReleases, getRelease, updateRelease,
    markReady, revertToDraft, deleteRelease,
};