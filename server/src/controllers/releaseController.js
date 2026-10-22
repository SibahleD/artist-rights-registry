const pool = require('../db/pool');
const limits = require('../limits');
const storage = require('../services/storage');

const RELEASE_COLUMNS = `id, owner_id, title, release_type, album_artist, genre,
    creation_date::text AS creation_date, release_date::text AS release_date,
    upc, p_line, c_line, label_name, language, status, created_at, ready_at, released_at, unconfirmed_acknowledged_at,
    (SELECT m.id FROM media m WHERE m.release_id = releases.id AND m.kind = 'artwork') AS artwork_id`;
const { readinessChecks, readinessProblems, errorsOf } = require('../services/readiness');
const { buildExport } = require('../services/exportRelease');
const { setReleased, clearReleased, listLinks } = require('../services/lifecycle');
const { optionalLanguage } = require('../lib/codes');
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
    labelName:   { column: 'label_name',   validate: optionalText('Label name', 200) },
    language:    { column: 'language',     validate: optionalLanguage('Language') },
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

// The same checks markReady runs, without trying to mark anything ready.
async function getReadiness(req, res) {
    try {
        const release = await findOwned(req.params.id, req.user.id);
        if (!release) return res.status(404).json({ error: 'Release not found.' });
        const checks = await readinessChecks(release);
        const canMarkReady = errorsOf(checks).length === 0;
        return res.json({ status: release.status, canMarkReady, checks });
    } catch (err) {
        console.error('getReadiness error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// One whitelisted document with the whole release. No internal ids and no co-writer emails.
async function exportRelease(req, res) {
    try {
        const release = await findOwned(req.params.id, req.user.id);
        if (!release) return res.status(404).json({ error: 'Release not found.' });
        return res.json(await buildExport(release));
    } catch (err) {
        console.error('exportRelease error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
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
             SELECT ${placeholders.join(', ')}
             WHERE (SELECT count(*) FROM releases WHERE owner_id = $1) < $${values.length + 1}
             RETURNING ${RELEASE_COLUMNS}`,
            [...values, limits.enabled ? limits.maxReleasesPerUser : 1e9]
        );
        if (rows.length === 0) {
            return res.status(409).json({ error: `You've reached the test limit of ${limits.maxReleasesPerUser} releases. Delete a draft you no longer need to add another.` });
        }
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
                    (SELECT count(*)::int FROM tracks t WHERE t.release_id = releases.id) AS track_count,
                    (SELECT count(*)::int FROM collaborator_notices n JOIN tracks t ON t.id = n.track_id
                      WHERE t.release_id = releases.id AND n.status IN ('pending', 'disputed')
                        AND NOT (n.status = 'pending' AND n.expires_at < now())) AS pending_notices,
                    (SELECT count(*)::int FROM release_links l WHERE l.release_id = releases.id) AS link_count
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
        return res.json({ release, tracks: tracks.rows, links: await listLinks(release.id) });
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

        const checks = await readinessChecks(release);
        const problems = errorsOf(checks);
        if (problems.length > 0) {
            return res.status(400).json({ error: 'Release is not ready.', problems, checks });
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

// Owner marks a ready release as live on the stores, with at least one link.
async function markReleased(req, res) {
    try {
        const release = await findOwned(req.params.id, req.user.id);
        if (!release) return res.status(404).json({ error: 'Release not found.' });
        const result = await setReleased(release.id, req.body?.links);
        if (!result.ok) return res.status(result.status).json({ error: result.error });
        return res.json({ released_at: result.released_at, links: result.links });
    } catch (err) {
        console.error('markReleased error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function unmarkReleased(req, res) {
    try {
        const release = await findOwned(req.params.id, req.user.id);
        if (!release) return res.status(404).json({ error: 'Release not found.' });
        const result = await clearReleased(release.id);
        if (!result.ok) return res.status(result.status).json({ error: result.error });
        return res.status(204).end();
    } catch (err) {
        console.error('unmarkReleased error:', err);
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

        if (release.released_at) {
            return res.status(409).json({ error: 'This release is marked as released and is locked. Mark it as not released first if you need to change it.' });
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

        // Remember the stored audio files, so they can be removed once the rows are gone.
        const keys = (await pool.query(
            `SELECT f.storage_key FROM audio_files f JOIN tracks t ON t.id = f.track_id WHERE t.release_id = $1`,
            [release.id]
        )).rows.map((r) => r.storage_key);

        await pool.query('DELETE FROM releases WHERE id = $1 AND owner_id = $2', [release.id, req.user.id]);
        await Promise.all(keys.map((k) => storage.delete(k)));
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
    markReady, revertToDraft, deleteRelease, readinessProblems, getReadiness, exportRelease,
    markReleased, unmarkReleased,
};