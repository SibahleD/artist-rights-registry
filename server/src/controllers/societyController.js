const pool = require('../db/pool');
const limits = require('../limits');
const { parseSocietyInput } = require('../lib/societies');

const COLS = `id, body_name, country, status, to_char(registered_on, 'YYYY-MM-DD') AS registered_on, member_ref`;
const ORDER = `ORDER BY CASE status WHEN 'registered' THEN 0 WHEN 'applied' THEN 1 ELSE 2 END, lower(body_name), id`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (res, err, label) => { console.error(`${label} error:`, err); return res.status(500).json({ error: 'Internal server error' }); };

async function listSocieties(req, res) {
    try {
        const { rows } = await pool.query(`SELECT ${COLS} FROM user_societies WHERE user_id = $1 ${ORDER}`, [req.user.id]);
        return res.json({ societies: rows });
    } catch (err) { return fail(res, err, 'listSocieties'); }
}

async function createSociety(req, res) {
    const parsed = parseSocietyInput(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const s = parsed.society;
    try {
        const max = limits.enabled ? limits.maxSocieties : 1000;
        const { rows: [{ n }] } = await pool.query('SELECT count(*)::int AS n FROM user_societies WHERE user_id = $1', [req.user.id]);
        if (n >= max) return res.status(409).json({ error: `You can track at most ${max} societies.` });
        const { rows } = await pool.query(
            `INSERT INTO user_societies (user_id, body_name, country, status, registered_on, member_ref)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLS}`,
            [req.user.id, s.body_name, s.country, s.status, s.registered_on, s.member_ref]);
        return res.status(201).json({ society: rows[0] });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'You are already tracking that society.' });
        return fail(res, err, 'createSociety');
    }
}

async function updateSociety(req, res) {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Society not found.' });
    try {
        const { rows: found } = await pool.query(`SELECT ${COLS} FROM user_societies WHERE id = $1 AND user_id = $2`, [id, req.user.id]);
        if (!found[0]) return res.status(404).json({ error: 'Society not found.' });
        const parsed = parseSocietyInput(req.body, found[0]);
        if (parsed.error) return res.status(400).json({ error: parsed.error });
        const s = parsed.society;
        const { rows } = await pool.query(
            `UPDATE user_societies SET status = $1, registered_on = $2, member_ref = $3, updated_at = now()
             WHERE id = $4 AND user_id = $5 RETURNING ${COLS}`,
            [s.status, s.registered_on, s.member_ref, id, req.user.id]);
        return res.json({ society: rows[0] });
    } catch (err) { return fail(res, err, 'updateSociety'); }
}

async function deleteSociety(req, res) {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Society not found.' });
    try {
        const result = await pool.query('DELETE FROM user_societies WHERE id = $1 AND user_id = $2', [id, req.user.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Society not found.' });
        return res.status(204).end();
    } catch (err) { return fail(res, err, 'deleteSociety'); }
}

module.exports = { listSocieties, createSociety, updateSociety, deleteSociety };
