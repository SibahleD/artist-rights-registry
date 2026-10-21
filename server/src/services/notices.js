const crypto = require('crypto');

const NOTICE_VERSION = '2026-10-v1'; 
const EXPIRY_DAYS = Number(process.env.NOTICE_EXPIRY_DAYS) || 14;
const APP_URL = process.env.APP_URL || 'http://localhost:5173/app';

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

async function loadNoticeContext(release) {
    const pool = require('../db/pool');
    const { rows: people } = await pool.query(
        `SELECT c.id, t.id AS track_id, t.track_number, t.title, c.legal_name, c.invited_email, c.user_id,
                c.role, c.ownership_percent, c.removed_by_writer
         FROM collaborators c JOIN tracks t ON t.id = c.track_id
         WHERE t.release_id = $1 ORDER BY t.track_number, c.created_at, c.id`, [release.id]);
    const { rows: notices } = await pool.query(
        `SELECT n.* FROM collaborator_notices n JOIN tracks t ON t.id = n.track_id WHERE t.release_id = $1`,
        [release.id]);
    const owner = (await pool.query('SELECT email, first_name, last_name, artist_name FROM users WHERE id = $1', [release.owner_id])).rows[0];
    const byKey = new Map(notices.map((n) => [`${n.track_id}:${n.email_hash}`, n]));
    return { people, byKey, owner };
}

const sameName = (a, b) => String(a || '').trim().replace(/\s+/g, ' ').toLowerCase() === String(b || '').trim().replace(/\s+/g, ' ').toLowerCase();

// The release form pre-fills the owner's own credit with their name and no email, so recognise it by that name.
function isOwnersOwnName(p, owner) {
    if (!owner || p.invited_email) return false;
    const full = [owner.first_name, owner.last_name].filter(Boolean).join(' ') || owner.artist_name;
    return !!full && sameName(p.legal_name, full);
}

// One definition of "where does this credit stand", shared by the readiness checks and the export.
function classify(p, release, ctx) {
    if (p.removed_by_writer) return { state: 'removed' };
    if (p.user_id === release.owner_id || (p.invited_email && ctx.owner && p.invited_email === ctx.owner.email)) return { state: 'self' };
    if (isOwnersOwnName(p, ctx.owner)) return { state: 'self' };
    if (!p.invited_email) return { state: 'no_email' };
    const n = ctx.byKey.get(`${p.track_id}:${emailHash(p.invited_email)}`);
    const same = n && n.role === p.role && Number(n.share_percent) === Number(p.ownership_percent);
    if (n && n.status === 'disputed' && same) return { state: 'disputed' };
    if (n && n.status === 'confirmed' && same) return { state: 'confirmed' };
    return { state: 'unconfirmed', why: !n ? 'no notice sent' : !same ? 'details changed since the notice' : n.resolution ? 'you resolved the dispute but have not sent the notice again' : n.status };
}

// Co-writer problems as strings (errors block, unconfirmed needs acknowledging) plus the same as structured items.
async function noticeReadiness(release) {
    const ctx = await loadNoticeContext(release);
    const errors = [], unconfirmed = [], items = [];
    for (const p of ctx.people) {
        const where = `Track ${p.track_number} ("${p.title}")`;
        const { state, why } = classify(p, release, ctx);
        let message;
        if (state === 'removed') {
            message = `${where}: a co-writer removed themselves (${Number(p.ownership_percent)}%). Reassign that share and discard the line before marking ready.`;
            errors.push(message);
            items.push({ level: 'error', id: 'cowriter-removed', trackNumber: p.track_number, message });
        } else if (state === 'disputed') {
            message = `${where}: ${p.legal_name} disputed these details. Agree the correct split with them, change it and send a new notice.`;
            errors.push(message);
            items.push({ level: 'error', id: 'cowriter-disputed', trackNumber: p.track_number, message });
        } else if (state === 'unconfirmed') {
            message = `${where}: ${p.legal_name} has not confirmed (${why}).`;
            unconfirmed.push(message);
            items.push({ level: 'warn', id: 'cowriter-unconfirmed', trackNumber: p.track_number, message });
        }
    }
    return { errors, unconfirmed, items };
}

// 'confirmed' | 'unconfirmed' | 'removed' for every credit on the release, keyed by collaborator id.
// The owner's own credit counts as confirmed. Anyone without an email, or with a dispute open, is unconfirmed.
async function creditStatuses(release) {
    const ctx = await loadNoticeContext(release);
    const out = new Map();
    for (const p of ctx.people) {
        const { state } = classify(p, release, ctx);
        out.set(p.id, state === 'removed' ? 'removed' : state === 'self' || state === 'confirmed' ? 'confirmed' : 'unconfirmed');
    }
    return out;
}

module.exports = { noticeReadiness, creditStatuses, NOTICE_VERSION, EXPIRY_DAYS, emailHash, noticeLink, sweepNotices };