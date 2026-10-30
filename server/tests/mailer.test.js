const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mailConfigProblems, createSmtpSender } = require('../src/services/mailer');

const good = { MAIL_TRANSPORT: 'smtp', SMTP_HOST: 'smtp.example.com', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'Track Record <no-reply@example.com>' };

test('mail config: console is fine in development, refused in production', () => {
    assert.deepEqual(mailConfigProblems({}), []);
    assert.deepEqual(mailConfigProblems({ MAIL_TRANSPORT: 'console', NODE_ENV: 'development' }), []);
    assert.match(mailConfigProblems({ NODE_ENV: 'production' })[0], /production/);
});

test('mail config: smtp needs host and from address; the login is optional but never half', () => {
    assert.deepEqual(mailConfigProblems(good), []);
    assert.equal(mailConfigProblems({ MAIL_TRANSPORT: 'smtp' }).length, 2);
    const noLogin = { MAIL_TRANSPORT: 'smtp', SMTP_HOST: 'localhost', SMTP_PORT: '1025', MAIL_FROM: 'a@b.com' };
    assert.deepEqual(mailConfigProblems(noLogin), []);
    assert.match(mailConfigProblems({ ...noLogin, SMTP_USER: 'u' })[0], /both SMTP_USER and SMTP_PASS/);
    assert.match(mailConfigProblems({ ...noLogin, SMTP_PASS: 'p' })[0], /both SMTP_USER and SMTP_PASS/);
    assert.match(mailConfigProblems({ ...good, SMTP_PORT: 'abc' })[0], /SMTP_PORT/);
    assert.match(mailConfigProblems({ MAIL_TRANSPORT: 'sendgrid' })[0], /Unknown MAIL_TRANSPORT/);
});

test('mail config: the transport name ignores case and spaces', () => {
    assert.deepEqual(mailConfigProblems({ ...good, MAIL_TRANSPORT: 'SMTP' }), []);
    assert.deepEqual(mailConfigProblems({ ...good, MAIL_TRANSPORT: ' Smtp ' }), []);
    assert.deepEqual(mailConfigProblems({ MAIL_TRANSPORT: 'CONSOLE' }), []);
});

function fakeNodemailer() {
    const f = { opts: null, sent: [] };
    f.createTransport = (o) => { f.opts = o; return { sendMail: async (m) => { f.sent.push(m); } }; };
    return f;
}

test('smtp sender: port 587 uses STARTTLS, 465 uses implicit TLS, SMTP_SECURE overrides', () => {
    let f = fakeNodemailer(); createSmtpSender({ ...good }, f);
    assert.equal(f.opts.port, 587); assert.equal(f.opts.secure, false);
    f = fakeNodemailer(); createSmtpSender({ ...good, SMTP_PORT: '465' }, f);
    assert.equal(f.opts.secure, true);
    f = fakeNodemailer(); createSmtpSender({ ...good, SMTP_PORT: '2465', SMTP_SECURE: 'true' }, f);
    assert.equal(f.opts.secure, true);
});

test('smtp sender: sends from MAIL_FROM and flattens line breaks in the subject', async () => {
    const f = fakeNodemailer();
    await createSmtpSender(good, f)({ to: 'a@b.com', subject: 'Hi\r\nBcc: x@y.com', text: 'body' });
    assert.equal(f.sent[0].from, good.MAIL_FROM);
    assert.equal(f.sent[0].to, 'a@b.com');
    assert.ok(!/[\r\n]/.test(f.sent[0].subject));
});

test('smtp sender: no auth block without a login, one with a login', () => {
    let f = fakeNodemailer();
    createSmtpSender({ MAIL_TRANSPORT: 'smtp', SMTP_HOST: 'localhost', SMTP_PORT: '1025', MAIL_FROM: 'a@b.com' }, f);
    assert.ok(!('auth' in f.opts));
    f = fakeNodemailer(); createSmtpSender(good, f);
    assert.deepEqual(f.opts.auth, { user: 'u', pass: 'p' });
});
