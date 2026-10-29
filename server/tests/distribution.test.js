const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rn = require('../src/lib/distribution');
const { shapeExport, findIdKeys } = require('../src/services/exportRelease');

// ---- the two copies of the title list must not drift ------------------------------------------------------------

test('contributor titles match the client list exactly, in order', () => {
  const file = path.join(__dirname, '..', '..', 'client', 'src', 'data', 'contributorTitles.ts');
  if (!fs.existsSync(file)) return; // server tested on its own
  const text = fs.readFileSync(file, 'utf8');
  const list = (name) => {
    const body = text.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`))[1];
    return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  };
  assert.deepEqual(list('CREDIT_TITLES'), rn.CREDIT_TITLES);
  assert.deepEqual(list('INSTRUMENT_TITLES'), rn.INSTRUMENT_TITLES);
  assert.equal(rn.DEFAULT_CONTRIBUTOR_TITLE, 'Producer');
});

test('cover art rules match the client list exactly, in order', () => {
  const file = path.join(__dirname, '..', '..', 'client', 'src', 'lib', 'distribution.ts');
  if (!fs.existsSync(file)) return; // server tested on its own
  const body = fs.readFileSync(file, 'utf8').match(/ART_NOT_ALLOWED: readonly string\[\] = \[([\s\S]*?)\]/)[1];
  assert.deepEqual([...body.matchAll(/'([^']+)'/g)].map((m) => m[1]), rn.ART_NOT_ALLOWED);
});

// ---- dates ------------------------------------------------------------------------------------------------------

test('originally released may equal or precede the sales start, but not follow it', () => {
  assert.equal(rn.checkReleaseDates({ originally_released: '2026-01-01', sales_start_date: '2026-01-01' }), null);
  assert.equal(rn.checkReleaseDates({ originally_released: '2025-12-31', sales_start_date: '2026-01-01' }), null);
  assert.match(rn.checkReleaseDates({ originally_released: '2026-01-02', sales_start_date: '2026-01-01' }), /on or before/);
});

test('the date rule only applies when both dates are set', () => {
  assert.equal(rn.checkReleaseDates({ originally_released: '2030-01-01', sales_start_date: null }), null);
  assert.equal(rn.checkReleaseDates({}), null);
});

// ---- primary artists and credits --------------------------------------------------------------------------------

test('artists and credits are cleaned, with Producer as the default title', () => {
  const r = rn.parseContributors({ primary_artists: ['  Kenny   TL '], credits: [{ track_number: null, name: ' Ada  Obi ' }, { track_number: 2, name: 'Jean', title: 'Mixing Engineer' }] }, [1, 2]);
  assert.deepEqual(r.artists, ['Kenny TL']);
  assert.deepEqual(r.credits, [{ track_number: null, name: 'Ada Obi', title: 'Producer' }, { track_number: 2, name: 'Jean', title: 'Mixing Engineer' }]);
});

test('an empty body is a valid empty list', () => {
  assert.deepEqual(rn.parseContributors({}, [1]), { artists: [], credits: [] });
});

test('bad input is refused with a plain reason', () => {
  const t = [1];
  assert.match(rn.parseContributors({ primary_artists: [''] }, t).error, /cannot be empty/);
  assert.match(rn.parseContributors({ primary_artists: ['Kenny', 'kenny'] }, t).error, /listed twice/);
  assert.match(rn.parseContributors({ credits: [{ name: 'A', title: 'Wizard' }] }, t).error, /not one of the credit titles/);
  assert.match(rn.parseContributors({ credits: [{ name: 'A', track_number: 9 }] }, t).error, /not on this release/);
  assert.match(rn.parseContributors({ credits: [{ name: 'A' }, { name: 'a' }] }, t).error, /twice/);
  assert.match(rn.parseContributors({ primary_artists: 'x' }, t).error, /must be lists/);
  assert.match(rn.parseContributors({ credits: [{ name: 'x'.repeat(201) }] }, t).error, /at most 200/);
});

test('the same person can hold different titles, or the same title on different tracks', () => {
  const r = rn.parseContributors({ credits: [{ name: 'A', title: 'Producer' }, { name: 'A', title: 'DJ' }, { name: 'A', title: 'Producer', track_number: 1 }] }, [1]);
  assert.equal(r.error, undefined);
  assert.equal(r.credits.length, 3);
});

test('list sizes are capped', () => {
  const many = Array.from({ length: rn.MAX_ARTISTS + 1 }, (_, i) => `Artist ${i}`);
  assert.match(rn.parseContributors({ primary_artists: many }, []).error, /at most 20/);
});

// ---- readiness checks -------------------------------------------------------------------------------------------

const good = () => ({
  release: { album_artist: 'Kenny TL', sales_start_date: '2026-12-01', originally_released: '2026-12-01' },
  tracks: [{ track_number: 1, has_lyrics: true }],
  audio: [{ track_number: 1, format: 'flac', bitrate_kbps: null, sample_rate_hz: 44100 }],
  artwork: { width: 3000, height: 3000, size_bytes: 5_000_000 },
  artists: ['Kenny TL'], edit: '/releases/r/edit',
});
const ids = (input) => rn.distributionChecks(input).map((c) => c.id);

test('a release that meets the common rules produces no checks', () => {
  assert.deepEqual(ids(good()), []);
});

test('missing dates and artists are flagged, none of them as blockers', () => {
  const g = good(); g.release = { album_artist: 'Kenny TL' }; g.artists = [];
  const checks = rn.distributionChecks(g);
  assert.deepEqual(checks.map((c) => c.id), ['dist-sales-start', 'dist-originally-released', 'dist-primary-artists']);
  assert.ok(checks.every((c) => c.level !== 'error'));
});

test('wrong cover art size and size over the limit are flagged', () => {
  const g = good(); g.artwork = { width: 1400, height: 1400, size_bytes: 26 * 1024 * 1024 };
  const checks = rn.distributionChecks(g);
  assert.deepEqual(checks.map((c) => c.id), ['dist-art-size', 'dist-art-bytes']);
  assert.match(checks[0].message, /1400 x 1400/);
});

test('audio: FLAC and MP3 320 at 44.1 kHz pass; other formats, rates and bitrates are flagged', () => {
  const g = good();
  g.audio = [
    { track_number: 1, format: 'flac', sample_rate_hz: 44100 },
    { track_number: 2, format: 'mp3', bitrate_kbps: 320, sample_rate_hz: 44100 },
    { track_number: 3, format: 'mp3', bitrate_kbps: 192, sample_rate_hz: 44100 },
    { track_number: 4, format: 'flac', sample_rate_hz: 48000 },
    { track_number: 5, format: 'wav', sample_rate_hz: 44100 },
  ];
  const c = rn.distributionChecks(g).find((x) => x.id === 'dist-audio-spec');
  assert.match(c.message, /tracks 3, 4, 5/);
  assert.equal(c.track, 3);
});

test('unanswered track lyrics are advice only', () => {
  const g = good(); g.tracks = [{ track_number: 1, has_lyrics: null }, { track_number: 2, has_lyrics: false }];
  const c = rn.distributionChecks(g);
  assert.deepEqual(c.map((x) => [x.id, x.level]), [['dist-track-lyrics', 'info']]);
  assert.match(c[0].message, /track 1 /);
});

test('every check points at the edit page', () => {
  const g = good(); g.release = {};
  assert.ok(rn.distributionChecks(g).every((c) => c.fix === '/releases/r/edit'));
});

// ---- export -----------------------------------------------------------------------------------------------------

const exportRows = () => ({
  release: { id: 'r1', owner_id: 'u1', title: 'T', album_artist: 'Kenny TL', release_date: '2026-12-01', status: 'draft', created_at: new Date(),
    album_version: 'Deluxe', is_compilation: false, has_lyrics: true, explicit: 'not_explicit', secondary_genre: 'Afrobeats',
    originally_released: '2026-11-01', preorder_date: null, sales_start_date: '2026-12-01' },
  tracks: [{ id: 't1', track_number: 1, title: 'A', has_lyrics: true, preview_start_seconds: 45 }, { id: 't2', track_number: 2, title: 'B' }],
  audio: [], collaborators: [], statuses: new Map(), artwork: null,
});

test('export carries the new release and track fields', () => {
  const { release, tracks } = shapeExport(exportRows());
  assert.equal(release.album_version, 'Deluxe');
  assert.equal(release.secondary_genre, 'Afrobeats');
  assert.equal(release.originally_released, '2026-11-01');
  assert.equal(release.sales_start_date, '2026-12-01');
  assert.equal(release.is_compilation, false);
  assert.equal(tracks[0].preview_start_seconds, 45);
  assert.equal(tracks[0].has_lyrics, true);
  assert.equal(tracks[1].has_lyrics, null);
});

test('export falls back to the album artist when no primary artists are listed', () => {
  assert.deepEqual(shapeExport(exportRows()).release.primary_artists, ['Kenny TL']);
  assert.deepEqual(shapeExport({ ...exportRows(), artists: ['Kenny TL', 'Ada Obi'] }).release.primary_artists, ['Kenny TL', 'Ada Obi']);
});

test('export puts release-level and per-track credits in the right place, numbered in order', () => {
  const contributors = [
    { track_number: null, name: 'Ada Obi', title: 'Producer' },
    { track_number: 1, name: 'Jean', title: 'Mixing Engineer' },
    { track_number: 1, name: 'Jean', title: 'Mastering Engineer' },
    { track_number: 2, name: 'Sam', title: 'Drums' },
  ];
  const { release, tracks } = shapeExport({ ...exportRows(), contributors });
  assert.deepEqual(release.contributors, [{ position: 1, name: 'Ada Obi', title: 'Producer' }]);
  assert.deepEqual(tracks[0].contributors.map((c) => [c.position, c.title]), [[1, 'Mixing Engineer'], [2, 'Mastering Engineer']]);
  assert.deepEqual(tracks[1].contributors, [{ position: 1, name: 'Sam', title: 'Drums' }]);
});

test('the export still contains no id keys with the new data in it', () => {
  const out = shapeExport({ ...exportRows(), artists: ['A'], contributors: [{ track_number: 1, name: 'J', title: 'DJ' }] });
  assert.deepEqual(findIdKeys(out), []);
});
