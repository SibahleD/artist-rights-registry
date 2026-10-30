// Runs the real filler.js and the UPC reader against mock-distributor.html in jsdom.
// Needs jsdom, which is not a project dependency:  cd /tmp && npm i jsdom && NODE_PATH=/tmp/node_modules node extension/test/filler.test.js
const fs = require('fs'), path = require('path'), assert = require('assert')
const { JSDOM } = require('jsdom')
const dir = path.join(__dirname, '..')
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8')

function page() {
  const dom = new JSDOM(read('mock-distributor.html'), { runScripts: 'dangerously', pretendToBeVisual: true })
  const w = dom.window
  w.Element.prototype.getBoundingClientRect = () => ({ width: 100, height: 20, top: 0, left: 0, right: 100, bottom: 20 })
  let submitted = 0
  w.document.getElementById('f').addEventListener('submit', () => submitted++)
  w.eval(read('filler.js'))
  return { w, d: w.document, submitted: () => submitted }
}
const profile = new Function(read('routenote.js') + '; return ROUTENOTE_PROFILE')()
const val = (d, name, i = 0) => d.querySelectorAll(`[name="${name}"]`)[i]?.value
const checked = (d, name) => [...d.querySelectorAll(`[name="${name}"]`)].find((r) => r.checked)?.parentElement.textContent.trim()
let n = 0; const test = async (name, fn) => { await fn(); n++; console.log('ok -', name) }

