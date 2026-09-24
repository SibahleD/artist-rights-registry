const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const SALT_ROUNDS = 10;
const JWT_EXPIRE = '7d';

function signToken(user) {
    return jwt.sign(
        { sub: user.id, email: user.email, artistName: user.artist_name },
        process.env.JWT_SECRET,
        {expiresIn: JWT_EXPIRE}
    );
}

async function register(req, res) {
    const { email, password, artistName, contactInfo } = req.body;

    if (!email || !password || !artistName) {
        return res.status(400).json({ error: 'Email, password, and artist name are required.' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least eight (8) characters' });
    }

    try {
        const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: "Email already in use."});
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const result = await pool.query(
            'INSERT INTO users (email, password, artist_name, contact_info) VALUES ($1, $2, $3, $4) RETURNING id, email, artist_name, contact_info, created_at',
            [email, hashedPassword, artistName, contactInfo]
        );

        const user = result.rows[0];
        const token = signToken(user);

        return res.status(201).json({ user, token });
    } catch (err) {
        console.error('register error:', err);
        return res.status(500).json({ error: 'Internal sever error'});
    }
}

async function login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required'});
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email] );
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password'});
        }

        const matches = await bcrypt.compare(password, user.password_hash);
        if (!matches) {
            return res.status(401).json({ error: 'Invalid email or password'});
        }

        const token = signToken(user);
        delete user.password_hash;

        return res.status(200).json({  user, token});
    } catch (err) {
        console.error('login error:', err);
        return res.status(500).json({ error: 'Internal server error'});
    }
}

module.exports = { register, login };