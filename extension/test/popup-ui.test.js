// Loads the real popup.html and popup.js in jsdom with a fake chrome and fake server, and checks the new layout:
// greeting, release picker with cover art, song picker, and the UPC save using the picked release.
const fs = require('fs'), path = require('path'), assert = require('assert')
const { JSDOM } = require('jsdom')
const dir = path.join(__dirname, '..')
const html = fs.readFileSync(path.join(dir, 'popup.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '')

const calls = []
const releases = [
  { id: 'r1', title: 'Head in the Clouds', release_type: 'ep', status: 'ready', artwork_id: 'm1' },
  { id: 'r2', title: 'Draft Thing', release_type: 'single', status: 'draft', artwork_id: null },
  { id: 'r3', title: 'Solo Song', release_type: 'single', status: 'ready', artwork_id: null },
]
const exportDoc = {
  release: { title: 'Head in the Clouds', release_type: 'ep', album_artist: 'SD Forever', upc: null, primary_artists: [], contributors: [] },
  tracks: [{ track_number: 1, title: 'Cloud Walk', isrc: 'RWABC2600001', credits: [], contributors: [] }, { track_number: 2, title: 'Rain', isrc: null, credits: [], contributors: [] }],
}
const json = (b, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(b), blob: () => Promise.resolve(new Blob(['x'])) })

;(async () => {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/' })
  const w = dom.window
  const mem = { api: 'http://api.test/api', token: 'T' }
  w.chrome = {
    storage: {
      local: { get: async (k) => ({ [k]: mem[k] }), set: async () => {} },
      session: { get: async (k) => ({ [k]: mem[k] }), set: async () => {}, remove: async () => {} },
    },
    tabs: { query: async () => [{ id: 1, url: 'https://routenote.com/x' }] },
    scripting: { executeScript: async () => [{ result: [] }] },
  }
  w.URL.createObjectURL = (b) => 'blob:fake'
  w.fetch = (url, opts = {}) => {
    calls.push([opts.method || 'GET', url.replace('http://api.test/api', ''), opts.headers && opts.headers.Authorization])
    if (url.endsWith('/users/me')) return json({ user: { first_name: 'Sam', artist_name: 'SD Forever' } })
    if (url.endsWith('/releases')) return json({ releases })
    if (url.includes('/media/')) return json({})
    if (url.endsWith('/releases/r1/export')) return json(exportDoc)
    if (url.endsWith('/upc')) return json({})
    return json({}, false)
  }
  // One eval, so the files share top-level const names the way separate <script> tags do.
  w.eval(['languages.js', 'routenote.js', 'distributors.js', 'popup.js'].map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n;\n'))
  const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms))
  const $ = (id) => w.document.getElementById(id)
  await wait(100)

  assert.strictEqual($('hello').textContent, 'Hello, Sam')
  const rel = [...w.document.querySelectorAll('#releaseList button')]
  assert.strictEqual(rel.length, 2, 'only ready releases are listed')
  assert.ok(rel[0].textContent.includes('Head in the Clouds') && rel[0].textContent.includes('EP'))
  assert.ok(calls.some(([m, u, a]) => u === '/media/m1' && a === 'Bearer T'), 'cover art is fetched with the sign-in token')
  assert.strictEqual(rel[0].querySelector('img').getAttribute('src'), 'blob:fake')
  assert.strictEqual(rel[1].querySelector('img'), null, 'no art id: no image, grey disc stays')
  assert.ok($('preview').hidden && $('relBox').hidden, 'details stay hidden until a release is picked')

  rel[0].click(); await wait()
  assert.strictEqual(rel[0].getAttribute('aria-pressed'), 'true')
  assert.ok(!$('preview').hidden && !$('relBox').hidden)
  const songs = [...w.document.querySelectorAll('#trackList button')]
  assert.strictEqual(songs.length, 2)
  assert.ok(songs[0].textContent.includes('1. Cloud Walk') && songs[0].textContent.includes('RWABC2600001'))
  assert.ok(songs[1].textContent.includes('No ISRC yet'))
  assert.ok(songs[0].querySelector('img'), 'songs show the release cover')
  assert.ok($('trackTable').textContent.includes('Cloud Walk'))

  songs[1].click(); await wait(5)
  assert.strictEqual(songs[1].getAttribute('aria-pressed'), 'true'); assert.strictEqual(songs[0].getAttribute('aria-pressed'), 'false')
  assert.ok($('trackTable').textContent.includes('Rain'))

  $('upcIn').value = '036000291452'; $('upcSave').click(); await wait()
  assert.ok(calls.some(([m, u]) => m === 'PUT' && u === '/releases/r1/upc'), 'UPC is saved to the picked release')

  rel[0].click(); await wait(5)   // picking it again clears the choice
  assert.ok($('preview').hidden)
  console.log('popup ui: all checks passed')
  process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