;(async () => {
  await test('release: text, dates, radios, artist rows', async () => {
    const { w, d, submitted } = page()
    const r = await w.__registryFill({
      values: { title: 'Head in the Clouds', label: 'Cloud Nine', genre: 'Afrobeats', secondaryGenre: 'Pop', releaseDate: '2026-12-18',
        originallyReleased: '2026-12-01', preorderDate: '2026-11-20', salesStartDate: '2026-12-05', albumVersion: 'Deluxe', pLine: '℗ 2026 Cloud Nine', cLine: '© 2026 Cloud Nine' },
      extra: profile,
      choices: { isCompilation: 'no', hasLyrics: 'yes', explicit: 'not_explicit' },
      lists: { artists: [{ name: 'SD Forever' }, { name: 'Guest One' }, { name: 'Guest Two' }] },
    })
    assert.deepStrictEqual([...r.missed], [], 'missed: ' + r.missed)
    assert.strictEqual(r.clicks, 2)
    assert.strictEqual(val(d, 'release_title'), 'Head in the Clouds')
    assert.strictEqual(val(d, 'genre'), 'Afrobeats'); assert.strictEqual(val(d, 'genre2'), 'Pop')
    assert.strictEqual(val(d, 'album_version'), 'Deluxe')
    assert.strictEqual(val(d, 'release_date'), '2026-12-18'); assert.strictEqual(val(d, 'orig'), '2026-12-01')
    assert.strictEqual(val(d, 'preorder'), '2026-11-20'); assert.strictEqual(val(d, 'sales'), '2026-12-05')
    assert.deepStrictEqual([...d.querySelectorAll('[name=primary_artist]')].map((i) => i.value), ['SD Forever', 'Guest One', 'Guest Two'])
    assert.strictEqual(checked(d, 'comp'), 'No'); assert.strictEqual(checked(d, 'rl'), 'Yes')
    assert.strictEqual(checked(d, 'rx'), 'Not explicit')
    assert.strictEqual(checked(d, 'terms'), undefined, 'terms radio must stay untouched')
    assert.strictEqual(val(d, 'pw'), ''); assert.strictEqual(submitted(), 0)
  })

  await test('release: Explicit and Cleaned map to the right option', async () => {
    for (const [ans, label] of [['explicit', 'Explicit'], ['cleaned', 'Cleaned']]) {
      const { w, d } = page()
      await w.__registryFill({ values: {}, extra: profile, choices: { explicit: ans }, lists: {} })
      assert.strictEqual(checked(d, 'rx'), label)
    }
  })

  await test('a consent group is never picked, even if asked for', async () => {
    const { w, d } = page()
    const evil = { ...profile, choices: { x: { group: { re: 'terms' }, options: { yes: '^\\s*yes' } } } }
    const r = await w.__registryFill({ values: {}, extra: evil, choices: { x: 'yes' }, lists: {} })
    assert.strictEqual(checked(d, 'terms'), undefined); assert.deepStrictEqual([...r.missed], ['x'])
  })

  await test('song: preview, lyrics, writers rows, credits with titles', async () => {
    const { w, d, submitted } = page()
    const r = await w.__registryFill({
      values: { trackTitle: 'Cloud Walk', isrc: 'RWABC2600001', previewStart: '0:45', version: 'Radio Edit' },
      extra: profile, choices: { trackHasLyrics: 'yes', trackExplicit: 'explicit' },
      lists: { writers: [{ name: 'A One' }, { name: 'B Two' }, { name: 'C Three' }],
               contributors: [{ name: 'Beat Maker', title: 'Producer' }, { name: 'Mix Guy', title: 'Mixing Engineer' }] },
    })
    assert.deepStrictEqual([...r.missed], [], 'missed: ' + r.missed)
    assert.strictEqual(val(d, 'track_title'), 'Cloud Walk'); assert.strictEqual(val(d, 'preview'), '0:45')
    assert.strictEqual(checked(d, 'tl'), 'Yes'); assert.strictEqual(checked(d, 'rl'), undefined, 'release lyrics answer must not change'); assert.strictEqual(checked(d, 'tx'), 'Explicit'); assert.strictEqual(checked(d, 'rx'), undefined)
    assert.deepStrictEqual([...d.querySelectorAll('[name=composer]')].map((i) => i.value), ['A One', 'B Two', 'C Three'])
    assert.deepStrictEqual([...d.querySelectorAll('[name=cname]')].map((i) => i.value), ['Beat Maker', 'Mix Guy'])
    assert.deepStrictEqual([...d.querySelectorAll('[name=ctitle]')].map((i) => i.value), ['Producer', 'Mixing Engineer'])
    assert.strictEqual(val(d, 'version'), 'Radio Edit'); assert.strictEqual(submitted(), 0)
  })

  await test('a missing add button leaves the extra names unfilled and says so', async () => {
    const { w, d } = page()
    d.getElementById('addArtist').remove()
    const r = await w.__registryFill({ values: {}, extra: profile, choices: {}, lists: { artists: [{ name: 'A' }, { name: 'B' }] } })
    assert.ok(r.missed.includes('artists')); assert.strictEqual(val(d, 'primary_artist'), 'A')
  })

  // UPC reader and check digit, taken straight from popup.js
  const popup = read('popup.js')
  const grab = (name) => popup.slice(popup.indexOf(`function ${name}`), popup.indexOf('\n}\n', popup.indexOf(`function ${name}`)) + 2)
  await test('UPC reader finds the generated number, ignores other digits', async () => {
    const { w, d } = page()
    w.eval(grab('readUpcCandidates'))
    assert.deepStrictEqual([...w.readUpcCandidates()], [])
    d.getElementById('gen').textContent = '036000291452'
    d.querySelector('[name=pw]').value = '123456789012'   // a password field must never be read
    assert.deepStrictEqual([...w.readUpcCandidates()], ['036000291452'])
    d.querySelector('[name=upc]').value = '0 36000 29145 2'
    assert.deepStrictEqual([...w.readUpcCandidates()], ['036000291452'])
  })
  await test('UPC check digit', async () => {
    const m = popup.match(/const upcOk = [\s\S]*?\n}\n/)[0]
    const upcOk = new Function(m + '; return upcOk')()
    assert.ok(upcOk('036000291452')); assert.ok(upcOk('4006381333931'))
    assert.ok(!upcOk('036000291453')); assert.ok(!upcOk('12345'))
  })
  console.log(`\n${n} tests passed`)
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
