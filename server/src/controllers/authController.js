const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');


const { newToken, hashToken } = require('../services/tokens');
const { splitLegalName, validateNewPassword, normaliseEmail } = require('../lib/account');
const { sendMail } = require('../services/mailer');
const verifyEmailMessage = require('../services/verifyEmail');
const { emailChangedMessage } = require('../services/emailChange');
const { passwordResetMessage, passwordChangedMessage } = require('../services/passwordReset');

const APP_URL = require('../appUrl');

// Bump when the Terms page changes in a way users must re-accept; stored with each acceptance.
const TERMS_VERSION = '2026-10-22';
const SALT_ROUNDS = 10;
const JWT_EXPIRE = '7d';

// One clock for the stored value and the token's iat (whole seconds), as in accountController.
const nowSeconds = () => new Date(Math.floor(Date.now() / 1000) * 1000);

function signToken(user) {
    return jwt.sign(
        { sub: user.id },
        process.env.JWT_SECRET,
        { expiresIn: JWT_EXPIRE }
    );
}

async function register(req, res) {
    const { password, contactInfo } = req.body;
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const artistName = typeof req.body.artistName === 'string' ? req.body.artistName.trim() : '';

    if (!email || !password || !artistName) {
        return res.status(400).json({ error: 'Email, password, and artist name are required.' });
    }
    if (req.body.legalName !== undefined && req.body.legalName !== null && typeof req.body.legalName !== 'string') {
        return res.status(400).json({ error: 'Legal name must be text.' });
    }
    const legal = splitLegalName(req.body.legalName);
    if ((req.body.legalName ?? '').length > 200) {
        return res.status(400).json({ error: 'Legal name must be at most 200 characters.' });
    }
    if (req.body.acceptedTerms !== true) {
        return res.status(400).json({ error: 'You must accept the Terms and Conditions to create an account.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least eight (8) characters' });
    }
    if (Buffer.byteLength(password, 'utf8') > 72) {
        return res.status(400).json({ error: 'Password must be at most 72 bytes' });
    }

    try {
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Email already in use.' });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const result = await pool.query(
            `INSERT INTO users (email, password_hash, artist_name, contact_info, first_name, last_name, terms_accepted_at, terms_version)
             VALUES ($1, $2, $3, $4, $5, $6, now(), $7)
             RETURNING id, email, artist_name, contact_info, first_name, last_name, email_verified_at, created_at`,
            [email, hashedPassword, artistName, contactInfo ?? null, legal.first, legal.last, TERMS_VERSION]
        );

        const user = result.rows[0];
        try { await sendVerification(user); } catch (err) { console.error('verification email failed:', err.message); }
        const token = signToken(user);

        return res.status(201).json({ user, token });
    } catch (err) {
        if (err.code === '23505') {
            if (err.constraint === 'uq_users_artist_name') {
                return res.status(409).json({ error: 'That artist name is already taken. Add something to tell it apart, such as your city or a number.' });
            }
            return res.status(400).json({ error: 'Email already in use.' });
        }
        console.error('register error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function login(req, res) {
    const { password } = req.body;
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!email || !password || typeof password !== 'string') {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL',
            [email]
        );
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const matches = await bcrypt.compare(password, user.password_hash);
        if (!matches) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = signToken(user);
        delete user.password_hash;

        return res.status(200).json({ user, token });
    } catch (err) {
        console.error('login error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function sendVerification(user) {
    const { raw, hash } = newToken();
    await pool.query('DELETE FROM email_tokens WHERE user_id = $1 AND used_at IS NULL AND kind = \'verify\'', [user.id]);
    await pool.query(
        `INSERT INTO email_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + interval '24 hours')`,
        [user.id, hash]
    );
    const link = `${APP_URL}/verify-email?token=${raw}`;
    await sendMail({ to: user.email, ...verifyEmailMessage({ artistName: user.artist_name, link }) });
}

async function verifyEmail(req, res) {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    if (!token) return res.status(400).json({ error: 'Missing token.' });

    const client = await pool.connect();
    let notifyOld = null;
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            `SELECT id, user_id, kind, new_email FROM email_tokens
             WHERE token_hash = $1 AND kind IN ('verify', 'email_change') AND used_at IS NULL AND expires_at > now()
             FOR UPDATE`,
            [hashToken(token)]
        );
        if (!rows[0]) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'This link is invalid or has expired. Request a new one.' });
        }
        const t = rows[0];

        if (t.kind === 'email_change') {
            const cur = await client.query('SELECT email, artist_name FROM users WHERE id = $1 AND deleted_at IS NULL', [t.user_id]);
            if (!cur.rows[0]) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'This link is invalid or has expired. Request a new one.' });
            }
            try {
                await client.query(
                    'UPDATE users SET email = $1, email_verified_at = now() WHERE id = $2',
                    [t.new_email, t.user_id]
                );
            } catch (err) {
                await client.query('ROLLBACK');
                if (err.code === '23505') {
                    return res.status(409).json({ error: 'That address was taken by another account in the meantime. Choose a different one in Settings.' });
                }
                throw err;
            }
            // Any other unused tokens (old verification link, other change requests) are now moot.
            await client.query('UPDATE email_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [t.user_id]);
            notifyOld = { to: cur.rows[0].email, artistName: cur.rows[0].artist_name, newEmail: t.new_email };
            await client.query('COMMIT');
        } else {
            await client.query('UPDATE email_tokens SET used_at = now() WHERE id = $1', [t.id]);
            await client.query(
                `UPDATE users SET email_verified_at = COALESCE(email_verified_at, now())
                 WHERE id = $1 AND deleted_at IS NULL`,
                [t.user_id]
            );
            await client.query('COMMIT');
        }

        if (notifyOld) {
            // Best effort: tell the old address the sign-in email changed.
            sendMail({ to: notifyOld.to, ...emailChangedMessage({ artistName: notifyOld.artistName, newEmail: notifyOld.newEmail }) })
                .catch((e) => console.error('old-address notice failed:', e.message));
        }
        return res.json({ verified: true, changed: t.kind === 'email_change' });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('verifyEmail error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
}

