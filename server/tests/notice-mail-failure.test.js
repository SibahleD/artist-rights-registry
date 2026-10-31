// Co-writer splits and invitation emails, checked without a database or a mail server:
// the pool and the mailer are replaced with fakes before the controllers load.
process.env.EMAIL_HASH_KEY = 'test-key';
process.env.APP_URL = 'https://example.test/app';
process.env.DATABASE_URL = 'postgres://unused';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const src = (p) => path.join(__dirname, '..', 'src', p);
const fake = (p, exports) => { require.cache[require.resolve(src(p))] = { id: p, filename: src(p), loaded: true, exports }; };

let queries, handler, mailFails, sent;
const client = { query: async (sql, params) => { queries.push(sql.trim().split('\n')[0]); return handler(sql, params || []); }, release() {} };
fake('db/pool.js', { connect: async () => client, query: (s, p) => client.query(s, p), on() {} });
fake('services/mailer.js', {
    mailConfigProblems: () => [],
    sendMail: async (m) => { if (mailFails) throw new Error('535 Authentication failed'); sent.push(m); },
});

const { replaceCollaborators } = require(src('controllers/collaboratorController'));
const { sendNotices } = require(src('controllers/noticesController'));
const { emailHash } = require(src('services/notices'));

const res = () => { const r = { code: 200, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; }, end() { return r; } }; return r; };

test('saving splits with a co-writer email without EMAIL_HASH_KEY gives a readable error and saves nothing', async () => {
    queries = [];
    handler = (sql) => (/FOR UPDATE OF t/.test(sql) ? { rows: [{ id: 't1', status: 'draft' }] } : { rows: [] });
    const key = process.env.EMAIL_HASH_KEY; delete process.env.EMAIL_HASH_KEY;
    try {
        const r = res();
        await replaceCollaborators({
            params: { trackId: 't1', releaseId: 'r1' }, user: { id: 'u1' },
            body: { collaborators: [
                { legalName: 'Owner', role: 'songwriter', ownershipPercent: 50 },
                { legalName: 'Co Writer', role: 'songwriter', ownershipPercent: 50, invitedEmail: 'co@example.com' },
            ] },
        }, r);
        assert.equal(r.code, 500);
        assert.match(r.body.error, /EMAIL_HASH_KEY/);
        assert.ok(queries.includes('ROLLBACK') && !queries.includes('COMMIT'));
    } finally { process.env.EMAIL_HASH_KEY = key; }
});

function noticeHandler(state) {
    return (sql) => {
        if (/FROM releases WHERE id/.test(sql)) return { rows: [{ id: 'r1', title: 'My EP' }] };
        if (/FROM collaborators c JOIN tracks t/.test(sql)) return { rows: [{ track_id: 't1', track_title: 'Song', legal_name: 'Co Writer', invited_email: 'co@example.com', role: 'songwriter', ownership_percent: '50.00' }] };
        if (/SELECT n\.\* FROM collaborator_notices/.test(sql)) return { rows: state.notice ? [state.notice] : [] };
        if (/count\(\*\)/.test(sql)) return { rows: [{ n: 0 }] };
        if (/INSERT INTO collaborator_notices/.test(sql)) state.notice = { id: 'n1', track_id: 't1', email_hash: emailHash('co@example.com'), role: 'songwriter', share_percent: '50.00', status: 'pending' };
        if (/DELETE FROM collaborator_notices/.test(sql)) state.notice = null;
        return { rows: [] };
    };
}
const noticeReq = { params: { id: 'r1' }, user: { id: 'u1', email: 'owner@example.com', artistName: 'Ada' } };

test('an invitation email that cannot be sent is reported, and can be sent again', async () => {
    const state = {}; queries = []; sent = []; handler = noticeHandler(state);

    mailFails = true;
    let r = res(); await sendNotices(noticeReq, r);
    assert.equal(r.body.results[0].action, 'email_failed');
    assert.equal(state.notice, null, 'the undelivered notice is cleared');

    mailFails = false;
    r = res(); await sendNotices(noticeReq, r);
    assert.equal(r.body.results[0].action, 'sent');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'co@example.com');
    assert.match(sent[0].text, /https:\/\/example\.test\/app\/notice\//);
});
