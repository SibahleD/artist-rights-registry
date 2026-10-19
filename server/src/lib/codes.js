// Shared field checks. Each returns { value } or { error }, like the validators in the controllers.

const WRITER_STATUSES = ['joined', 'not_joined', 'has_administrator', 'authorized_artist', 'bought_out', 'unknown'];

// IPI / CAE name numbers are 9 to 11 digits. People paste them with spaces or dots, so strip those.
function optionalIpi(label = 'IPI') {
    return (v) => {
        if (v === null || v === undefined || v === '') return { value: null };
        const s = typeof v === 'string' ? v.replace(/[\s.\-]/g, '') : '';
        if (!/^[0-9]{9,11}$/.test(s)) return { error: `${label} must be 9 to 11 digits.` };
        return { value: s };
    };
}

// Two or three lowercase letters, e.g. en, fr, rw, sw, yo (ISO 639).
function optionalLanguage(label = 'Language') {
    return (v) => {
        if (v === null || v === undefined || v === '') return { value: null };
        const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
        if (!/^[a-z]{2,3}$/.test(s)) return { error: `${label} must be a 2 or 3 letter language code, like en, fr or rw.` };
        return { value: s };
    };
}

// Two uppercase letters (ISO 3166-1 alpha-2), e.g. RW, NG, KE.
function optionalCountry(label = 'Country') {
    return (v) => {
        if (v === null || v === undefined || v === '') return { value: null };
        const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
        if (!/^[A-Z]{2}$/.test(s)) return { error: `${label} must be a 2 letter country code, like RW or NG.` };
        return { value: s };
    };
}

function optionalName(label, max) {
    return (v) => {
        if (v === null || v === undefined || v === '') return { value: null };
        if (typeof v !== 'string') return { error: `${label} must be a string.` };
        const t = v.trim();
        if (t.length > max) return { error: `${label} must be at most ${max} characters.` };
        return { value: t || null };
    };
}

module.exports = { WRITER_STATUSES, optionalIpi, optionalLanguage, optionalCountry, optionalName };
