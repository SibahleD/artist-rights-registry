const PLATFORM = process.env.PLATFORM_NAME || 'Artist Rights Registry';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const RWANDA_LINK = process.env.RWANDA_GUIDE_URL || `${APP_URL}/info`;
const LEARN_LINK = process.env.LEARN_URL || `${APP_URL}/info`;
const RETENTION = process.env.NOTICE_RETENTION_TEXT || 'while this song is on the platform';
const EXPIRY_DAYS = Number(process.env.NOTICE_EXPIRY_DAYS) || 14;

const SHARE_ROLES = ['composer', 'songwriter', 'publisher'];  

module.exports = ({ kind, artistName, coWriterName, role, trackTitle, releaseTitle, sharePercent, link }) => {
    const withShare = SHARE_ROLES.includes(role);
    const prefix = { new: '', updated: 'Updated: ', reminder: 'Reminder: ' }[kind];
    const intro = {
        new: `${artistName} has credited you as ${role} on a track, using ${PLATFORM}, a platform that helps independent artists prepare their music information.`,
        updated: `${artistName} has changed your credit on a track in ${PLATFORM}. Please review it again.`,
        reminder: `This is a reminder about a credit ${artistName} listed for you in ${PLATFORM}. This link replaces the one in the first email, which no longer works.`,
    }[kind];

    const lines = [
        `Hi ${coWriterName},`, '', intro, '',
        "What's been listed for you",
        `- Track: ${trackTitle} (from the release "${releaseTitle}")`,
        `- Your credit: ${role}`,
        ...(withShare ? [`- Your share of the song: ${sharePercent}%`] : []),
        '',
        'Please review and respond (about two minutes, no account needed):',
        link, '',
        'On that page you can choose one of three things:',
        `1. This is right, and I'm happy for ${PLATFORM} to keep my details.`,
        '2. Something isn\'t right.',
        '3. Remove my details.', '',
        'Your information and your choice',
        `To show your credit, we keep your name, email, ${withShare ? 'role and share' : 'and role'} for this ${withShare ? 'song' : 'release'}${withShare ? ', and your IPI number if ' + artistName + ' has entered one for you' : ''}. ${artistName} and the other credited people can see your name and role${withShare ? ' and share' : ''}. When ${artistName} releases or registers the music, they may give your credit to distributors${withShare ? ' and royalty organizations' : ''}. We don't send it to anyone ourselves. We never ask for bank details, ID or passwords, and we don't send marketing. We keep your details ${RETENTION}, and you can withdraw at any time using the link in any of our emails.`,
        '',
        `By choosing option 1, you agree to us keeping these details for this purpose. It's your choice, and you can say no.`,
        '',
        `If you remove your details, you'll no longer appear in this ${withShare ? "song's" : "release's"} information on the platform, and ${artistName} will be asked to sort out ${withShare ? 'your share' : 'your credit'}. You may not be included when the music is released or registered through this platform, which could affect whether you receive royalties. If you're unsure, talk to ${artistName} first about how you want to be credited.`,
        '',
        `If we don't hear from you within ${EXPIRY_DAYS} days, we'll delete your email address.`,
        '',
    ];

    if (withShare) {
        lines.push(
            'What this means',
            `A songwriter share tells royalty organizations who should be paid when a song is played. The share above is a record of what ${artistName} says you've agreed. It isn't a payment and doesn't guarantee any income. ${PLATFORM} doesn't register songs or send anything to any organization.`,
            '',
            'Getting paid: what you may need to do',
            "Songwriter royalties aren't collected automatically. Each writer collects their own share by being registered with a royalty organization (called a PRO or CMO), or through a publishing administrator. If you're already registered, make sure this song is registered under your name with the right share. If you're not registered, or you're not sure, these are the main routes:",
            `- Join a royalty organization. These collect when songs are played on radio, TV, in venues and online, and pass the money to their members. Some overseas organizations accept members from other countries and some don't, and fees and rules differ. Rwanda's own system is in transition, so check what's currently available: ${RWANDA_LINK}`,
            '- Use a publishing administrator. These companies register your songs and collect for you, usually for a commission. Compare commissions and terms before you sign.',
            `- Make a written agreement with ${artistName} or a publisher if you've agreed they'll collect for you, or if you've sold your share. Keep a copy. A lawyer or a local musicians' association can help.`,
            `- If you also performed or produced the recording, the recording earns different royalties, handled by other organizations. Our guide explains the difference: ${LEARN_LINK}`,
            '',
            'Questions worth asking any organization before you join',
            '- Do you accept members from my country?',
            '- What does it cost to join, and what share do you keep?',
            '- How do you pay me, in which currency, and how long does it take?',
            '- Can I register songs released before I joined?',
            '',
            "Good to know: you don't have to join before the song is released, but you can't collect your share until you're registered, so sooner is better. Some organizations pay for past use, but time limits vary.",
            ''
        );
    } else {
        lines.push(`If you want to know how recordings and performances can earn royalties, our guide explains: ${LEARN_LINK}`, '');
    }

    lines.push(
        `${PLATFORM} is a university project (a prototype). It doesn't collect or pay royalties or give legal advice. This email is general guidance only, and rules differ by organization and country.`,
        '', 'Thanks,', `The ${PLATFORM} team`, '',
        `You received this because ${artistName} entered your email address. This is a one-time notification with at most one reminder.`
    );

    return { subject: `${prefix}${artistName} has credited you on "${trackTitle}"`, text: lines.join('\n') };
};