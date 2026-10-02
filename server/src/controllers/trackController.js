const pool = require('../db/pool');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPLICIT_VALUES = ['explicit', 'not_explicit', 'cleaned'];
const AUDIO_FORMATS = ['mp3', 'flac', 'wav', 'aac', 'other'];

const TRACK_COLS = [
    'id', 'release_id', 'track_number', 'title', 'composition_title', 'artist_name', 'genre',
    'isrc', 'iswc', 'duration_seconds', 'explicit',
    'composition_copyright_year', 'composition_copyright',
    'recording_copyright_year', 'recording_copyright', 'created_at',
];
const PLAIN = TRACK_COLS.join(', ');
const ALIASED = TRACK_COLS.map((c) => `t.${c}`).join(', ');

const TRACK_WITH_AUDIO = `
    SELECT ${ALIASED},
           CASE WHEN a.track_id IS NULL THEN NULL ELSE to_jsonb(a) - 'track_id' END AS audio
    FROM tracks t
    LEFT JOIN audio_specs a ON a.track_id = t.id`;

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

function optionalInt(label, min, max) {
    return (v) => {
        if (v === null || v === '') return { value: null };
        if (!Number.isInteger(v) || v < min || v > max) {
            return { error: `${label} must be a whole number between ${min} and ${max}.` };
        }
        return { value: v };
    };
}

function optionalIsrc(v) {
    if (v === null || v === '') return { value: null };
    const s = typeof v === 'string' ? v.trim().toUpperCase().replace(/-/g, '') : '';
    if (!/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(s)) {
        return { error: 'ISRC must look like USABC2400001 (12 characters).' };
    }
    return { value: s };
}

function optionalIswc(v) {
    if (v === null || v === '') return { value: null };
    const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
    if (!/^T-[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]$/.test(s)) {
        return { error: 'ISWC must look like T-123.456.789-0.' };
    }
    return { value: s };
}

function optionalExplicit(v) {
    if (v === null || v === '') return { value: null };
    return EXPLICIT_VALUES.includes(v)
        ? { value: v }
        : { error: `Explicit must be one of: ${EXPLICIT_VALUES.join(', ')}.` };
}

