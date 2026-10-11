const crypto = require('crypto');

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

function newToken() {
    const raw = crypto.randomBytes(32).toString('base64url');
    return { raw, hash: hashToken(raw) };
}

module.exports = { newToken, hashToken };