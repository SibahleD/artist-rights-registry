const PLATFORM = process.env.PLATFORM_NAME || 'Track Record';

const passwordResetMessage = ({ artistName, link }) => ({
    subject: `Reset your ${PLATFORM} password`,
    text: [
        `Hi ${artistName},`,
        '',
        `Someone (hopefully you) asked to reset the password for your ${PLATFORM} account. To choose a new password, open:`,
        link,
        '',
        'This link expires in 1 hour and can be used once. If you did not ask for this, ignore this email and your password will stay as it is.',
        '',
    ].join('\n'),
});

const passwordChangedMessage = ({ artistName }) => ({
    subject: `Your ${PLATFORM} password was changed`,
    text: [
        `Hi ${artistName},`,
        '',
        `The password for your ${PLATFORM} account was just reset, and you were signed out on all devices.`,
        'If this was not you, contact the team straight away.',
        '',
    ].join('\n'),
});

module.exports = { passwordResetMessage, passwordChangedMessage };
