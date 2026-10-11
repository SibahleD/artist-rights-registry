async function sendMail({ to, subject, text }) {
    const transport = process.env.MAIL_TRANSPORT || 'console';

    if (transport === 'console') {
        console.log(`\n--- EMAIL (console transport) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n--- END EMAIL ---\n`);
        return;
    }
    throw new Error(`Unknown MAIL_TRANSPORT: ${transport}`);
}

module.exports = { sendMail };