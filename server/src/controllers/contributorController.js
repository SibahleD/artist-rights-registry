const pool = require('../db/pool');
const { parseContributors } = require('../lib/distribution');

// The ordered primary-artist list and the producer-style credits (name + title) for one release.
// Replaced as a whole on every save, inside one transaction, so the list can never be left half-written.

async function ownedRelease(req, res, { requireDraft }) {
    const { rows } = await pool.query('SELECT id, status FROM releases WHERE id = $1 AND owner_id = $2', [req.params.id, req.user.id]);
    const release = rows[0];
    if (!release) { res.status(404).json({ error: 'Release not found.' }); return null; }
    if (requireDraft && release.status !== 'draft') {
        res.status(409).json({ error: 'Ready releases are locked. Revert to draft to edit.' });
        return null;
    }
    return release;
}

async function load(db, releaseId) {
    const [artists, credits] = await Promise.all([
        db.query('SELECT name FROM release_artists WHERE release_id = $1 ORDER BY position', [releaseId]),
        db.query(`SELECT t.track_number, c.name, c.title
                  FROM release_credits c LEFT JOIN tracks t ON t.id = c.track_id
                  WHERE c.release_id = $1 ORDER BY t.track_number NULLS FIRST, c.position`, [releaseId]),
    ]);
    return { primary_artists: artists.rows.map((r) => r.name), credits: credits.rows };
}

// GET /api/releases/:id/contributors
async function getContributors(req, res) {
    try {
        const release = await ownedRelease(req, res, { requireDraft: false });
        if (!release) return;
        return res.json(await load(pool, release.id));
    } catch (err) {
        console.error('getContributors error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// PUT /api/releases/:id/contributors  { primary_artists: string[], credits: [{ track_number, name, title }] }
async function putContributors(req, res) {
    let client;
    try {
        const release = await ownedRelease(req, res, { requireDraft: true });
        if (!release) return;

        const { rows: tracks } = await pool.query('SELECT id, track_number FROM tracks WHERE release_id = $1', [release.id]);
        const parsed = parseContributors(req.body, tracks.map((t) => t.track_number));
        if (parsed.error) return res.status(400).json({ error: parsed.error });
        const idOf = new Map(tracks.map((t) => [t.track_number, t.id]));

        client = await pool.connect();
        await client.query('BEGIN');
        await client.query('DELETE FROM release_artists WHERE release_id = $1', [release.id]);
        await client.query('DELETE FROM release_credits WHERE release_id = $1', [release.id]);
        if (parsed.artists.length) {
            await client.query(
                `INSERT INTO release_artists (release_id, position, name)
                 SELECT $1, ord::int, name FROM unnest($2::text[]) WITH ORDINALITY AS t(name, ord)`,
                [release.id, parsed.artists]);
        }
        if (parsed.credits.length) {
            await client.query(
                `INSERT INTO release_credits (release_id, track_id, position, name, title)
                 SELECT $1, track_id, ord::int, name, title
                 FROM unnest($2::uuid[], $3::text[], $4::text[]) WITH ORDINALITY AS t(track_id, name, title, ord)`,
                [release.id, parsed.credits.map((c) => (c.track_number === null ? null : idOf.get(c.track_number))),
                 parsed.credits.map((c) => c.name), parsed.credits.map((c) => c.title)]);
        }
        const saved = await load(client, release.id);
        await client.query('COMMIT');
        return res.json(saved);
    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('putContributors error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
}

module.exports = { getContributors, putContributors };
