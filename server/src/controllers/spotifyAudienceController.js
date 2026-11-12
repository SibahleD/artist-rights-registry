const pool = require('../db/pool');
const { parseAudience, COLUMNS } = require('../lib/spotifyAudience');

const fail = (res, err, label) => { console.error(`${label} error:`, err); return res.status(500).json({ error: 'Internal server error' }); };

// POST /api/spotify-audience  { fileName?, rows: [{ date, listeners, monthly_listeners, ... }] }
async function importAudience(req, res) {
    const p = parseAudience(req.body);
    if (p.error) return res.status(400).json({ error: p.error });
    if (p.rows.length === 0) {
        return res.status(400).json({ error: 'There is no activity in this file yet, so there is nothing to import.', details: p.skipped.map((s) => `Row ${s.row}: ${s.reason}`) });
    }
    try {
        await pool.query(
            `INSERT INTO spotify_audience_daily (user_id, day, ${COLUMNS.join(', ')}, file_name)
             SELECT $1::uuid, t.day, t.listeners, t.monthly_listeners, t.monthly_active_listeners, t.super_listeners,
                    t.streams, t.playlist_adds, t.saves, t.followers, $2
             FROM unnest($3::date[], $4::int[], $5::int[], $6::int[], $7::int[], $8::int[], $9::int[], $10::int[], $11::int[])
                  AS t(day, listeners, monthly_listeners, monthly_active_listeners, super_listeners, streams, playlist_adds, saves, followers)
             ON CONFLICT (user_id, day) DO UPDATE SET
                 ${COLUMNS.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}, file_name = EXCLUDED.file_name, imported_at = now()`,
            [req.user.id, p.fileName, p.rows.map((r) => r.day), ...COLUMNS.map((c) => p.rows.map((r) => r[c]))]);
        return res.status(201).json({
            saved: p.rows.length, trimmed: p.trimmed, skipped: p.skipped, skipped_count: p.skippedCount,
            first_day: p.rows[0].day, last_day: p.rows[p.rows.length - 1].day,
        });
    } catch (err) { return fail(res, err, 'importAudience'); }
}

// GET /api/spotify-audience  -> every saved day, oldest first, plus when it was last imported.
async function getAudience(req, res) {
    try {
        const { rows } = await pool.query(
            `SELECT to_char(day, 'YYYY-MM-DD') AS day, ${COLUMNS.join(', ')}
             FROM spotify_audience_daily WHERE user_id = $1 ORDER BY day`, [req.user.id]);
        const { rows: [meta] } = await pool.query(
            `SELECT max(imported_at) AS imported_at,
                    (array_agg(file_name ORDER BY imported_at DESC))[1] AS file_name
             FROM spotify_audience_daily WHERE user_id = $1`, [req.user.id]);
        return res.json({ days: rows, imported_at: meta.imported_at, file_name: meta.file_name });
    } catch (err) { return fail(res, err, 'getAudience'); }
}

// DELETE /api/spotify-audience
async function clearAudience(req, res) {
    try {
        const r = await pool.query('DELETE FROM spotify_audience_daily WHERE user_id = $1', [req.user.id]);
        return res.json({ removed: r.rowCount });
    } catch (err) { return fail(res, err, 'clearAudience'); }
}

module.exports = { importAudience, getAudience, clearAudience };
