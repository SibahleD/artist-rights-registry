const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const storage = require('../services/storage');
const { newToken } = require('../services/tokens');
const { sendMail } = require('../services/mailer');
const { emailHash } = require('../services/notices');
const { buildExport } = require('../services/exportRelease');
const { confirmEmailChangeMessage } = require('../services/emailChange');
const { signToken } = require('./authController');
const { validatePreferences, withDefaults, validateNewPassword, normaliseEmail } = require('../lib/account');

const APP_URL = process.env.APP_URL || 'http://localhost:5173/app';
const SALT_ROUNDS = 10;
const fail = (res, e, label) => { console.error(`${label} error:`, e); return res.status(500).json({ error: 'Internal server error' }); };

// Sensitive actions re-ask for the password, so a stolen session alone cannot change them.
async function checkPassword(userId, password) {
    if (typeof password !== 'string' || !password) return false;
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]);
    return !!rows[0] && bcrypt.compare(password, rows[0].password_hash);
}

// One clock for both the stored value and the token's iat (whole seconds), so the new token is never rejected.
const nowSeconds = () => new Date(Math.floor(Date.now() / 1000) * 1000);

async function changePassword(req, res) {
    const { currentPassword, newPassword } = req.body ?? {};
    const problem = validateNewPassword(newPassword);
    if (problem) return res.status(400).json({ error: problem });
    try {
        if (!(await checkPassword(req.user.id, currentPassword))) {
            return res.status(403).json({ error: 'Your current password is not correct.' });
        }
        if (currentPassword === newPassword) {
            return res.status(400).json({ error: 'Choose a password different from your current one.' });
        }
        const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await pool.query('UPDATE users SET password_hash = $1, password_changed_at = $2 WHERE id = $3', [hash, nowSeconds(), req.user.id]);
        // Every older session token stops working; hand back a fresh one for this device.
        return res.json({ token: signToken({ id: req.user.id }) });
    } catch (e) { return fail(res, e, 'changePassword'); }
}

async function requestEmailChange(req, res) {
    const email = normaliseEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (email === req.user.email) return res.status(400).json({ error: 'That is already your email address.' });
    try {
        if (!(await checkPassword(req.user.id, req.body?.password))) {
            return res.status(403).json({ error: 'Your password is not correct.' });
        }
        const taken = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
        if (taken.rowCount > 0) return res.status(409).json({ error: 'That email is already used by another account.' });

        const recent = await pool.query(
            `SELECT 1 FROM email_tokens WHERE user_id = $1 AND kind = 'email_change' AND used_at IS NULL
               AND created_at > now() - interval '60 seconds'`, [req.user.id]);
        if (recent.rowCount > 0) return res.status(429).json({ error: 'A confirmation email was just sent. Please wait a minute.' });

        const { raw, hash } = newToken();
        await pool.query(`DELETE FROM email_tokens WHERE user_id = $1 AND kind = 'email_change' AND used_at IS NULL`, [req.user.id]);
        await pool.query(
            `INSERT INTO email_tokens (user_id, token_hash, expires_at, kind, new_email)
             VALUES ($1, $2, now() + interval '24 hours', 'email_change', $3)`,
            [req.user.id, hash, email]
        );
        // The link goes to the NEW address, which proves the person owns it.
        const link = `${APP_URL}/verify-email?token=${raw}`;
        await sendMail({ to: email, ...confirmEmailChangeMessage({ artistName: req.user.artistName, link }) });
        return res.json({ pending_email: email });
    } catch (e) { return fail(res, e, 'requestEmailChange'); }
}

async function cancelEmailChange(req, res) {
    try {
        await pool.query(`DELETE FROM email_tokens WHERE user_id = $1 AND kind = 'email_change' AND used_at IS NULL`, [req.user.id]);
        return res.status(204).end();
    } catch (e) { return fail(res, e, 'cancelEmailChange'); }
}

async function updatePreferences(req, res) {
    const r = validatePreferences(req.body);
    if (r.error) return res.status(400).json({ error: r.error });
    try {
        const { rows } = await pool.query(
            'UPDATE users SET preferences = preferences || $1::jsonb WHERE id = $2 RETURNING preferences',
            [JSON.stringify(r.value), req.user.id]
        );
        return res.json({ preferences: withDefaults(rows[0].preferences) });
    } catch (e) { return fail(res, e, 'updatePreferences'); }
}

const PROFILE_KEYS = ['artist_name', 'first_name', 'last_name', 'username', 'contact_info', 'country', 'nationality',
    'roles', 'society_name', 'ipi', 'publisher_name', 'email', 'email_verified_at', 'created_at'];

