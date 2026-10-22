// Validation for the artist's own society registrations. Pure, so it is tested without a database.
const STATUSES = ['planned', 'applied', 'registered'];
const COUNTRY_RE = /^(?:[A-Z]{2}|INT)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isoToday = (now) => now.toISOString().slice(0, 10);

function validDate(s) {
    if (!DATE_RE.test(s)) return false;
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// body: the request. existing: the stored row when updating. On update only the status, the date and the member
// number can change; the body and country are what the row is about, so they stay as created.
// Returns { error } or { society: { body_name, country, status, registered_on, member_ref } }.
function parseSocietyInput(body, existing, now = new Date()) {
    const b = body && typeof body === 'object' ? body : {};
    const has = (k) => Object.prototype.hasOwnProperty.call(b, k);

    let bodyName = existing?.body_name;
    let country = existing?.country;
    if (!existing) {
        bodyName = typeof b.body_name === 'string' ? b.body_name.trim() : '';
        if (!bodyName || bodyName.length > 120) return { error: 'Enter the name of the society (up to 120 characters).' };
        country = typeof b.country === 'string' ? b.country.trim().toUpperCase() : '';
        if (!COUNTRY_RE.test(country)) return { error: 'Choose the country of the society, or International.' };
    }

    const status = has('status') ? b.status : existing?.status ?? 'planned';
    if (!STATUSES.includes(status)) return { error: 'Status must be planned, applied or registered.' };

    let registeredOn = has('registered_on') ? b.registered_on : existing?.registered_on ?? null;
    if (registeredOn === '' || registeredOn === undefined) registeredOn = null;
    if (registeredOn !== null) {
        if (typeof registeredOn !== 'string' || !validDate(registeredOn)) return { error: 'Enter the registration date as a real date.' };
        if (registeredOn > isoToday(now)) return { error: 'The registration date cannot be in the future.' };
    }
    if (status !== 'registered') registeredOn = null; // a date only means something once registered

    let memberRef = has('member_ref') ? b.member_ref : existing?.member_ref ?? null;
    if (memberRef === '' || memberRef === undefined) memberRef = null;
    if (memberRef !== null) {
        if (typeof memberRef !== 'string') return { error: 'The member number must be text.' };
        memberRef = memberRef.trim();
        if (memberRef.length > 100 || /[\u0000-\u001f\u007f]/.test(memberRef)) return { error: 'The member number is too long or has odd characters (100 characters at most).' };
        if (memberRef === '') memberRef = null;
    }

    return { society: { body_name: bodyName, country, status, registered_on: registeredOn, member_ref: memberRef } };
}

module.exports = { STATUSES, parseSocietyInput };
