const pool = require('../db/pool');
const { parseImport, normalizePeriod } = require('../lib/streams');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_STAT_ROWS = 50000;
const fail = (res, err, label) => { console.error(`${label} error:`, err); return res.status(500).json({ error: 'Internal server error' }); };

// POST /api/streams/imports  { source, platform?, fileName?, rows: [{ isrc, platform, period, streams }] }
async function importStreams(req, res) {
    const parsed = parseImport(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    if (parsed.rows.length === 0) {
        return res.status(400).json({ error: 'None of the rows could be imported.', details: parsed.skipped.map((s) => `Row ${s.row}: ${s.reason}`) });
    }
    const source = req.body.source === 'manual' ? 'manual' : 'csv';

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows: [imp] } = await client.query(
            `INSERT INTO stream_imports (user_id, source, platform, file_name, rows_read, rows_saved, rows_skipped)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, source, platform, file_name, rows_read, rows_saved, rows_skipped, created_at`,
            [req.user.id, source, parsed.platform, parsed.fileName, parsed.read, parsed.rows.length, parsed.skippedCount]);
        await client.query(
            `INSERT INTO stream_stats (user_id, isrc, platform, period, streams, import_id)
             SELECT $1::uuid, isrc, platform, period, streams, $6::uuid
             FROM unnest($2::text[], $3::text[], $4::date[], $5::bigint[]) AS t(isrc, platform, period, streams)
             ON CONFLICT (user_id, isrc, platform, period)
             DO UPDATE SET streams = EXCLUDED.streams, import_id = EXCLUDED.import_id, updated_at = now()`,
            [req.user.id,
             parsed.rows.map((r) => r.isrc), parsed.rows.map((r) => r.platform),
             parsed.rows.map((r) => r.period), parsed.rows.map((r) => String(r.streams)), imp.id]);
        await client.query('COMMIT');

        const { rows: [{ n }] } = await pool.query(
            `SELECT count(DISTINCT s) ::int AS n FROM unnest($2::text[]) AS s
             WHERE s NOT IN (SELECT t.isrc FROM tracks t JOIN releases r ON r.id = t.release_id
                             WHERE r.owner_id = $1 AND t.isrc IS NOT NULL)`,
            [req.user.id, parsed.rows.map((r) => r.isrc)]);
        return res.status(201).json({ import: imp, skipped: parsed.skipped, unmatched_isrcs: n });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        return fail(res, err, 'importStreams');
    } finally { client.release(); }
}

// GET /api/streams?from=YYYY-MM&to=YYYY-MM
async function getStreams(req, res) {
    const from = req.query.from ? normalizePeriod(String(req.query.from), new Date(8.64e15)) : null;
    const to = req.query.to ? normalizePeriod(String(req.query.to), new Date(8.64e15)) : null;
    if ((req.query.from && !from) || (req.query.to && !to)) return res.status(400).json({ error: 'Dates must look like 2026-09.' });
    try {
        const uid = req.user.id;
        const [stats, tracks, span] = await Promise.all([
            pool.query(
                `SELECT isrc, platform, to_char(period, 'YYYY-MM-DD') AS period, streams::float8 AS streams
                 FROM stream_stats
                 WHERE user_id = $1 AND ($2::date IS NULL OR period >= $2) AND ($3::date IS NULL OR period <= $3)
                 ORDER BY period, isrc, platform LIMIT ${MAX_STAT_ROWS + 1}`, [uid, from, to]),
            pool.query(
                `SELECT t.id, t.title, t.isrc, t.track_number, r.id AS release_id, r.title AS release_title, r.release_type,
                        (SELECT m.id FROM media m WHERE m.release_id = r.id AND m.kind = 'artwork') AS artwork_id
                 FROM tracks t JOIN releases r ON r.id = t.release_id
                 WHERE r.owner_id = $1 ORDER BY r.title, t.track_number`, [uid]),
            pool.query(
                `SELECT to_char(min(period), 'YYYY-MM-DD') AS first, to_char(max(period), 'YYYY-MM-DD') AS last
                 FROM stream_stats WHERE user_id = $1`, [uid]),
        ]);
        if (stats.rows.length > MAX_STAT_ROWS) return res.status(413).json({ error: 'That range has too many figures. Choose a shorter date range.' });
        return res.json({ stats: stats.rows, tracks: tracks.rows, first_period: span.rows[0].first, last_period: span.rows[0].last });
    } catch (err) { return fail(res, err, 'getStreams'); }
}

async function listImports(req, res) {
    try {
        const { rows } = await pool.query(
            `SELECT id, source, platform, file_name, rows_read, rows_saved, rows_skipped, created_at
             FROM stream_imports WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [req.user.id]);
        return res.json({ imports: rows });
    } catch (err) { return fail(res, err, 'listImports'); }
}

// Removes the figures this import last set, and its log entry. A figure that a later import replaced stays.
async function deleteImport(req, res) {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Import not found.' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const found = await client.query('SELECT 1 FROM stream_imports WHERE id = $1 AND user_id = $2 FOR UPDATE', [id, req.user.id]);
        if (!found.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Import not found.' }); }
        const gone = await client.query('DELETE FROM stream_stats WHERE import_id = $1 AND user_id = $2', [id, req.user.id]);
        await client.query('DELETE FROM stream_imports WHERE id = $1 AND user_id = $2', [id, req.user.id]);
        await client.query('COMMIT');
        return res.json({ removed: gone.rowCount });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        return fail(res, err, 'deleteImport');
    } finally { client.release(); }
}

module.exports = { importStreams, getStreams, listImports, deleteImport };