const FIELDS = {
    title:                    { column: 'title',                      validate: requiredText('Title', 200) },
    compositionTitle:         { column: 'composition_title',          validate: optionalText('Composition title', 200) },
    artistName:               { column: 'artist_name',                validate: optionalText('Artist name', 200) },
    genre:                    { column: 'genre',                      validate: optionalText('Genre', 100) },
    isrc:                     { column: 'isrc',                       validate: optionalIsrc },
    iswc:                     { column: 'iswc',                       validate: optionalIswc },
    durationSeconds:          { column: 'duration_seconds',           validate: optionalInt('Duration', 1, 86400) },
    explicit:                 { column: 'explicit',                   validate: optionalExplicit },
    compositionCopyrightYear: { column: 'composition_copyright_year', validate: optionalInt('Composition copyright year', 1900, 2100) },
    compositionCopyright:     { column: 'composition_copyright',      validate: optionalText('Composition copyright', 200) },
    recordingCopyrightYear:   { column: 'recording_copyright_year',   validate: optionalInt('Recording copyright year', 1900, 2100) },
    recordingCopyright:       { column: 'recording_copyright',        validate: optionalText('Recording copyright', 200) },
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

async function ownedRelease(req, res, { requireDraft }) {
    const { rows } = await pool.query(
        'SELECT id, status FROM releases WHERE id = $1 AND owner_id = $2',
        [req.params.releaseId, req.user.id]
    );
    const release = rows[0];
    if (!release) {
        res.status(404).json({ error: 'Release not found.' });
        return null;
    }
    if (requireDraft && release.status !== 'draft') {
        res.status(409).json({ error: 'Ready releases are locked. Revert to draft to edit.' });
        return null;
    }
    return release;
}

function handleDbError(err, res) {
    if (err.code === '23505') {
        if (err.constraint === 'uq_tracks_release_isrc') {
            res.status(409).json({ error: 'Another track on this release already uses that ISRC.' });
        } else {
            res.status(409).json({ error: 'Track numbering conflict. Please retry.' });
        }
        return true;
    }
    if (err.code === '23503') { 
        res.status(409).json({ error: 'This track has a dispute and cannot be deleted.' });
        return true;
    }
    return false;
}


async function createTrack(req, res) {
    const { data, error } = parseBody(req.body);
    if (error) return res.status(400).json({ error });
    if (!('title' in data)) return res.status(400).json({ error: 'Title is required.' });

    try {
        const release = await ownedRelease(req, res, { requireDraft: true });
        if (!release) return;

        const cols = Object.keys(data);
        const values = [release.id, ...Object.values(data)];
        const placeholders = cols.map((_, i) => `$${i + 2}`);

        const { rows } = await pool.query(
            `INSERT INTO tracks (release_id, track_number, ${cols.join(', ')})
             VALUES ($1,
                     (SELECT COALESCE(MAX(track_number), 0) + 1 FROM tracks WHERE release_id = $1),
                     ${placeholders.join(', ')})
             RETURNING ${PLAIN}`,
            values
        );
        return res.status(201).json({ track: { ...rows[0], audio: null } });
    } catch (err) {
        if (handleDbError(err, res)) return;
        console.error('createTrack error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function listTracks(req, res) {
    try {
        const release = await ownedRelease(req, res, { requireDraft: false });
        if (!release) return;

        const { rows } = await pool.query(
            `${TRACK_WITH_AUDIO} WHERE t.release_id = $1 ORDER BY t.track_number`,
            [release.id]
        );
        return res.json({ tracks: rows });
    } catch (err) {
        console.error('listTracks error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function getTrack(req, res) {
    try {
        const release = await ownedRelease(req, res, { requireDraft: false });
        if (!release) return;

        const { rows } = await pool.query(
            `${TRACK_WITH_AUDIO} WHERE t.id = $1 AND t.release_id = $2`,
            [req.params.trackId, release.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Track not found.' });
        return res.json({ track: rows[0] });
    } catch (err) {
        console.error('getTrack error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function updateTrack(req, res) {
    const { data, error } = parseBody(req.body);
    if (error) return res.status(400).json({ error });
    if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'No updatable fields provided.' });
    }

    try {
        const release = await ownedRelease(req, res, { requireDraft: true });
        if (!release) return;

        const cols = Object.keys(data);
        const values = [...Object.values(data), req.params.trackId, release.id];
        const sets = cols.map((c, i) => `${c} = $${i + 1}`);

        const result = await pool.query(
            `UPDATE tracks SET ${sets.join(', ')}
             WHERE id = $${cols.length + 1} AND release_id = $${cols.length + 2}
             RETURNING id`,
            values
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Track not found.' });

        const { rows } = await pool.query(`${TRACK_WITH_AUDIO} WHERE t.id = $1`, [req.params.trackId]);
        return res.json({ track: rows[0] });
    } catch (err) {
        if (handleDbError(err, res)) return;
        console.error('updateTrack error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function deleteTrack(req, res) {
    let client;
    try {
        const release = await ownedRelease(req, res, { requireDraft: true });
        if (!release) return;

        client = await pool.connect();
        await client.query('BEGIN');

        const del = await client.query('DELETE FROM tracks WHERE id = $1 AND release_id = $2', [
            req.params.trackId,
            release.id,
        ]);
        if (del.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Track not found.' });
        }

        await client.query(
            `UPDATE tracks t SET track_number = r.n
             FROM (SELECT id, row_number() OVER (ORDER BY track_number)::int AS n
                   FROM tracks WHERE release_id = $1) r
             WHERE t.id = r.id AND t.track_number <> r.n`,
            [release.id]
        );

        await client.query('COMMIT');
        return res.status(204).end();
    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        if (handleDbError(err, res)) return;
        console.error('deleteTrack error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
}

async function reorderTracks(req, res) {
    const ids = req.body.trackIds;
    if (
        !Array.isArray(ids) ||
        ids.length === 0 ||
        ids.some((id) => typeof id !== 'string' || !UUID_RE.test(id)) ||
        new Set(ids).size !== ids.length
    ) {
        return res.status(400).json({ error: 'trackIds must be a list of unique track ids.' });
    }

    let client;
    try {
        const release = await ownedRelease(req, res, { requireDraft: true });
        if (!release) return;

        client = await pool.connect();
        await client.query('BEGIN');

        const { rows } = await client.query(
            'SELECT id FROM tracks WHERE release_id = $1 FOR UPDATE',
            [release.id]
        );
        const existing = new Set(rows.map((r) => r.id));
        if (rows.length !== ids.length || !ids.every((id) => existing.has(id))) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'trackIds must include every track on this release exactly once.' });
        }

        await client.query(
            `UPDATE tracks t SET track_number = v.n
             FROM unnest($1::uuid[], $2::int[]) AS v(id, n)
             WHERE t.id = v.id`,
            [ids, ids.map((_, i) => i + 1)]
        );

        await client.query('COMMIT');

        const result = await pool.query(
            `${TRACK_WITH_AUDIO} WHERE t.release_id = $1 ORDER BY t.track_number`,
            [release.id]
        );
        return res.json({ tracks: result.rows });
    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        if (handleDbError(err, res)) return;
        console.error('reorderTracks error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
}

function parseAudio(body) {
    const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';
    if (!fileName || fileName.length > 255) {
        return { error: 'File name is required and must be at most 255 characters.' };
    }
    if (!AUDIO_FORMATS.includes(body.format)) {
        return { error: `Format must be one of: ${AUDIO_FORMATS.join(', ')}.` };
    }

    const bitrate = optionalInt('Bitrate', 1, 10000000)(body.bitrateKbps ?? null);
    const sampleRate = optionalInt('Sample rate', 1, 1000000)(body.sampleRateHz ?? null);
    const channels = optionalInt('Channels', 1, 64)(body.channels ?? null);
    const size = optionalInt('Size', 1, Number.MAX_SAFE_INTEGER)(body.sizeBytes ?? null);
    for (const r of [bitrate, sampleRate, channels, size]) {
        if (r.error) return { error: r.error };
    }

    return {
        data: [fileName, body.format, bitrate.value, sampleRate.value, channels.value, size.value],
    };
}

async function upsertAudio(req, res) {
    const { data, error } = parseAudio(req.body);
    if (error) return res.status(400).json({ error });

    try {
        const release = await ownedRelease(req, res, { requireDraft: true });
        if (!release) return;

        const track = await pool.query('SELECT id FROM tracks WHERE id = $1 AND release_id = $2', [
            req.params.trackId,
            release.id,
        ]);
        if (!track.rows[0]) return res.status(404).json({ error: 'Track not found.' });

        const { rows } = await pool.query(
            `INSERT INTO audio_specs
                 (track_id, file_name, format, bitrate_kbps, sample_rate_hz, channels, size_bytes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (track_id) DO UPDATE SET
                 file_name = EXCLUDED.file_name,
                 format = EXCLUDED.format,
                 bitrate_kbps = EXCLUDED.bitrate_kbps,
                 sample_rate_hz = EXCLUDED.sample_rate_hz,
                 channels = EXCLUDED.channels,
                 size_bytes = EXCLUDED.size_bytes,
                 recorded_at = now()
             RETURNING to_jsonb(audio_specs) - 'track_id' AS audio`,
            [req.params.trackId, ...data]
        );
        return res.json({ audio: rows[0].audio });
    } catch (err) {
        console.error('upsertAudio error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function deleteAudio(req, res) {
    try {
        const release = await ownedRelease(req, res, { requireDraft: true });
        if (!release) return;

        const result = await pool.query(
            `DELETE FROM audio_specs a USING tracks t
             WHERE a.track_id = t.id AND t.id = $1 AND t.release_id = $2`,
            [req.params.trackId, release.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Audio spec not found.' });
        return res.status(204).end();
    } catch (err) {
        console.error('deleteAudio error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    createTrack, listTracks, getTrack, updateTrack, deleteTrack, reorderTracks,
    upsertAudio, deleteAudio,
};