// Everything the user owns, as JSON. Like the release export, rows are picked by key list and carry no internal ids.
async function exportMyData(req, res) {
    try {
        const uid = req.user.id;
        const [u, links, releases, sentNotices, credited, media] = await Promise.all([
            pool.query(`SELECT ${PROFILE_KEYS.join(', ')}, preferences FROM users WHERE id = $1`, [uid]),
            pool.query('SELECT platform, url FROM artist_links WHERE user_id = $1 ORDER BY platform', [uid]),
            pool.query('SELECT * FROM releases WHERE owner_id = $1 ORDER BY created_at', [uid]),
            pool.query(
                `SELECT t.title AS track_title, n.co_writer_name, n.role, n.share_percent, n.status, n.sent_at, n.responded_at
                 FROM collaborator_notices n JOIN tracks t ON t.id = n.track_id WHERE n.sent_by = $1 ORDER BY n.sent_at`, [uid]),
            pool.query(
                `SELECT t.title AS track_title, r.title AS release_title, c.role, c.ownership_percent
                 FROM collaborators c JOIN tracks t ON t.id = c.track_id JOIN releases r ON r.id = t.release_id
                 WHERE c.user_id = $1 AND r.owner_id <> $1 ORDER BY r.created_at`, [uid]),
            pool.query(`SELECT mime_type, width, height, size_bytes FROM media WHERE owner_id = $1 AND kind = 'avatar'`, [uid]),
        ]);

        const releaseExports = [];
        for (const rel of releases.rows) {
            const exp = await buildExport(rel);
            const { rows } = await pool.query('SELECT store, url FROM release_links WHERE release_id = $1 ORDER BY created_at', [rel.id]);
            releaseExports.push({ ...exp, release_links: rows, released_at: rel.released_at });
        }

        const out = {
            export_version: 1,
            exported_at: new Date().toISOString(),
            note: 'Audio files and images are not included in this file. Co-writer email addresses are left out on purpose.',
            profile: { ...u.rows[0], preferences: withDefaults(u.rows[0].preferences) },
            avatar: media.rows[0] ?? null,
            links: links.rows,
            releases: releaseExports,
            co_writer_notices_sent: sentNotices.rows,
            credited_on_other_releases: credited.rows.map((c) => ({ ...c, ownership_percent: Number(c.ownership_percent) })),
        };
        res.setHeader('Content-Disposition', 'attachment; filename="my-registry-data.json"');
        return res.json(out);
    } catch (e) { return fail(res, e, 'exportMyData'); }
}

// Anonymise rather than hard-delete: releases.owner_id is RESTRICT and disputes point at users, so the row stays
// as an empty tombstone while everything personal is removed.
async function deleteAccount(req, res) {
    const uid = req.user.id;
    try {
        if (!(await checkPassword(uid, req.body?.password))) {
            return res.status(403).json({ error: 'Your password is not correct.' });
        }
        // Ready and released releases are records other people rely on, so they must be taken apart on purpose first.
        const locked = await pool.query(`SELECT count(*)::int AS n FROM releases WHERE owner_id = $1 AND status <> 'draft'`, [uid]);
        if (locked.rows[0].n > 0) {
            return res.status(409).json({
                error: `You have ${locked.rows[0].n} release${locked.rows[0].n === 1 ? '' : 's'} marked ready or released. Move ${locked.rows[0].n === 1 ? 'it' : 'them'} back to draft and delete ${locked.rows[0].n === 1 ? 'it' : 'them'} first, then try again.`,
            });
        }

        const me = (await pool.query('SELECT email FROM users WHERE id = $1', [uid])).rows[0];
        const client = await pool.connect();
        let keys;
        try {
            await client.query('BEGIN');
            keys = (await client.query('SELECT storage_key FROM audio_files WHERE owner_id = $1', [uid])).rows.map((r) => r.storage_key);

            await client.query('DELETE FROM collaborator_notices WHERE sent_by = $1', [uid]);
            await client.query('DELETE FROM releases WHERE owner_id = $1', [uid]);          // drafts; tracks, specs, audio rows cascade
            // Credits on other people's releases keep the name the owner typed, but lose the link and the address.
            await client.query('UPDATE collaborators SET user_id = NULL, invited_email = NULL WHERE user_id = $1', [uid]);
            await client.query('UPDATE collaborator_notices SET email = NULL WHERE email_hash = $1', [emailHash(me.email)]);
            await client.query('DELETE FROM media WHERE owner_id = $1', [uid]);
            await client.query('DELETE FROM artist_links WHERE user_id = $1', [uid]);
            await client.query('DELETE FROM email_tokens WHERE user_id = $1', [uid]);
            await client.query(
                `UPDATE users SET email = $2, password_hash = '!', artist_name = 'Deleted artist', contact_info = NULL,
                    first_name = NULL, last_name = NULL, username = NULL, country = NULL, nationality = NULL,
                    roles = '{}', society_name = NULL, ipi = NULL, publisher_name = NULL, preferences = '{}',
                    email_verified_at = NULL, deleted_at = $3, password_changed_at = $3
                 WHERE id = $1`,
                [uid, `deleted-${uid}@deleted.invalid`, nowSeconds()]
            );
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            if (err.code === '23503') {
                return res.status(409).json({ error: 'One of your drafts has a track with a split dispute, so it cannot be deleted yet. Resolve the dispute first.' });
            }
            throw err;
        } finally {
            client.release();
        }
        await Promise.all(keys.map((k) => storage.delete(k)));
        return res.status(204).end();
    } catch (e) { return fail(res, e, 'deleteAccount'); }
}

module.exports = { changePassword, requestEmailChange, cancelEmailChange, updatePreferences, exportMyData, deleteAccount };
