const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

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
        // Check all rows, including soft-deleted: the UNIQUE constraint covers them too.
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Email already in use.' });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const result = await pool.query(
            `INSERT INTO users (email, password_hash, artist_name, contact_info)
             VALUES ($1, $2, $3, $4)
             RETURNING id, email, artist_name, contact_info, created_at`,
            [email, hashedPassword, artistName, contactInfo ?? null]
        );

        const user = result.rows[0];
        const token = signToken(user);

        return res.status(201).json({ user, token });
    } catch (err) {
        if (err.code === '23505') { // unique_violation (concurrent registration)
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

function logout(_req, res) {
    return res.status(204).end();
}

module.exports = { register, login, logout };