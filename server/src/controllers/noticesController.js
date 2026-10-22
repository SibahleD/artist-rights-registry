const pool = require('../db/pool');
const limits = require('../limits');
const { newToken } = require('../services/tokens');
const { sendMail } = require('../services/mailer');
const coWriterNotice = require('../services/cowriterNotice');
const { NOTICE_VERSION, EXPIRY_DAYS, emailHash, noticeLink, sweepNotices } = require('../services/notices');

async function sendNotices(req, res) {
    const client = await pool.connect();
    const results = [];
    const mail = [];
    try {
        await client.query('BEGIN');
        const rel = await client.query(
            'SELECT id, title FROM releases WHERE id = $1 AND owner_id = $2 FOR UPDATE',
            [req.params.id, req.user.id]
        );
        if (!rel.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Release not found.' }); }
        const release = rel.rows[0];

        const { rows: splits } = await client.query(
            `SELECT t.id AS track_id, t.title AS track_title, c.legal_name, c.invited_email, c.role, c.ownership_percent
             FROM collaborators c JOIN tracks t ON t.id = c.track_id
             WHERE t.release_id = $1 AND c.invited_email IS NOT NULL AND c.removed_by_writer = false
             ORDER BY t.track_number, c.created_at`,
            [release.id]
        );
        const { rows: existing } = await client.query(
            `SELECT n.* FROM collaborator_notices n JOIN tracks t ON t.id = n.track_id WHERE t.release_id = $1`,
            [release.id]
        );
        const byKey = new Map(existing.map((n) => [`${n.track_id}:${n.email_hash}`, n]));

        const used = (await client.query(
            `SELECT count(*)::int AS n FROM collaborator_notices
             WHERE sent_by = $1 AND sent_at > now() - interval '24 hours'`, [req.user.id]
        )).rows[0].n;
        let budget = limits.maxNoticesPerDay - used;

        for (const s of splits) {
            const base = { trackId: s.track_id, name: s.legal_name, email: s.invited_email };
            if (s.invited_email === req.user.email) { results.push({ ...base, action: 'skipped_self' }); continue; }

            const hash = emailHash(s.invited_email);
            const prev = byKey.get(`${s.track_id}:${hash}`);
            const same = prev && prev.role === s.role && Number(prev.share_percent) === Number(s.ownership_percent);

            let action;
            if (prev && prev.status === 'removed') action = 'blocked';
            else if (prev && same && ['pending', 'confirmed', 'disputed'].includes(prev.status)) action = 'unchanged';
            else if (budget <= 0) action = 'limit';
            else if (!prev) action = 'sent';
            else if (same) action = 'resent';
            else action = 'updated';

            if (['sent', 'resent', 'updated'].includes(action)) {
                const { raw, hash: tokenHash } = newToken();
                if (!prev) {
                    await client.query(
                        `INSERT INTO collaborator_notices
                           (track_id, email_hash, email, co_writer_name, role, share_percent, token_hash,
                            notice_version, sent_by, expires_at)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() + make_interval(days => $10))`,
                        [s.track_id, hash, s.invited_email, s.legal_name, s.role, s.ownership_percent,
                         tokenHash, NOTICE_VERSION, req.user.id, EXPIRY_DAYS]
                    );
                } else {
                    await client.query(
                        `UPDATE collaborator_notices
                            SET email = $2, co_writer_name = $3, role = $4, share_percent = $5, token_hash = $6,
                                notice_version = $7, sent_by = $8, status = 'pending', note = NULL,
                                sent_at = now(), reminder_sent_at = NULL, responded_at = NULL, consent_at = NULL,
                                resolution = NULL, resolution_note = NULL, resolved_at = NULL,
                                expires_at = now() + make_interval(days => $9)
                          WHERE id = $1`,
                        [prev.id, s.invited_email, s.legal_name, s.role, s.ownership_percent,
                         tokenHash, NOTICE_VERSION, req.user.id, EXPIRY_DAYS]
                    );
                }
                budget -= 1;
                mail.push({
                    to: s.invited_email,
                    ...coWriterNotice({
                        kind: action === 'updated' ? 'updated' : 'new',
                        artistName: req.user.artistName, coWriterName: s.legal_name, role: s.role,
                        trackTitle: s.track_title, releaseTitle: release.title,
                        sharePercent: Number(s.ownership_percent), link: noticeLink(raw),
                    }),
                });
            }
            results.push({ ...base, action });
        }

        await client.query('COMMIT');

        for (const m of mail) {
            try { await sendMail(m); }
            catch (err) { console.error('notice email failed:', err.message); }
        }
        return res.json({ results });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('sendNotices error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
}

async function listNotices(req, res) {
    try {
        const rel = await pool.query('SELECT id FROM releases WHERE id = $1 AND owner_id = $2', [req.params.id, req.user.id]);
        if (!rel.rows[0]) return res.status(404).json({ error: 'Release not found.' });
        await sweepNotices();
        const { rows } = await pool.query(
            `SELECT n.id, n.track_id, n.co_writer_name, n.email, n.role, n.share_percent, n.status, n.note,
                    n.sent_at, n.reminder_sent_at, n.expires_at, n.responded_at,
                    n.resolution, n.resolution_note, n.resolved_at
             FROM collaborator_notices n JOIN tracks t ON t.id = n.track_id
             WHERE t.release_id = $1 ORDER BY t.track_number, n.sent_at`,
            [req.params.id]
        );
        return res.json({ notices: rows });
    } catch (err) {
        console.error('listNotices error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function remindNotice(req, res) {
    try {
        const { rows } = await pool.query(
            `SELECT n.*, t.title AS track_title, r.title AS release_title
             FROM collaborator_notices n JOIN tracks t ON t.id = n.track_id JOIN releases r ON r.id = t.release_id
             WHERE n.id = $1 AND r.id = $2 AND r.owner_id = $3`,
            [req.params.noticeId, req.params.id, req.user.id]
        );
        const n = rows[0];
        if (!n) return res.status(404).json({ error: 'Notice not found.' });
        if (n.status !== 'pending' || !n.email || new Date(n.expires_at) < new Date()) {
            return res.status(409).json({ error: 'Only pending, unexpired invitations can be reminded.' });
        }
        if (n.reminder_sent_at) return res.status(409).json({ error: 'A reminder was already sent.' });

        const { raw, hash } = newToken(); 
        await pool.query('UPDATE collaborator_notices SET token_hash = $2, reminder_sent_at = now() WHERE id = $1', [n.id, hash]);
        await sendMail({
            to: n.email,
            ...coWriterNotice({
                kind: 'reminder', artistName: req.user.artistName, coWriterName: n.co_writer_name, role: n.role,
                trackTitle: n.track_title, releaseTitle: n.release_title,
                sharePercent: Number(n.share_percent), link: noticeLink(raw),
            }),
        });
        return res.status(204).end();
    } catch (err) {
        console.error('remindNotice error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// The artist's decision on a disputed notice. Either way the notice is closed (status 'cancelled', personal data
// wiped like any other dead notice) so the same or updated details can be sent again.
//   keep       - keep my numbers: only while the credit still matches what the co-writer disputed
//   use_theirs - the artist has already changed the credit in the track editor to match the correction
async function resolveNotice(req, res) {
    const decision = req.body && req.body.decision;
    if (!['keep', 'use_theirs'].includes(decision)) {
        return res.status(400).json({ error: "Decision must be 'keep' or 'use_theirs'." });
    }
    const rawNote = req.body.note;
    if (rawNote != null && typeof rawNote !== 'string') return res.status(400).json({ error: 'Note must be text.' });
    const note = rawNote ? rawNote.trim().slice(0, 1000) : '';

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            `SELECT n.* FROM collaborator_notices n
               JOIN tracks t ON t.id = n.track_id JOIN releases r ON r.id = t.release_id
              WHERE n.id = $1 AND r.id = $2 AND r.owner_id = $3
              FOR UPDATE OF n`,
            [req.params.noticeId, req.params.id, req.user.id]
        );
        const n = rows[0];
        if (!n) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Notice not found.' }); }
        if (n.status !== 'disputed') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Only a disputed notice can be resolved.' });
        }

        const { rows: cw } = await client.query(
            `SELECT role, ownership_percent FROM collaborators
              WHERE track_id = $1 AND invited_email = $2 AND removed_by_writer = false`,
            [n.track_id, n.email]
        );
        const c = cw[0];
        if (!c) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This person is no longer on the track.' }); }
        const unchanged = c.role === n.role && Number(c.ownership_percent) === Number(n.share_percent);

        if (decision === 'keep' && !unchanged) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: "You have changed this person's role or share since the notice. Choose 'use theirs', or put the details back first." });
        }
        if (decision === 'use_theirs' && unchanged) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: "Change this person's role or share in the track editor first, then mark the dispute resolved." });
        }

        const done = await client.query(
            `UPDATE collaborator_notices
                SET status = 'cancelled', email = NULL, co_writer_name = NULL, consent_at = NULL,
                    resolution = $2, resolution_note = $3, resolved_at = now()
              WHERE id = $1
          RETURNING id, status, resolution, resolution_note, resolved_at`,
            [n.id, decision === 'keep' ? 'kept' : 'adopted', note || null]
        );
        await client.query('COMMIT');
        return res.json({ notice: done.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('resolveNotice error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
}

module.exports = { sendNotices, listNotices, remindNotice, resolveNotice };