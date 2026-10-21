const test = require('node:test');
const assert = require('node:assert/strict');
const { shapeExport, findIdKeys } = require('../src/services/exportRelease');
const { copyrightLine } = require('../src/lib/copyright');

// Rows as they come from the database, deliberately full of ids and an email.
const rows = () => ({
  release: { id: 'r1', owner_id: 'u1', artwork_id: 'm1', title: 'Air It Out', release_type: 'single', album_artist: 'Kenny TL',
    genre: 'Hip-hop', release_date: '2026-12-01', upc: null, p_line: null, c_line: null, label_name: null, language: 'en',
    status: 'draft', created_at: new Date('2026-10-01T10:00:00Z'), ready_at: null, unconfirmed_acknowledged_at: null },
  tracks: [{ id: 't1', release_id: 'r1', track_number: 1, title: 'Air It Out', artist_name: null, isrc: null }],
  audio: [{ track_id: 't1', file_name: 'a.mp3', format: 'mp3', bitrate_kbps: 192, sample_rate_hz: 44100, channels: 2, size_bytes: 1000, storage_key: 'k' }],
  collaborators: [
    { id: 'c1', track_id: 't1', user_id: 'u1', invited_email: 'me@example.com', legal_name: 'Ada Obi', role: 'songwriter', ownership_percent: '60.00', ipi: null },
    { id: 'c2', track_id: 't1', user_id: null, invited_email: 'jean@example.com', legal_name: 'Jean Mugisha', role: 'songwriter', ownership_percent: '40.00', ipi: '123456789' },
  ],
  statuses: new Map([['c1', 'confirmed'], ['c2', 'unconfirmed']]),
  artwork: { id: 'm1', mime_type: 'image/png', width: 1400, height: 1400, size_bytes: 5000, data: Buffer.from('x') },
});

test('export contains no id keys at any depth', () => {
  assert.deepEqual(findIdKeys(shapeExport(rows())), []);
});

test('the id walker really catches id, *_id and *Id keys', () => {
  assert.deepEqual(findIdKeys({ a: { id: 1 }, b: [{ track_id: 2 }, { userId: 3 }], ok: { tracking: 1 } }),
    ['$.a.id', '$.b[0].track_id', '$.b[1].userId']);
});

test('export carries no emails, owner data or unlisted fields', () => {
  const text = JSON.stringify(shapeExport(rows()));
  assert.ok(!text.includes('example.com'));
  assert.ok(!text.includes('storage_key'));
  assert.ok(!text.includes('unconfirmed_acknowledged_at'));
  assert.ok(!text.includes('invited_email'));
});

test('credits are numbered by position, with a plain confirmation status and numeric shares', () => {
  const { tracks } = shapeExport(rows());
  assert.deepEqual(tracks[0].credits.map((c) => [c.position, c.confirmation, c.ownership_percent]),
    [[1, 'confirmed', 60], [2, 'unconfirmed', 40]]);
  assert.equal(tracks[0].audio.format, 'mp3');
  assert.equal(tracks[0].credits[1].ipi, '123456789');
});

test('artwork is described, not embedded', () => {
  const { release } = shapeExport(rows());
  assert.deepEqual(release.artwork, { mime_type: 'image/png', width: 1400, height: 1400, size_bytes: 5000 });
});

test('a track with no audio exports audio: null, and a missing status defaults to unconfirmed', () => {
  const r = rows(); r.audio = []; r.statuses = new Map();
  const { tracks } = shapeExport(r);
  assert.equal(tracks[0].audio, null);
  assert.equal(tracks[0].credits[0].confirmation, 'unconfirmed');
});

test('blank artist, genre and lines are filled from the release and the first song', () => {
  const r = rows();
  r.release.genre = null;
  r.tracks[0] = { ...r.tracks[0], artist_name: null, genre: 'Gospel', recording_copyright_year: 2026, recording_copyright: 'Kenny TL',
    composition_copyright_year: 2025, composition_copyright: '© Ada Obi' };
  const { release, tracks } = shapeExport(r);
  assert.equal(tracks[0].artist_name, 'Kenny TL');
  assert.equal(release.genre, 'Gospel');
  assert.equal(tracks[0].genre, 'Gospel');
  assert.equal(release.p_line, '℗ 2026 Kenny TL');
  assert.equal(release.c_line, '© 2025 Ada Obi');   // a typed symbol is not doubled
});

test('values the artist did enter are never overwritten by the fallbacks', () => {
  const r = rows();
  r.release.p_line = '℗ 2024 My Label'; r.release.c_line = '© 2024 My Publisher'; r.release.genre = 'Reggae';
  r.tracks[0] = { ...r.tracks[0], artist_name: 'Featured Name', genre: 'Pop', recording_copyright_year: 2026, recording_copyright: 'Other' };
  const { release, tracks } = shapeExport(r);
  assert.equal(release.p_line, '℗ 2024 My Label');
  assert.equal(release.c_line, '© 2024 My Publisher');
  assert.equal(release.genre, 'Reggae');
  assert.equal(tracks[0].artist_name, 'Featured Name');
  assert.equal(tracks[0].genre, 'Pop');
});

test('with nothing to derive from, lines stay null and the export still has no ids', () => {
  const out = shapeExport(rows());
  assert.equal(out.release.p_line, null);
  assert.equal(copyrightLine('©', null, ''), null);
  assert.deepEqual(findIdKeys(out), []);
});
