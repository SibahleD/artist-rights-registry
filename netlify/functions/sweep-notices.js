const { sweepNotices } = require('../../server/src/services/notices');

exports.handler = async () => {
    try {
        await sweepNotices();
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    } catch (e) {
        console.error('sweep failed:', e);
        return { statusCode: 500, body: JSON.stringify({ error: 'sweep failed' }) };
    }
};

exports.config = { schedule: '0 * * * *' };