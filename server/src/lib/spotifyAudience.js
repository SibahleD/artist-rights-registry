// Validation for the Spotify for Artists audience-timeline CSV (date, listeners, monthly listeners,
// monthly active listeners, super listeners, streams, playlist adds, saves, followers).
//
// The browser reads the file and sends the rows; everything is checked again here. A bad row is skipped
// with a reason rather than failing the import. Leading days where every figure is 0 are dropped: Spotify
// pads the file back to the start of the year, and those rows are from before the artist had any activity.

const COLUMNS = ['listeners', 'monthly_listeners', 'monthly_active_listeners', 'super_listeners', 'streams', 'playlist_adds', 'saves', 'followers'];
const MAX_ROWS = 4000;
const MAX_VALUE = 1e9;
const MAX_SKIPPED_SHOWN = 25;

function normalizeDay(v, now = new Date()) {
    if (typeof v !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
    if (!m) return null;
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    if (y < 2000 || mo < 1 || mo > 12 || d < 1 || d > new Date(Date.UTC(y, mo, 0)).getUTCDate()) return null;
    const tomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    if (Date.UTC(y, mo - 1, d) > tomorrow) return null;
    return m[0];
}

function normalizeCount(v) {
    const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN;
    return Number.isInteger(n) && n >= 0 && n <= MAX_VALUE ? n : null;
}

// Returns { rows, read, skipped, skippedCount, trimmed, fileName, error }.
function parseAudience(body, now = new Date()) {
    const b = body && typeof body === 'object' ? body : {};
    if (!Array.isArray(b.rows) || b.rows.length === 0) return { error: 'There are no rows to import.' };
    if (b.rows.length > MAX_ROWS) return { error: `A file can have at most ${MAX_ROWS} days. Export a shorter date range and try again.` };

    const byDay = new Map();
    const skipped = [];
    let skippedCount = 0;
    const skip = (i, reason) => { skippedCount++; if (skipped.length < MAX_SKIPPED_SHOWN) skipped.push({ row: i + 1, reason }); };

    b.rows.forEach((r, i) => {
        if (!r || typeof r !== 'object') return skip(i, 'Not a row.');
        const day = normalizeDay(r.date, now);
        if (!day) return skip(i, 'Missing, invalid or future date.');
        const row = { day };
        for (const c of COLUMNS) {
            const n = normalizeCount(r[c]);
            if (n === null) return skip(i, `"${c.replace(/_/g, ' ')}" must be a whole number, 0 or more.`);
            row[c] = n;
        }
        byDay.set(day, row);   // a repeated date keeps the last row
    });

    let rows = [...byDay.values()].sort((a, c) => (a.day < c.day ? -1 : 1));
    const firstActive = rows.findIndex((r) => COLUMNS.some((c) => r[c] > 0));
    const trimmed = firstActive === -1 ? rows.length : firstActive;
    rows = rows.slice(trimmed);

    const fileName = typeof b.fileName === 'string' && b.fileName.trim() ? b.fileName.trim().slice(0, 255) : null;
    return { rows, read: b.rows.length, skipped, skippedCount, trimmed, fileName };
}

module.exports = { parseAudience, normalizeDay, normalizeCount, COLUMNS, MAX_ROWS };
