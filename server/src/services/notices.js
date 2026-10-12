const crypto = require('crypto');

const NOTICE_VERSION = '2026-10-v1'; 
const EXPIRY_DAYS = Number(process.env.NOTICE_EXPIRY_DAYS) || 14;
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

function emailHash(email) {
    const key = process.env.EMAIL_HASH_KEY;
    if (!key) throw new Error('EMAIL_HASH_KEY is not set');
    return crypto.createHmac('sha256', key).update(email.trim().toLowerCase()).digest('hex');
}

const noticeLink = (raw) => `${APP_URL}/notice/${raw}`;

async function sweepNotices() {
    const pool = require('../db/pool');
    await pool.query(`
        WITH due AS (
            SELECT id, track_id, email FROM collaborator_notices
            WHERE status = 'pending' AND expires_at < now() AND email IS NOT NULL
            FOR UPDATE
        ), upd AS (
            UPDATE collaborator_notices n
               SET status = 'expired', email = NULL, co_writer_name = NULL
              FROM due WHERE n.id = due.id
            RETURNING due.track_id, due.email AS old_email
        )
        UPDATE collaborators c SET invited_email = NULL
          FROM upd WHERE c.track_id = upd.track_id AND c.invited_email = upd.old_email`);
}

async function noticeReadiness(release) {
    const pool = require('../db/pool');
    const { rows: people } = await pool.query(
        `SELECT t.id AS track_id, t.track_number, t.title, c.legal_name, c.invited_email, c.user_id,
                c.role, c.ownership_percent, c.removed_by_writer
         FROM collaborators c JOIN tracks t ON t.id = c.track_id
         WHERE t.release_id = $1 ORDER BY t.track_number, c.created_at`, [release.id]);
    const { rows: notices } = await pool.query(
        `SELECT n.* FROM collaborator_notices n JOIN tracks t ON t.id = n.track_id WHERE t.release_id = $1`,
        [release.id]);
    const owner = (await pool.query('SELECT email FROM users WHERE id = $1', [release.owner_id])).rows[0];
    const byKey = new Map(notices.map((n) => [`${n.track_id}:${n.email_hash}`, n]));

    const errors = [], unconfirmed = [];
    for (const p of people) {
        const where = `Track ${p.track_number} ("${p.title}")`;
        if (p.removed_by_writer) {
            errors.push(`${where}: a co-writer removed themselves (${Number(p.ownership_percent)}%). Reassign that share and discard the line before marking ready.`);
            continue;
        }
        if (p.user_id === release.owner_id || (p.invited_email && p.invited_email === owner.email)) continue;
        if (!p.invited_email) continue; 
        const n = byKey.get(`${p.track_id}:${emailHash(p.invited_email)}`);
        const same = n && n.role === p.role && Number(n.share_percent) === Number(p.ownership_percent);
        if (n && n.status === 'disputed' && same) {
            errors.push(`${where}: ${p.legal_name} disputed these details. Agree the correct split with them, change it and send a new notice.`);
        } else if (!(n && n.status === 'confirmed' && same)) {
            const why = !n ? 'no notice sent' : !same ? 'details changed since the notice' : n.status;
            unconfirmed.push(`${where}: ${p.legal_name} has not confirmed (${why}).`);
        }
    }
    return { errors, unconfirmed };
}

module.exports = { noticeReadiness, NOTICE_VERSION, EXPIRY_DAYS, emailHash, noticeLink, sweepNotices };