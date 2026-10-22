const pool = require('../db/pool');

const STATUSES = ['understood', 'learning'];
const TERM_RE = /^[a-z0-9-]{1,64}$/;
const MAX_TERMS = 500; // far more than the glossary holds; stops a client filling the table with junk ids

const fail = (res, e, label) => { console.error(`${label} error:`, e); return res.status(500).json({ error: 'Internal server error' }); };

// { progress: { isrc: 'understood', upc: 'learning', ... } }
async function listProgress(req, res) {
    try {
        const { rows } = await pool.query('SELECT term_id, status FROM glossary_progress WHERE user_id = $1', [req.user.id]);
        return res.json({ progress: Object.fromEntries(rows.map((r) => [r.term_id, r.status])) });
    } catch (e) { return fail(res, e, 'listProgress'); }
}

// Body { status: 'understood' | 'learning' | null }. null clears the mark.
async function setProgress(req, res) {
    const { termId } = req.params;
    const status = req.body?.status;
    if (!TERM_RE.test(termId)) return res.status(404).json({ error: 'Term not found.' });
    if (status !== null && !STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Status must be "understood", "learning" or null.' });
    }
    try {
        if (status === null) {
            await pool.query('DELETE FROM glossary_progress WHERE user_id = $1 AND term_id = $2', [req.user.id, termId]);
            return res.json({ term_id: termId, status: null });
        }
        const { rows: [{ n }] } = await pool.query(
            'SELECT count(*)::int AS n FROM glossary_progress WHERE user_id = $1 AND term_id <> $2', [req.user.id, termId]);
        if (n >= MAX_TERMS) return res.status(400).json({ error: 'Too many terms are marked already.' });
        await pool.query(
            `INSERT INTO glossary_progress (user_id, term_id, status) VALUES ($1, $2, $3)
             ON CONFLICT (user_id, term_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now()`,
            [req.user.id, termId, status]);
        return res.json({ term_id: termId, status });
    } catch (e) { return fail(res, e, 'setProgress'); }
}

module.exports = { listProgress, setProgress };
