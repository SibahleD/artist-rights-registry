// Validation for stream figures coming in from the CSV importer.
//
// The client maps the CSV's columns and sends plain rows: { isrc, platform, period, streams }.
// Everything is checked again here because the client is not trusted. Rows that fail are skipped with a
// reason (shown to the artist) rather than failing the whole import. Rows that share an ISRC, platform and
// month are added together, because distributor exports often list one row per country or per day.

const ISRC_RE = /^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/;
const PLATFORM_RE = /^[a-z0-9_]{1,40}$/;

const MAX_ROWS = 20000;
const MAX_STREAMS = 1e12;
const MAX_SKIPPED_SHOWN = 25;

function normalizeIsrc(v) {
    if (typeof v !== 'string') return null;
    const s = v.trim().toUpperCase().replace(/[\s-]/g, '');
    return ISRC_RE.test(s) ? s : null;
}

function normalizePlatform(v) {
    if (typeof v !== 'string') return null;
    const s = v.trim().toLowerCase();
    return PLATFORM_RE.test(s) ? s : null;
}

// "2026-09" or "2026-09-17" -> "2026-09-01". Months in the future are refused.
function normalizePeriod(v, now = new Date()) {
    if (typeof v !== 'string') return null;
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(v.trim());
    if (!m) return null;
    const year = Number(m[1]), month = Number(m[2]);
    if (month < 1 || month > 12 || year < 2000) return null;
    if (m[3] !== undefined) {
        const day = Number(m[3]);
        const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
        if (day < 1 || day > last) return null;
    }
    if (year * 12 + month > now.getUTCFullYear() * 12 + now.getUTCMonth() + 1) return null;
    return `${m[1]}-${m[2]}-01`;
}

// A whole number of streams. Accepts a number or digits with thousands separators ("1,234").
function normalizeStreams(v) {
    let n;
    if (typeof v === 'number') n = v;
    else if (typeof v === 'string' && /^\d{1,3}(,\d{3})+$|^\d+$/.test(v.trim())) n = Number(v.trim().replace(/,/g, ''));
    else return null;
    return Number.isInteger(n) && n >= 0 && n <= MAX_STREAMS ? n : null;
}

// Returns { rows, read, skipped, skippedCount, error }. `rows` are merged and ready to save.
function parseImport(body, now = new Date()) {
    const b = body && typeof body === 'object' ? body : {};
    if (!Array.isArray(b.rows) || b.rows.length === 0) return { error: 'There are no rows to import.' };
    if (b.rows.length > MAX_ROWS) return { error: `An import can have at most ${MAX_ROWS} rows. Split the file by date range and try again.` };

    let fallback = null;
    if (b.platform !== undefined && b.platform !== null && b.platform !== '') {
        fallback = normalizePlatform(b.platform);
        if (!fallback) return { error: 'The platform is not valid.' };
    }

    const merged = new Map();
    const skipped = [];
    let skippedCount = 0;
    const skip = (i, reason) => { skippedCount++; if (skipped.length < MAX_SKIPPED_SHOWN) skipped.push({ row: i + 1, reason }); };

    b.rows.forEach((r, i) => {
        if (!r || typeof r !== 'object') return skip(i, 'Not a row.');
        const isrc = normalizeIsrc(r.isrc);
        if (!isrc) return skip(i, 'Missing or invalid ISRC.');
        const platform = r.platform !== undefined && r.platform !== null && r.platform !== '' ? normalizePlatform(r.platform) : fallback;
        if (!platform) return skip(i, 'Missing or unrecognised platform.');
        const period = normalizePeriod(r.period, now);
        if (!period) return skip(i, 'Missing, invalid or future month.');
        const streams = normalizeStreams(r.streams);
        if (streams === null) return skip(i, 'Streams must be a whole number, 0 or more.');
        const key = `${isrc}|${platform}|${period}`;
        const hit = merged.get(key);
        if (hit) {
            hit.streams += streams;
            if (hit.streams > MAX_STREAMS) return skip(i, 'Total for this track, platform and month is too large.');
        } else merged.set(key, { isrc, platform, period, streams });
    });

    let fileName = null;
    if (typeof b.fileName === 'string' && b.fileName.trim()) fileName = b.fileName.trim().slice(0, 255);
    return { rows: [...merged.values()], read: b.rows.length, skipped, skippedCount, fileName, platform: fallback };
}

module.exports = { parseImport, normalizeIsrc, normalizePlatform, normalizePeriod, normalizeStreams, MAX_ROWS };
