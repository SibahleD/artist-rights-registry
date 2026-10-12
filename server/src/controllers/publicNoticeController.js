const pool = require('../db/pool');
const { hashToken } = require('../services/tokens');

const TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/;
const CHOICES = ['confirm', 'dispute', 'remove', 'unrecognized'];
const NOT_VALID = { error: 'This link is not valid.' };

const isLive = (n) => !['removed', 'cancelled', 'expired'].includes(n.status)
    && !(n.status === 'pending' && new Date(n.expires_at) < new Date());

async function getNotice(req, res) {
    if (!TOKEN_RE.test(req.params.token)) return res.status(404).json(NOT_VALID);
    try {
        const { rows } = await pool.query(
            `SELECT n.status, n.role, n.share_percent, n.co_writer_name, n.expires_at,
                    t.title AS track_title, r.title AS release_title, u.artist_name
             FROM collaborator_notices n
             JOIN tracks t ON t.id = n.track_id JOIN releases r ON r.id = t.release_id
             JOIN users u ON u.id = r.owner_id
             WHERE n.token_hash = $1`,
            [hashToken(req.params.token)]
        );
        const n = rows[0];
        if (!n) return res.status(404).json(NOT_VALID);
        if (!isLive(n)) return res.json({ notice: { status: n.status === 'pending' ? 'expired' : n.status } });
        return res.json({ notice: {
            status: n.status, artist_name: n.artist_name, track_title: n.track_title,
            release_title: n.release_title, role: n.role, share_percent: n.share_percent,
            co_writer_name: n.co_writer_name,
        } });
    } catch (err) {
        console.error('getNotice error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function respond(req, res) {
    const choice = req.body?.choice;
    const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 1000) : '';
    if (!TOKEN_RE.test(req.params.token)) return res.status(404).json(NOT_VALID);
    if (!CHOICES.includes(choice)) return res.status(400).json({ error: 'Choose one of the options.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            `SELECT n.*, r.id AS release_id, r.status AS release_status
             FROM collaborator_notices n
             JOIN tracks t ON t.id = n.track_id JOIN releases r ON r.id = t.release_id
             WHERE n.token_hash = $1 FOR UPDATE OF n`,
            [hashToken(req.params.token)]
        );
        const n = rows[0];
        if (!n) { await client.query('ROLLBACK'); return res.status(404).json(NOT_VALID); }
        if (!isLive(n)) { await client.query('ROLLBACK'); return res.status(410).json({ error: 'This link is no longer active.' }); }

        let status;
        if (choice === 'confirm') {
            await client.query(
                `UPDATE collaborator_notices SET status = 'confirmed', consent_at = now(), responded_at = now(), note = NULL WHERE id = $1`,
                [n.id]);
            status = 'confirmed';
        } else if (choice === 'dispute') {
            await client.query(
                `UPDATE collaborator_notices SET status = 'disputed', consent_at = NULL, responded_at = now(), note = $2 WHERE id = $1`,
                [n.id, message || null]);
            status = 'disputed';
        } else {
            await client.query(
                `UPDATE collaborators
                    SET invited_email = NULL, user_id = NULL, legal_name = 'Removed by writer', removed_by_writer = true
                  WHERE track_id = $1 AND invited_email = $2`,
                [n.track_id, n.email]);
            await client.query(
                `UPDATE collaborator_notices
                    SET status = 'removed', email = NULL, co_writer_name = NULL, consent_at = NULL,
                        responded_at = now(), note = $2
                  WHERE id = $1`,
                [n.id, choice === 'unrecognized' ? 'unrecognized' : (message || null)]);
            if (n.release_status === 'ready') {
                await client.query(`UPDATE releases SET status = 'draft', ready_at = NULL WHERE id = $1`, [n.release_id]);
            }
            status = 'removed';
        }
        await client.query('COMMIT');
        return res.json({ status });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('respond error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
}

module.exports = { getNotice, respond };