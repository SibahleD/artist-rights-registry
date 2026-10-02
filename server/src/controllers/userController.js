const pool = require('../db/pool');

const USER_COLUMNS = 'id, email, artist_name, contact_info, first_name, last_name, username, created_at';
const PLATFORMS = ['spotify', 'apple_music', 'soundcloud', 'youtube', 'instagram', 'tiktok', 'x'];
const USERNAME_RE = /^[a-z0-9_.]{3,30}$/;

function optionalText(label, max) {
    return (v) => {
        if (v === null || v === '') return { value: null };
        if (typeof v !== 'string') return { error: `${label} must be a string.` };
        const t = v.trim();
        if (t.length > max) return { error: `${label} must be at most ${max} characters.` };
        return { value: t || null };
    };
}

const VALIDATORS = {
    artist_name: (v) => {
        if (typeof v !== 'string' || !v.trim()) return { error: 'Artist name cannot be empty.' };
        if (v.trim().length > 100) return { error: 'Artist name must be at most 100 characters.' };
        return { value: v.trim() };
    },
    contact_info: optionalText('Contact info', 500),
    first_name: optionalText('First name', 100),
    last_name: optionalText('Last name', 100),
    username: (v) => {
        if (v === null || v === '') return { value: null };
        if (typeof v !== 'string') return { error: 'Username must be a string.' };
        const u = v.trim().toLowerCase();
        if (!USERNAME_RE.test(u)) {
            return { error: 'Username must be 3-30 characters: letters, numbers, underscores, or periods.' };
        }
        return { value: u };
    },
};

// request body key -> column
const BODY_TO_COLUMN = {
    artistName: 'artist_name',
    contactInfo: 'contact_info',
    firstName: 'first_name',
    lastName: 'last_name',
    username: 'username',
};

async function getMe(req, res) {
    try {
        const userResult = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [req.user.id]);
        const linksResult = await pool.query(
            'SELECT platform, url FROM artist_links WHERE user_id = $1 ORDER BY platform',
            [req.user.id]
        );
        return res.json({ user: userResult.rows[0], links: linksResult.rows });
    } catch (err) {
        console.error('getMe error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function updateMe(req, res) {
    const sets = [];
    const values = [];

    for (const [key, column] of Object.entries(BODY_TO_COLUMN)) {
        if (!(key in req.body)) continue;
        const result = VALIDATORS[column](req.body[key]);
        if (result.error) return res.status(400).json({ error: result.error });
        values.push(result.value);
        sets.push(`${column} = $${values.length}`);
    }

    if (sets.length === 0) {
        return res.status(400).json({ error: 'No updatable fields provided.' });
    }

    values.push(req.user.id);

    try {
        const result = await pool.query(
            `UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING ${USER_COLUMNS}`,
            values
        );
        return res.json({ user: result.rows[0] });
    } catch (err) {
        if (err.code === '23505' && err.constraint === 'uq_users_username') {
            return res.status(409).json({ error: 'Username already taken.' });
        }
        console.error('updateMe error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function listLinks(req, res) {
    try {
        const { rows } = await pool.query(
            'SELECT platform, url FROM artist_links WHERE user_id = $1 ORDER BY platform',
            [req.user.id]
        );
        return res.json({ links: rows });
    } catch (err) {
        console.error('listLinks error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function upsertLink(req, res) {
    const { platform } = req.params;
    if (!PLATFORMS.includes(platform)) {
        return res.status(400).json({ error: `Platform must be one of: ${PLATFORMS.join(', ')}.` });
    }

    const url = typeof req.body.url === 'string' ? req.body.url.trim() : '';
    if (!url || url.length > 500) {
        return res.status(400).json({ error: 'URL is required and must be at most 500 characters.' });
    }

    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error();
    } catch {
        return res.status(400).json({ error: 'URL must be a valid http(s) URL.' });
    }

    try {
        const { rows } = await pool.query(
            `INSERT INTO artist_links (user_id, platform, url)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, platform) DO UPDATE SET url = EXCLUDED.url
             RETURNING platform, url`,
            [req.user.id, platform, url]
        );
        return res.json({ link: rows[0] });
    } catch (err) {
        console.error('upsertLink error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function deleteLink(req, res) {
    const { platform } = req.params;
    if (!PLATFORMS.includes(platform)) {
        return res.status(400).json({ error: `Platform must be one of: ${PLATFORMS.join(', ')}.` });
    }

    try {
        const result = await pool.query(
            'DELETE FROM artist_links WHERE user_id = $1 AND platform = $2',
            [req.user.id, platform]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Link not found.' });
        }
        return res.status(204).end();
    } catch (err) {
        console.error('deleteLink error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = { getMe, updateMe, listLinks, upsertLink, deleteLink };