const { wantsOptionalEmail } = require('../lib/account');
const outbox = [];

// Problems with the mail settings, as plain sentences. Empty list means the settings are usable.
// Production must use a real transport: the console transport prints reset and verification links into the server log.
function mailConfigProblems(env = process.env) {
    const transport = env.MAIL_TRANSPORT || 'console';
    const problems = [];
    if (transport === 'console') {
        if (env.NODE_ENV === 'production' || env.NETLIFY || env.AWS_LAMBDA_FUNCTION_NAME) problems.push('MAIL_TRANSPORT is "console" in production. Password reset and verification emails would only be printed to the log. Set MAIL_TRANSPORT=smtp.');
        return problems;
    }
    if (transport !== 'smtp') return [`Unknown MAIL_TRANSPORT: ${transport}. Use "console" or "smtp".`];
    for (const k of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM']) {
        if (!env[k]) problems.push(`${k} is required when MAIL_TRANSPORT=smtp.`);
    }
    if (env.SMTP_PORT && !(Number.isInteger(Number(env.SMTP_PORT)) && Number(env.SMTP_PORT) > 0 && Number(env.SMTP_PORT) < 65536)) {
        problems.push('SMTP_PORT must be a port number such as 587 or 465.');
    }
    return problems;
}

// Builds the SMTP sender. `nodemailer` is a parameter so tests can pass a fake.
// Port 465 uses implicit TLS; other ports (587) start plain and upgrade with STARTTLS, which nodemailer does when offered.
function createSmtpSender(env, nodemailer) {
    const port = Number(env.SMTP_PORT || 587);
    const secure = env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465;
    const transporter = nodemailer.createTransport({
        host: env.SMTP_HOST, port, secure,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    });
    // Line breaks in a subject could be used to inject headers, so they are flattened.
    return ({ to, subject, text }) => transporter.sendMail({
        from: env.MAIL_FROM, to, subject: String(subject).replace(/[\r\n]+/g, ' '), text,
    });
}

let smtpSender = null;

async function sendMail({ to, subject, text }) {
    const transport = process.env.MAIL_TRANSPORT || 'console';

    if (transport === 'console') {
        console.log(`\n--- EMAIL (console transport) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n--- END EMAIL ---\n`);
        if (process.env.DEV_OUTBOX === 'true') {      // dev only
            outbox.unshift({ to, subject, text, at: new Date().toISOString() });
            outbox.length = Math.min(outbox.length, 50);
        }
        return;
    }
    if (transport === 'smtp') {
        if (!smtpSender) {
            const problems = mailConfigProblems();
            if (problems.length) throw new Error(problems.join(' '));
            let nodemailer;
            try { nodemailer = require('nodemailer'); }
            catch { throw new Error('MAIL_TRANSPORT=smtp needs the nodemailer package. Run: npm install nodemailer'); }
            smtpSender = createSmtpSender(process.env, nodemailer);
        }
        await smtpSender({ to, subject, text });
        return;
    }
    throw new Error(`Unknown MAIL_TRANSPORT: ${transport}`);
}

const getOutbox = () => outbox;

// For optional notifications to an artist. Sends only if the artist has opted in (see wantsOptionalEmail).
// Returns true if the mail was handed to the transport, false if skipped. Never use for security emails.
async function sendOptionalMail({ preferences, kind, to, subject, text }) {
    if (!wantsOptionalEmail(preferences, kind)) return false;
    await sendMail({ to, subject, text });
    return true;
}

module.exports = { sendMail, sendOptionalMail, getOutbox, mailConfigProblems, createSmtpSender };
