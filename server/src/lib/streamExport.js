// Pure rules for the play-count data export, kept free of the database so they can be unit tested.

const EXPORT_COLUMNS = ['period', 'platform', 'isrc', 'track_title', 'release_title', 'streams'];

// 'json' (default) or 'csv'. Anything else is refused.
function parseFormat(v) {
    if (v === undefined || v === null || v === '') return { format: 'json' };
    const f = String(v).toLowerCase();
    return f === 'json' || f === 'csv' ? { format: f } : { error: 'Format must be json or csv.' };
}

// One CSV cell. Quoted when it holds a comma, quote or line break. A cell that starts with = + - @ (or a tab or
// carriage return) gets a leading apostrophe so a spreadsheet never runs it as a formula (CSV injection).
function csvCell(v) {
    if (v === null || v === undefined) return '';
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s) && typeof v !== 'number') s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Header row plus one line per record, CRLF line ends, UTF-8 byte-order mark so Excel reads accents correctly.
function toCsv(rows, columns = EXPORT_COLUMNS) {
    const lines = [columns.join(',')];
    for (const r of rows) lines.push(columns.map((c) => csvCell(r[c])).join(','));
    return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

// Database rows -> the exported record shape. Streams are always numbers; unmatched ISRCs keep empty titles.
function shapeRows(dbRows) {
    return dbRows.map((r) => ({
        period: r.period,
        platform: r.platform,
        isrc: r.isrc,
        track_title: r.track_title ?? null,
        release_title: r.release_title ?? null,
        streams: Number(r.streams),
    }));
}

const exportFileName = (format, today = new Date()) =>
    `play-counts-${today.toISOString().slice(0, 10)}.${format}`;

module.exports = { EXPORT_COLUMNS, parseFormat, csvCell, toCsv, shapeRows, exportFileName };
