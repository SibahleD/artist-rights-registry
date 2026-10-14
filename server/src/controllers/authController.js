const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');


const { newToken, hashToken } = require('../services/tokens');
const { sendMail } = require('../services/mailer');
const verifyEmailMessage = require('../services/verifyEmail');

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

const SALT_ROUNDS = 10;
const JWT_EXPIRE = '7d';

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
            `INSERT INTO users (email, password_hash, artist_name, contact_info)
             VALUES ($1, $2, $3, $4)
             RETURNING id, email, artist_name, contact_info, email_verified_at, created_at`,
            [email, hashedPassword, artistName, contactInfo ?? null]
        );

        const user = result.rows[0];
        try { await sendVerification(user); } catch (err) { console.error('verification email failed:', err.message); }
        const token = signToken(user);

        return res.status(201).json({ user, token });
    } catch (err) {
        if (err.code === '23505') { 
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
    await pool.query('DELETE FROM email_tokens WHERE user_id = $1 AND used_at IS NULL', [user.id]);
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
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            `SELECT id, user_id FROM email_tokens
             WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
             FOR UPDATE`,
            [hashToken(token)]
        );
        if (!rows[0]) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'This link is invalid or has expired. Request a new one.' });
        }
        await client.query('UPDATE email_tokens SET used_at = now() WHERE id = $1', [rows[0].id]);
        await client.query(
            `UPDATE users SET email_verified_at = COALESCE(email_verified_at, now())
             WHERE id = $1 AND deleted_at IS NULL`,
            [rows[0].user_id]
        );
        await client.query('COMMIT');
        return res.json({ verified: true });
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
             WHERE user_id = $1 AND used_at IS NULL AND created_at > now() - interval '60 seconds'`,
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

function logout(_req, res) {
    return res.status(204).end();
}

module.exports = { register, login, logout, verifyEmail, resendVerification };