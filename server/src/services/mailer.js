const outbox = [];

// Problems with the mail settings, as plain sentences. Empty list means the settings are usable.
// Production must use a real transport: the console transport prints reset and verification links into the server log.
// The transport name is case-insensitive, so MAIL_TRANSPORT=SMTP works the same as smtp.
const transportOf = (env) => String(env.MAIL_TRANSPORT || 'console').trim().toLowerCase();

function mailConfigProblems(env = process.env) {
    const transport = transportOf(env);
    const problems = [];
    if (transport === 'console') {
        if (env.NODE_ENV === 'production') problems.push('MAIL_TRANSPORT is "console" in production. Password reset and verification emails would only be printed to the log. Set MAIL_TRANSPORT=smtp.');
        return problems;
    }
    if (transport !== 'smtp') return [`Unknown MAIL_TRANSPORT: ${transport}. Use "console" or "smtp".`];
    for (const k of ['SMTP_HOST', 'MAIL_FROM']) {
        if (!env[k]) problems.push(`${k} is required when MAIL_TRANSPORT=smtp.`);
    }
    // The login is optional (a local catcher such as Mailpit takes none), but half a login is a mistake.
    if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASS)) {
        problems.push('Set both SMTP_USER and SMTP_PASS, or leave both empty for a server that needs no login.');
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
        // No auth block at all when there is no login, so nodemailer does not attempt AUTH.
        ...(env.SMTP_USER && env.SMTP_PASS ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
        connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    });
    // Line breaks in a subject could be used to inject headers, so they are flattened.
    return ({ to, subject, text }) => transporter.sendMail({
        from: env.MAIL_FROM, to, subject: String(subject).replace(/[\r\n]+/g, ' '), text,
    });
}

let smtpSender = null;

async function sendMail({ to, subject, text }) {
    const transport = transportOf(process.env);

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

module.exports = { sendMail, getOutbox, mailConfigProblems, createSmtpSender };