async function resendVerification(req, res) {
    try {
        if (req.user.emailVerified) {
            return res.status(409).json({ error: 'Your email is already verified.' });
        }
        const recent = await pool.query(
            `SELECT 1 FROM email_tokens
             WHERE user_id = $1 AND kind = 'verify' AND used_at IS NULL AND created_at > now() - interval '60 seconds'`,
            [req.user.id]
        );
        if (recent.rowCount > 0) {
            return res.status(429).json({ error: 'A verification email was just sent. Please wait a minute.' });
        }
        await sendVerification({ id: req.user.id, email: req.user.email, artist_name: req.user.artistName });
        return res.status(204).end();
    } catch (err) {
        console.error('resendVerification error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function forgotPassword(req, res) {
    const email = normaliseEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: 'Enter a valid email address.' });

    try {
        const { rows } = await pool.query(
            'SELECT id, email, artist_name FROM users WHERE email = $1 AND deleted_at IS NULL',
            [email]
        );
        const user = rows[0];
        if (user) {
            const recent = await pool.query(
                `SELECT 1 FROM email_tokens
                 WHERE user_id = $1 AND kind = 'password_reset' AND used_at IS NULL AND created_at > now() - interval '60 seconds'`,
                [user.id]
            );
            if (recent.rowCount === 0) {
                const { raw, hash } = newToken();
                await pool.query(`DELETE FROM email_tokens WHERE user_id = $1 AND kind = 'password_reset' AND used_at IS NULL`, [user.id]);
                await pool.query(
                    `INSERT INTO email_tokens (user_id, token_hash, kind, expires_at)
                     VALUES ($1, $2, 'password_reset', now() + interval '1 hour')`,
                    [user.id, hash]
                );
                const link = `${APP_URL}/reset-password?token=${raw}`;
                // Not awaited: the reply must look the same whether or not the address has an account.
                sendMail({ to: user.email, ...passwordResetMessage({ artistName: user.artist_name, link }) })
                    .catch((e) => console.error('password reset email failed:', e.message));
            }
        }
        // Same answer for known and unknown addresses, so this cannot be used to find out who has an account.
        return res.json({ sent: true });
    } catch (err) {
        console.error('forgotPassword error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function resetPassword(req, res) {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    if (!token) return res.status(400).json({ error: 'Missing token.' });
    const problem = validateNewPassword(req.body?.newPassword);
    if (problem) return res.status(400).json({ error: problem });

    const client = await pool.connect();
    let notify = null;
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            `SELECT t.id, t.user_id, u.email, u.artist_name
             FROM email_tokens t JOIN users u ON u.id = t.user_id
             WHERE t.token_hash = $1 AND t.kind = 'password_reset' AND t.used_at IS NULL
               AND t.expires_at > now() AND u.deleted_at IS NULL
             FOR UPDATE OF t`,
            [hashToken(token)]
        );
        if (!rows[0]) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'This link is invalid or has expired. Request a new one.' });
        }
        const t = rows[0];

        const hashed = await bcrypt.hash(req.body.newPassword, SALT_ROUNDS);
        // Stamping password_changed_at signs out every session that existed before the reset.
        await client.query(
            'UPDATE users SET password_hash = $1, password_changed_at = $2 WHERE id = $3',
            [hashed, nowSeconds(), t.user_id]
        );
        // The link is single use, and any other pending reset or email-change link is now moot.
        await client.query(
            `UPDATE email_tokens SET used_at = now()
             WHERE user_id = $1 AND used_at IS NULL AND kind IN ('password_reset', 'email_change')`,
            [t.user_id]
        );
        await client.query('COMMIT');
        notify = { to: t.email, artistName: t.artist_name };
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('resetPassword error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }

    sendMail({ to: notify.to, ...passwordChangedMessage({ artistName: notify.artistName }) })
        .catch((e) => console.error('password changed notice failed:', e.message));
    return res.json({ reset: true });
}

function logout(_req, res) {
    return res.status(204).end();
}

module.exports = { register, login, logout, verifyEmail, resendVerification, forgotPassword, resetPassword, signToken };