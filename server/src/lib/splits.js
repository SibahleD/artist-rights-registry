
const ROLES = ['composer', 'songwriter', 'publisher', 'producer', 'performer', 'other'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCollaborators(body) {
    const list = body && body.collaborators;
    if (!Array.isArray(list) || list.length === 0 || list.length > 50) {
        return { error: 'collaborators must be a list of 1 to 50 entries.' };
    }

    const data = [];
    const seenEmails = new Set();
    const seenNames = new Set();
    let totalCents = 0;

    for (const [i, c] of list.entries()) {
        const n = i + 1;
        if (!c || typeof c !== 'object') return { error: `Collaborator ${n} is invalid.` };

        const legalName = typeof c.legalName === 'string' ? c.legalName.trim() : '';
        if (!legalName || legalName.length > 200) {
            return { error: `Collaborator ${n}: legal name is required (max 200 characters).` };
        }

        const role = c.role === undefined ? 'songwriter' : c.role;
        if (!ROLES.includes(role)) {
            return { error: `Collaborator ${n}: role must be one of: ${ROLES.join(', ')}.` };
        }

        const pct = c.ownershipPercent;
        if (typeof pct !== 'number' || !Number.isFinite(pct) || pct < 0 || pct > 100) {
            return { error: `Collaborator ${n}: ownership percent must be a number between 0 and 100.` };
        }
        const cents = Math.round(pct * 100);
        if (Math.abs(pct * 100 - cents) > 1e-6) {
            return { error: `Collaborator ${n}: ownership percent can have at most 2 decimals.` };
        }

        let email = null;
        if (c.invitedEmail !== undefined && c.invitedEmail !== null && c.invitedEmail !== '') {
            email = typeof c.invitedEmail === 'string' ? c.invitedEmail.trim().toLowerCase() : '';
            if (!EMAIL_RE.test(email) || email.length > 254) {
                return { error: `Collaborator ${n}: invalid email.` };
            }
        }

        const nameKey = legalName.toLowerCase();
        if (seenNames.has(nameKey) || (email && seenEmails.has(email))) {
            return { error: `Collaborator ${n}: each person can only appear once per track. Combine their share into one entry.` };
        }
        seenNames.add(nameKey);
        if (email) seenEmails.add(email);

        totalCents += cents;
        data.push({ legalName, role, percent: cents / 100, email });
    }

    if (totalCents !== 10000) {
        return { error: `Splits must total exactly 100% (currently ${totalCents / 100}%).` };
    }
    return { data };
}

module.exports = { ROLES, parseCollaborators };