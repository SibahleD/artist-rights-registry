const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

// Files (audio) live in Supabase Storage when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set,
// and on local disk otherwise (development). Netlify functions have no writable disk.
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = process.env.SUPABASE_BUCKET || 'uploads';
const useSupabase = Boolean(SB_URL && SB_KEY);

const ROOT = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads'));
const KEY_RE = /^[a-z]+\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/;

function checkKey(key) {
    if (!KEY_RE.test(key)) throw new Error('Invalid storage key');
    return key;
}

function resolveKey(key) {
    checkKey(key);
    const full = path.join(ROOT, key);
    if (!full.startsWith(ROOT + path.sep)) throw new Error('Invalid storage key');
    return full;
}

const newKey = (prefix, ext) => `${prefix}/${crypto.randomUUID()}.${ext}`;

const sbHeaders = (extra = {}) => ({ Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY, ...extra });
const sbObject = (key) => `${SB_URL}/storage/v1/object/${BUCKET}/${checkKey(key)}`;

async function sbFail(res, what) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase storage ${what} failed (${res.status}): ${text.slice(0, 200)}`);
}

async function put(key, buffer) {
    if (useSupabase) {
        const res = await fetch(sbObject(key), {
            method: 'POST',
            headers: sbHeaders({ 'Content-Type': 'application/octet-stream', 'x-upsert': 'true' }),
            body: buffer,
        });
        if (!res.ok) await sbFail(res, 'upload');
        return;
    }
    const full = resolveKey(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    const tmp = `${full}.part`;
    await fs.writeFile(tmp, buffer);
    await fs.rename(tmp, full);
}

// Signed URLs let the browser talk to the bucket directly, so audio never passes through the Netlify Function
// (which caps request and response bodies at about 6 MB). Both return null when Supabase is not configured.
async function signUpload(key) {
    if (!useSupabase) return null;
    const res = await fetch(`${SB_URL}/storage/v1/object/upload/sign/${BUCKET}/${checkKey(key)}`, {
        method: 'POST', headers: sbHeaders({ 'Content-Type': 'application/json' }), body: '{}',
    });
    if (!res.ok) await sbFail(res, 'sign upload');
    const data = await res.json();
    return { url: `${SB_URL}/storage/v1${data.url}` };
}

async function signDownload(key, expiresIn = 3600) {
    if (!useSupabase) return null;
    const res = await fetch(`${SB_URL}/storage/v1/object/sign/${BUCKET}/${checkKey(key)}`, {
        method: 'POST', headers: sbHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ expiresIn }),
    });
    if (!res.ok) await sbFail(res, 'sign download');
    const data = await res.json();
    return `${SB_URL}/storage/v1${data.signedURL}`;
}

async function get(key) {
    if (useSupabase) {
        const res = await fetch(sbObject(key), { headers: sbHeaders() });
        if (!res.ok) await sbFail(res, 'download');
        return Buffer.from(await res.arrayBuffer());
    }
    return fs.readFile(resolveKey(key));
}

async function del(key) {
    if (useSupabase) {
        try {
            const res = await fetch(sbObject(key), { method: 'DELETE', headers: sbHeaders() });
            if (!res.ok && res.status !== 404) console.error('storage delete failed:', key, res.status);
        } catch (e) { console.error('storage delete failed:', key, e.message); }
        return;
    }
    try { await fs.unlink(resolveKey(key)); }
    catch (e) { if (e.code !== 'ENOENT') console.error('storage delete failed:', key, e.message); }
}

module.exports = { put, get, delete: del, newKey, signUpload, signDownload, isRemote: useSupabase, ROOT };
