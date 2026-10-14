const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads'));
const KEY_RE = /^[a-z]+\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/;

function resolveKey(key) {
    if (!KEY_RE.test(key)) throw new Error('Invalid storage key');
    const full = path.join(ROOT, key);
    if (!full.startsWith(ROOT + path.sep)) throw new Error('Invalid storage key');
    return full;
}

const newKey = (prefix, ext) => `${prefix}/${crypto.randomUUID()}.${ext}`;

async function put(key, buffer) {
    const full = resolveKey(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    const tmp = `${full}.part`;
    await fs.writeFile(tmp, buffer); 
    await fs.rename(tmp, full);
}

const get = (key) => fs.readFile(resolveKey(key));

async function del(key) {
    try { await fs.unlink(resolveKey(key)); }
    catch (e) { if (e.code !== 'ENOENT') console.error('storage delete failed:', key, e.message); }
}

module.exports = { put, get, delete: del, newKey, ROOT };