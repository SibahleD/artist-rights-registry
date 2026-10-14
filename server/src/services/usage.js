const limits = require('../limits');

const humanMB = (b) => `${(b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 1 : 0)} MB`;

async function userBytes(db, userId) {
    const { rows } = await db.query(
        `SELECT (SELECT COALESCE(SUM(size_bytes), 0) FROM audio_files WHERE owner_id = $1)
              + (SELECT COALESCE(SUM(size_bytes), 0) FROM media WHERE owner_id = $1) AS n`, [userId]);
    return Number(rows[0].n);
}

async function platformBytes(db) {
    const { rows } = await db.query(
        `SELECT (SELECT COALESCE(SUM(size_bytes), 0) FROM audio_files)
              + (SELECT COALESCE(SUM(size_bytes), 0) FROM media) AS n`);
    return Number(rows[0].n);
}

async function assertRoom(db, userId, addBytes, replacedBytes = 0) {
    if (!limits.enabled) return;
    const mine = (await userBytes(db, userId)) - replacedBytes + addBytes;
    if (mine > limits.maxUserBytes) {
        throw { status: 413, message: `That would take you to ${humanMB(mine)}. The test limit is ${humanMB(limits.maxUserBytes)} of files per artist. Remove a file you no longer need and try again.` };
    }
    const all = (await platformBytes(db)) - replacedBytes + addBytes;
    if (all > limits.maxPlatformBytes) {
        throw { status: 507, message: 'The test platform is full right now, so new files cannot be added. Please tell the team.' };
    }
}

module.exports = { userBytes, platformBytes, assertRoom, humanMB };