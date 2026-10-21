// Builds "℗ 2026 Name" from a stored year and line. A symbol typed into the line is dropped so it is never doubled.
const LEAD = /^\s*(?:©|℗|\(c\)|\(p\))\s*/i;

function copyrightLine(symbol, year, line) {
    const text = [year, (line ?? '').replace(LEAD, '').trim()].filter(Boolean).join(' ');
    return text ? `${symbol} ${text}` : null;
}

module.exports = { copyrightLine };
