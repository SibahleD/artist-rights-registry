const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sendOptionalMail, getOutbox } = require('../src/services/mailer');

process.env.MAIL_TRANSPORT = 'console';
process.env.DEV_OUTBOX = 'true';
const msg = { to: 'a@example.com', subject: 'Split disputed', text: 'body' };

test('sendOptionalMail: skipped by default, sent once opted in', async () => {
    const log = console.log; console.log = () => {};
    try {
        const before = getOutbox().length;
        assert.equal(await sendOptionalMail({ preferences: {}, kind: 'disputes', ...msg }), false);
        assert.equal(await sendOptionalMail({ preferences: { notify_disputes: true }, kind: 'disputes', ...msg }), false);
        assert.equal(getOutbox().length, before);
        assert.equal(await sendOptionalMail({ preferences: { notify_emails: true }, kind: 'disputes', ...msg }), true);
        assert.equal(getOutbox().length, before + 1);
    } finally { console.log = log; }
});
