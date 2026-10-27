const PLATFORM = process.env.PLATFORM_NAME || 'Track Record';

module.exports = ({ artistName, link }) => ({
    subject: `Confirm your email for ${PLATFORM}`,
    text: [
        `Hi ${artistName},`,
        '',
        `Please confirm your email address to finish setting up your ${PLATFORM} account:`,
        link,
        '',
        'This link expires in 24 hours. If you did not create an account, you can ignore this email.',
        '',
    ].join('\n'),
});