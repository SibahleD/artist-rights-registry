const outbox = [];
 
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
    throw new Error(`Unknown MAIL_TRANSPORT: ${transport}`);
}
 
const getOutbox = () => outbox;
 
module.exports = { sendMail, getOutbox };
