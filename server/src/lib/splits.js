const { WRITER_STATUSES, optionalIpi, optionalName } = require('./codes');

const ROLES = ['composer', 'songwriter', 'lyricist', 'arranger', 'publisher', 'producer', 'performer', 'other'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCollaborators(body, existingRemoved = []) {
    const list = body && body.collaborators;
    if (!Array.isArray(list) || list.length === 0 || list.length > 50) {
        return { error: 'collaborators must be a list of 1 to 50 entries.' };
    }

    const data = [];
    const seenEmails = new Set();
    const seenNames = new Set();
    const discardIds = new Set();
    let totalCents = 0;

    for (const [i, c] of list.entries()) {
        const n = i + 1;
        if (!c || typeof c !== 'object') return { error: `Collaborator ${n} is invalid.` };

        if (c.removedByWriter === true) {
            if (c.discard === true && typeof c.id === 'string') discardIds.add(c.id);
            continue;
        }

        const legalName = typeof c.legalName === 'string' ? c.legalName.trim() : '';
        if (!legalName || legalName.length > 200) {
            return { error: `Collaborator ${n}: legal name is required (max 200 characters).` };
        }

        const role = c.role === undefined ? 'songwriter' : c.role;
        if (!ROLES.includes(role)) {
            return { error: `Collaborator ${n}: role must be one of: ${ROLES.join(', ')}.` };
        }

        const isFeatured = c.isFeatured === true;
        if (isFeatured && role !== 'performer') {
            return { error: `Collaborator ${n}: a featured artist must have the role performer.` };
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

        const ipi = optionalIpi(`Collaborator ${n}: IPI`)(c.ipi);
        if (ipi.error) return { error: ipi.error };

        let writerStatus = null;
        if (c.writerStatus !== undefined && c.writerStatus !== null && c.writerStatus !== '') {
            if (!WRITER_STATUSES.includes(c.writerStatus)) {
                return { error: `Collaborator ${n}: writer status must be one of: ${WRITER_STATUSES.join(', ')}.` };
            }
            writerStatus = c.writerStatus;
        }

        const isSelfPublished = c.isSelfPublished === true;
        const pub = optionalName(`Collaborator ${n}: publisher name`, 200)(c.publisherName);
        if (pub.error) return { error: pub.error };
        if (isSelfPublished && pub.value) {
            return { error: `Collaborator ${n}: choose either self-published or a publisher name, not both.` };
        }

        const nameKey = legalName.toLowerCase();
        if (seenNames.has(nameKey) || (email && seenEmails.has(email))) {
            return { error: `Collaborator ${n}: each person can only appear once per track. Combine their share into one entry.` };
        }
        seenNames.add(nameKey);
        if (email) seenEmails.add(email);

        totalCents += cents;
        data.push({ legalName, role, percent: cents / 100, email, ipi: ipi.value, writerStatus, publisherName: pub.value, isSelfPublished, isFeatured });
    }

    const lockedCents = existingRemoved
        .filter((r) => !discardIds.has(r.id))
        .reduce((sum, r) => sum + r.cents, 0);
    const keepIds = existingRemoved.filter((r) => !discardIds.has(r.id)).map((r) => r.id);
    const expected = 10000 - lockedCents;
    if (totalCents !== expected) {
        const note = lockedCents ? ` (${lockedCents / 100}% is held by a removed co-writer)` : '';
        return { error: `Splits must total exactly 100%${note}. Your lines total ${totalCents / 100}%, they should total ${expected / 100}%.` };
    }
    return { data, discardIds: [...discardIds], keepIds };
}

module.exports = { ROLES, parseCollaborators };