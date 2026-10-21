const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { tokenPredatesPasswordChange } = require('../lib/account');

async function authToken(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'missing or malformed authorization header' });
    }

    const token = header.slice('Bearer '.length);

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        return res.status(401).json({ error: 'invalid or expired token' });
    }

    try {
        const { rows } = await pool.query(
            'SELECT id, email, artist_name, email_verified_at, password_changed_at FROM users WHERE id = $1 AND deleted_at IS NULL',
            [payload.sub]
        );
        if (!rows[0] || tokenPredatesPasswordChange(payload.iat, rows[0].password_changed_at)) {
            return res.status(401).json({ error: 'invalid or expired token' });
        }

        req.user = {
            id: rows[0].id,
            email: rows[0].email,
            artistName: rows[0].artist_name,
            emailVerified: !!rows[0].email_verified_at,
        };
        return next();
    } catch (err) {
        console.error('auth middleware error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = { authToken };