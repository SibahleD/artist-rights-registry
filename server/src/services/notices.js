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

module.exports = { NOTICE_VERSION, EXPIRY_DAYS, emailHash, noticeLink, sweepNotices };