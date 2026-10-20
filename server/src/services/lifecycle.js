const pool = require('../db/pool');
const limits = require('../limits');

const STORE_MAX = 60;
const URL_MAX = 500;

function parseLinks(input) {
    const max = limits.enabled ? limits.maxReleaseLinks : 1000;
    if (!Array.isArray(input) || input.length === 0) return { error: 'Add at least one store link.' };
    if (input.length > max) return { error: `A release can have at most ${max} store links.` };

    const links = [];
    const seen = new Set();
    for (const [i, l] of input.entries()) {
        const n = i + 1;
        const store = typeof l?.store === 'string' ? l.store.trim() : '';
        const url = typeof l?.url === 'string' ? l.url.trim() : '';
        if (!store || store.length > STORE_MAX) return { error: `Link ${n}: enter the store name (up to ${STORE_MAX} characters).` };
        let ok = url.length > 0 && url.length <= URL_MAX;
        if (ok) {
            try { ok = ['http:', 'https:'].includes(new URL(url).protocol) && /^https?:\/\//i.test(url); } catch { ok = false; }
        }
        if (!ok) return { error: `Link ${n}: enter the full web address, starting with https:// (up to ${URL_MAX} characters).` };
        if (seen.has(url.toLowerCase())) return { error: `Link ${n}: the same address is listed twice.` };
        seen.add(url.toLowerCase());
        links.push({ store, url });
    }
    return { links };
}

async function setReleased(releaseId, input) {
    const parsed = parseLinks(input);
    if (parsed.error) return { status: 400, error: parsed.error };

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query('SELECT status FROM releases WHERE id = $1 FOR UPDATE', [releaseId]);
        if (!rows[0]) { await client.query('ROLLBACK'); return { status: 404, error: 'Release not found.' }; }
        if (rows[0].status !== 'ready') {
            await client.query('ROLLBACK');
            return { status: 409, error: 'Only releases marked ready can be marked as released.' };
        }
        await client.query('DELETE FROM release_links WHERE release_id = $1', [releaseId]);
        for (const l of parsed.links) {
            await client.query(
                `INSERT INTO release_links (release_id, store, url, created_at) VALUES ($1, $2, $3, clock_timestamp())`,
                [releaseId, l.store, l.url]);
        }
        const { rows: out } = await client.query(
            `UPDATE releases SET released_at = COALESCE(released_at, now()) WHERE id = $1 RETURNING released_at`, [releaseId]);
        await client.query('COMMIT');
        return { ok: true, released_at: out[0].released_at, links: parsed.links };
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

async function clearReleased(releaseId) {
    const { rowCount } = await pool.query(
        'UPDATE releases SET released_at = NULL WHERE id = $1 AND released_at IS NOT NULL', [releaseId]);
    return rowCount === 1
        ? { ok: true }
        : { status: 409, error: 'This release is not marked as released.' };
}

async function listLinks(releaseId) {
    const { rows } = await pool.query(
        'SELECT store, url FROM release_links WHERE release_id = $1 ORDER BY created_at, id', [releaseId]);
    return rows;
}

module.exports = { setReleased, clearReleased, listLinks, parseLinks };
