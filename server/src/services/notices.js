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

// What the owner should do next, by the reason a credit is unconfirmed.
const NEXT_STEP = {
    'no notice sent': 'Send them the invitation from the splits page.',
    'details changed since the notice': 'Their role or share changed after the notice, so send an updated invitation from the splits page.',
    'you resolved the dispute but have not sent the notice again': 'You resolved the dispute, so send the notice again from the splits page.',
    pending: 'Ask them to use the link in their invitation, or send a reminder from the splits page.',
    expired: 'Their invitation expired, so send it again from the splits page.',
    cancelled: 'Their invitation was cancelled, so send it again from the splits page.',
};

// Co-writer problems as strings plus the same as structured items. A song with more than one credit cannot be marked
// ready until every shared credit has been confirmed by that person: there is no way around it.
// The owner's own credit counts as confirmed, and so does a 0% credit-only entry (a featured artist, for example),
// because there is no share for it to agree to.
async function noticeReadiness(release) {
    const ctx = await loadNoticeContext(release);
    const errors = [], items = [];
    const credits = new Map();
    for (const p of ctx.people) if (!p.removed_by_writer) credits.set(p.track_id, (credits.get(p.track_id) || 0) + 1);
    const push = (id, p, message) => { errors.push(message); items.push({ level: 'error', id, trackNumber: p.track_number, message }); };

    for (const p of ctx.people) {
        const where = `Track ${p.track_number} ("${p.title}")`;
        const pct = Number(p.ownership_percent);
        const { state, why } = classify(p, release, ctx);
        if (state === 'removed') {
            push('cowriter-removed', p, `${where}: a co-writer removed themselves (${pct}%). Reassign that share and discard the line on the splits page before marking ready.`);
        } else if (state === 'disputed') {
            push('cowriter-disputed', p, `${where}: ${p.legal_name} disputed these details. Agree the correct split with them, change it and send a new notice from the splits page.`);
        } else if ((state === 'unconfirmed' || state === 'no_email') && pct > 0 && credits.get(p.track_id) > 1) {
            const step = state === 'no_email'
                ? 'Add their email on the splits page and send them the invitation.'
                : NEXT_STEP[why] || 'Ask them from the splits page.';
            push('cowriter-unconfirmed', p, `${where}: Waiting for ${p.legal_name} to confirm their ${pct}%. ${step}`);
        }
    }
    return { errors, items };
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