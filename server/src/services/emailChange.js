const PLATFORM = process.env.PLATFORM_NAME || 'Track Record';

const confirmEmailChangeMessage = ({ artistName, link }) => ({
    subject: `Confirm your new email for ${PLATFORM}`,
    text: [
        `Hi ${artistName},`,
        '',
        `Someone (hopefully you) asked to use this address as the sign-in email for ${PLATFORM}. To confirm the change, open:`,
        link,
        '',
        'Until you do, your old address keeps working. This link expires in 24 hours. If you did not ask for this, ignore this email and nothing will change.',
        '',
    ].join('\n'),
});

const emailChangedMessage = ({ artistName, newEmail }) => ({
    subject: `Your ${PLATFORM} email was changed`,
    text: [
        `Hi ${artistName},`,
        '',
        `The sign-in email for your ${PLATFORM} account was changed to ${newEmail}.`,
        'If this was not you, contact the team straight away.',
        '',
    ].join('\n'),
});

module.exports = { confirmEmailChangeMessage, emailChangedMessage };
