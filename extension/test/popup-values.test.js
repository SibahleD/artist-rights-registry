// Checks how the popup turns an export into what gets sent. Runs the real builder code from popup.js.
const fs = require('fs'), path = require('path'), assert = require('assert')
const src = fs.readFileSync(path.join(__dirname, '..', 'popup.js'), 'utf8')
const code = src.slice(src.indexOf('// What each Fill button sends.'), src.indexOf('const LABELS'))
const b = new Function('languageName', code + '; return { releaseValues, releaseChoices, releaseLists, trackValues, trackChoices, trackLists }')((c) => ({ en: 'English' }[c] || c))

const doc = {
  release: { title: 'HITC', release_type: 'ep', album_artist: 'SD Forever', genre: 'Afrobeats', secondary_genre: 'Pop', release_date: '2026-12-18T00:00:00.000Z',
    originally_released: '2026-12-01', preorder_date: null, sales_start_date: '2026-12-05', album_version: 'Deluxe', is_compilation: false, has_lyrics: true, explicit: 'not_explicit',
    upc: null, language: 'en', primary_artists: ['SD Forever', 'Guest'], contributors: [{ name: 'Rel Producer', title: 'Producer' }] },
  tracks: [{ track_number: 1, title: 'Cloud Walk', preview_start_seconds: 45, has_lyrics: false, explicit: 'cleaned',
    credits: [{ legal_name: 'A One', role: 'songwriter' }, { legal_name: 'Feat Guy', role: 'songwriter', is_featured: true }, { legal_name: 'B Two', role: 'composer' }],
    contributors: [{ name: 'Beat Maker', title: 'Producer' }] }],
}
const rv = b.releaseValues(doc)
assert.strictEqual(rv.releaseDate, '2026-12-18'); assert.strictEqual(rv.salesStartDate, '2026-12-05'); assert.strictEqual(rv.preorderDate, '')
assert.strictEqual(rv.albumVersion, 'Deluxe')
assert.deepStrictEqual(b.releaseChoices(doc), { isCompilation: 'no', hasLyrics: 'yes', explicit: 'not_explicit' })
assert.deepStrictEqual(b.releaseLists(doc).artists, [{ name: 'SD Forever' }, { name: 'Guest' }])
const t = doc.tracks[0]
assert.strictEqual(b.trackValues(t).previewStart, '0:45'); assert.strictEqual(b.trackValues(t, 'seconds').previewStart, '45')
assert.strictEqual(b.trackValues({ ...t, preview_start_seconds: 0 }).previewStart, '0:00')
assert.strictEqual(b.trackValues({ ...t, preview_start_seconds: null }).previewStart, '')
assert.deepStrictEqual(b.trackChoices(t), { trackHasLyrics: 'no', trackExplicit: 'cleaned' })
assert.deepStrictEqual(b.trackLists(doc, t).writers, [{ name: 'A One' }, { name: 'B Two' }])   // featured artist is not a writer
assert.deepStrictEqual(b.trackLists(doc, t).contributors, [{ name: 'Beat Maker', title: 'Producer' }])
// single: song has no credits -> falls back to release-level list; album: no fallback
const single = { ...doc, release: { ...doc.release, release_type: 'single' } }, bare = { ...t, contributors: [] }
assert.deepStrictEqual(b.trackLists(single, bare).contributors, [{ name: 'Rel Producer', title: 'Producer' }])
assert.deepStrictEqual(b.trackLists(doc, bare).contributors, [])
assert.strictEqual(b.releaseValues(single).albumVersion, ''); assert.strictEqual(b.releaseChoices(single).isCompilation, '')
console.log('popup values: all checks passed')
