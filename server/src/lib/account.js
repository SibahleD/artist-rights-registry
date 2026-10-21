// Pure rules for the Settings endpoints, kept free of the database so they can be unit tested.

const THEMES = ['system', 'light', 'dark'];

// The only keys allowed in users.preferences, each with its validator and default.
const PREFERENCE_KEYS = {
    theme: { check: (v) => THEMES.includes(v), def: 'system', msg: `Theme must be one of: ${THEMES.join(', ')}.` },
    analytics_opt_in: { check: (v) => typeof v === 'boolean', def: false, msg: 'Analytics must be on or off.' },
    play_counts_opt_in: { check: (v) => typeof v === 'boolean', def: false, msg: 'Play counts must be on or off.' },
    notify_disputes: { check: (v) => typeof v === 'boolean', def: true, msg: 'Dispute emails must be on or off.' },
    notify_approvals: { check: (v) => typeof v === 'boolean', def: true, msg: 'Approval emails must be on or off.' },
};

function validatePreferences(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Preferences must be an object.' };
    const out = {};
    for (const [k, v] of Object.entries(body)) {
        const rule = PREFERENCE_KEYS[k];
        if (!rule) return { error: `Unknown preference: ${k}.` };
        if (!rule.check(v)) return { error: rule.msg };
        out[k] = v;
    }
    if (Object.keys(out).length === 0) return { error: 'No preferences provided.' };
    return { value: out };
}

// Stored values merged over defaults, so the client always gets every key.
function withDefaults(stored) {
    const out = {};
    for (const [k, rule] of Object.entries(PREFERENCE_KEYS)) {
        out[k] = stored && rule.check(stored[k]) ? stored[k] : rule.def;
    }
    return out;
}

// Same rules as registration (bcrypt only reads the first 72 bytes).
function validateNewPassword(pw) {
    if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least eight (8) characters.';
    if (Buffer.byteLength(pw, 'utf8') > 72) return 'Password must be at most 72 bytes.';
    return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function normaliseEmail(v) {
    const e = typeof v === 'string' ? v.trim().toLowerCase() : '';
    if (!e || e.length > 254 || !EMAIL_RE.test(e)) return null;
    return e;
}

// A tokens issued before the last password change are rejected. iat is whole seconds.
const tokenPredatesPasswordChange = (iat, changedAt) =>
    !!changedAt && typeof iat === 'number' && iat < Math.floor(new Date(changedAt).getTime() / 1000);

// "Jean Claude Van Damme" -> first "Jean Claude Van", last "Damme". One word goes to first_name only.
function splitLegalName(v) {
    const t = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
    if (!t) return { first: null, last: null };
    const i = t.lastIndexOf(' ');
    return i < 0 ? { first: t, last: null } : { first: t.slice(0, i), last: t.slice(i + 1) };
}

module.exports = { splitLegalName, THEMES, PREFERENCE_KEYS, validatePreferences, withDefaults, validateNewPassword, normaliseEmail, tokenPredatesPasswordChange };
