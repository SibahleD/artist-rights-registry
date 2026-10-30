const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EXPORT_COLUMNS, parseFormat, csvCell, toCsv, shapeRows, exportFileName } = require('../src/lib/streamExport');

test('format: json by default, csv accepted, anything else refused', () => {
    assert.deepEqual(parseFormat(undefined), { format: 'json' });
    assert.deepEqual(parseFormat(''), { format: 'json' });
    assert.deepEqual(parseFormat('CSV'), { format: 'csv' });
    assert.deepEqual(parseFormat('json'), { format: 'json' });
    assert.ok(parseFormat('xml').error);
    assert.ok(parseFormat(['csv', 'json']).error);
});

test('csv cell: quotes, commas and line breaks are escaped', () => {
    assert.equal(csvCell('plain'), 'plain');
    assert.equal(csvCell('a,b'), '"a,b"');
    assert.equal(csvCell('say "hi"'), '"say ""hi"""');
    assert.equal(csvCell('two\nlines'), '"two\nlines"');
    assert.equal(csvCell(null), '');
    assert.equal(csvCell(1234), '1234');
});

test('csv cell: spreadsheet formulas are neutralised, negative numbers are not', () => {
    assert.equal(csvCell('=SUM(A1)'), "'=SUM(A1)");
    assert.equal(csvCell('@cmd'), "'@cmd");
    assert.equal(csvCell('+1'), "'+1");
    assert.equal(csvCell(-5), '-5');
});

test('csv: header, rows, CRLF line ends and a byte-order mark', () => {
    const rows = shapeRows([{ period: '2026-09-01', platform: 'spotify', isrc: 'KEABC2600001', track_title: 'Hi, there', release_title: null, streams: '1200' }]);
    const csv = toCsv(rows);
    assert.ok(csv.startsWith('\uFEFFperiod,platform,isrc,track_title,release_title,streams\r\n'));
    assert.equal(csv.split('\r\n')[1], '2026-09-01,spotify,KEABC2600001,"Hi, there",,1200');
    assert.ok(csv.endsWith('\r\n'));
});

test('csv: no rows still gives the header', () => {
    assert.equal(toCsv([]), '\uFEFF' + EXPORT_COLUMNS.join(',') + '\r\n');
});

test('json shape: fixed keys, streams are numbers, unmatched titles are null', () => {
    const [r] = shapeRows([{ period: '2026-09-01', platform: 'apple_music', isrc: 'KEABC2600002', streams: '42' }]);
    assert.deepEqual(r, { period: '2026-09-01', platform: 'apple_music', isrc: 'KEABC2600002', track_title: null, release_title: null, streams: 42 });
    assert.deepEqual(Object.keys(r), EXPORT_COLUMNS);
});

test('file name carries the date and the format', () => {
    assert.equal(exportFileName('csv', new Date('2026-10-30T10:00:00Z')), 'play-counts-2026-10-30.csv');
});
