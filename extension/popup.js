const $ = (id) => document.getElementById(id)
const DEFAULT_API = 'http://localhost:4000/api'
let API = DEFAULT_API, TOKEN = null, DOC = null, ENABLED = {}

const say = (text, kind = '') => { const s = $('status'); s.textContent = text; s.className = kind }
const store = {
  local: (k) => chrome.storage.local.get(k).then((r) => r[k]),
  setLocal: (o) => chrome.storage.local.set(o),
  session: (k) => chrome.storage.session.get(k).then((r) => r[k]),
  setSession: (o) => chrome.storage.session.set(o),
}

async function call(path, opts = {}) {
  let res
  try {
    res = await fetch(API + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) } })
  } catch { throw new Error('Cannot reach Track Record. Is it running, and is the address right?') }
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && TOKEN) { await signOut(); throw new Error('Signed out. Please sign in again.') }
  if (!res.ok) throw new Error(data.error || 'Something went wrong.')
  return data
}

function show(loggedIn) {
  $('login').hidden = loggedIn; $('main').hidden = !loggedIn; $('signout').hidden = !loggedIn
}

async function signOut() {
  TOKEN = null; DOC = null
  await chrome.storage.session.remove('token')
  show(false)
}

async function signIn() {
  API = $('api').value.trim().replace(/\/$/, '') || DEFAULT_API
  say('')
  try {
    const r = await call('/auth/login', { method: 'POST', body: JSON.stringify({ email: $('email').value, password: $('pw').value }) })
    TOKEN = r.token; $('pw').value = ''
    await store.setLocal({ api: API }); await store.setSession({ token: TOKEN })
    show(true); await loadReleases()
  } catch (e) { alert(e.message) }
}

async function loadReleases() {
  const sel = $('release')
  try {
    const { releases } = await call('/releases')
    const ready = releases.filter((r) => r.status === 'ready')
    sel.innerHTML = ready.length
      ? '<option value="">Choose a ready release…</option>' + ready.map((r) => `<option value="${r.id}">${esc(r.title)} (${esc(r.release_type)})</option>`).join('')
      : '<option value="">No ready releases yet</option>'
    $('preview').hidden = true
  } catch (e) { say(e.message, 'err') }
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// What each Fill button sends. Keys match the patterns in filler.js and the profile in routenote.js.
const dateOnly = (v) => (v ? String(v).slice(0, 10) : '')
const yesNo = (v) => (v === true ? 'yes' : v === false ? 'no' : '')
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

function releaseValues(d) {
  const r = d.release
  return {
    title: r.title, artist: r.album_artist, label: r.label_name, genre: r.genre, secondaryGenre: r.secondary_genre,
    releaseDate: dateOnly(r.release_date), originallyReleased: dateOnly(r.originally_released),
    preorderDate: dateOnly(r.preorder_date), salesStartDate: dateOnly(r.sales_start_date),
    albumVersion: r.release_type === 'single' ? '' : r.album_version,
    upc: r.upc, pLine: r.p_line, cLine: r.c_line, language: languageName(r.language),
  }
}
function releaseChoices(d) {
  const r = d.release, album = r.release_type !== 'single'
  return { isCompilation: album ? yesNo(r.is_compilation) : '', hasLyrics: yesNo(r.has_lyrics), explicit: r.explicit || '' }
}
function releaseLists(d) {
  return { artists: (d.release.primary_artists || []).map((name) => ({ name })) }
}

const names = (t, roles) => (t.credits || []).filter((c) => !c.is_featured && roles.includes(c.role) && c.legal_name).map((c) => c.legal_name)
function trackValues(t, fmt = 'mmss') {
  const sec = t.preview_start_seconds
  return {
    trackTitle: t.display_title || t.title, trackArtist: t.artist_name, version: t.version_title, isrc: t.isrc, iswc: t.iswc,
    previewStart: sec === null || sec === undefined ? '' : fmt === 'seconds' ? String(sec) : mmss(sec),
    writers: names(t, ['songwriter', 'composer', 'lyricist', 'author']).join(', '),
    producers: names(t, ['producer']).join(', '),
  }
}
function trackChoices(t) { return { trackHasLyrics: yesNo(t.has_lyrics), trackExplicit: t.explicit || '' } }
function trackLists(d, t) {
  // A single keeps its credits on the song. If the song has none, use the release-level list.
  let list = t.contributors || []
  if (!list.length && d.release.release_type === 'single') list = d.release.contributors || []
  return {
    writers: names(t, ['songwriter', 'composer', 'lyricist', 'author']).map((name) => ({ name })),
    contributors: list.map((c) => ({ name: c.name, title: c.title })),
  }
}

const LABELS = { title: 'Title', artist: 'Artist', label: 'Label', genre: 'Genre', releaseDate: 'Release date', upc: 'UPC', pLine: '℗ line', cLine: '© line', language: 'Language',
  secondaryGenre: 'Second genre', originallyReleased: 'Originally released', preorderDate: 'Pre-order date', salesStartDate: 'Sales start',
  albumVersion: 'Album version', previewStart: 'Preview start', isCompilation: 'Compilation', hasLyrics: 'Lyrics', explicit: 'Explicit', trackHasLyrics: 'Lyrics', trackExplicit: 'Explicit',
  artists: 'Primary artists', writers: 'Writers', contributors: 'Credits',
  trackTitle: 'Song title', trackArtist: 'Artist', version: 'Version', isrc: 'ISRC', iswc: 'ISWC', producers: 'Producers' }

const ANSWER_TEXT = { yes: 'Yes', no: 'No', explicit: 'Explicit', not_explicit: 'Not explicit', cleaned: 'Cleaned' }
// One list of rows for the preview: text values, then the yes/no answers, then the lists.
function display(values, choices, lists) {
  const out = { ...values }
  for (const [k, v] of Object.entries(choices)) if (v) out[k] = ANSWER_TEXT[v] || v
  for (const [k, v] of Object.entries(lists)) if (v.length) out[k] = v.map((i) => (i.title ? `${i.name} (${i.title})` : i.name)).join('; ')
  if (lists.writers && lists.writers.length) delete out.writers   // the list row shows them
  return out
}

function table(el, values) {
  const rows = Object.entries(values).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
  el.innerHTML = rows.map(([k, v]) => `<tr><td>${LABELS[k]}</td><td>${esc(v)}</td><td><button class="copy" data-v="${esc(v)}">Copy</button></td></tr>`).join('')
    || '<tr><td colspan="3">Nothing entered yet.</td></tr>'
}

const trackAt = () => DOC.tracks[Number($('track').value) || 0]

function renderPreview() {
  $('preview').hidden = !DOC
  closeUpc()
  if (!DOC) return
  table($('relTable'), display(releaseValues(DOC), releaseChoices(DOC), releaseLists(DOC)))
  $('track').innerHTML = DOC.tracks.map((t, i) => `<option value="${i}">${t.track_number ?? i + 1}. ${esc(t.title)}</option>`).join('')
  renderTrack()
}
function renderTrack() {
  const t = trackAt()
  table($('trackTable'), display(trackValues(t), trackChoices(t), trackLists(DOC, t)))
}

async function onPick() {
  say(''); DOC = null
  const id = $('release').value
  if (!id) return renderPreview()
  try { DOC = await call(`/releases/${id}/export`) } catch (e) { say(e.message, 'err') }
  renderPreview()
}

async function activeTab() { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); return t }

async function where() {
  const t = await activeTab()
  let host = ''
  try { host = new URL(t.url).hostname } catch {}
  const d = host ? distributorFor(host, ENABLED) : null
  $('where').textContent = d ? `This page: ${d.name}. Ready to fill.` : (host ? `This page (${host}) is not an enabled distributor. Fill is off here; you can still copy values.` : 'Open your distributor page, then reopen this popup.')
  return { tab: t, dist: d }
}

// payload: { values, choices, lists }. Lists the distributor's profile has no entry for are dropped, so a list is only
// ever filled where the profile says how.
async function fill(payload) {
  const { tab, dist } = await where()
  if (!dist) return say('Not an enabled distributor page, so nothing was filled.', 'warn')
  const lists = {}
  for (const [k, v] of Object.entries(payload.lists || {})) if (dist.extra.lists && dist.extra.lists[k]) lists[k] = v
  const values = { ...payload.values }
  if (lists.writers) delete values.writers      // filled as rows instead of one comma-separated box
  const choices = dist.extra.choices ? payload.choices || {} : {}
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['filler.js'] })
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (p) => window.__registryFill(p), args: [{ values, extra: dist.extra, choices, lists }] })
    const f = result.filled.map((k) => LABELS[k]).join(', ') || 'nothing'
    const m = result.missed.map((k) => LABELS[k]).join(', ')
    if (!result.filled.length) say(`No matching fields found on this page. Use Copy instead.`, 'warn')
    else say(`Filled: ${f}.${m ? ` Not found here: ${m}.` : ''}${result.clicks ? ` Added ${result.clicks} row${result.clicks === 1 ? '' : 's'}.` : ''} Check each one before you submit.`, m ? 'warn' : 'ok')
  } catch (e) { say('Could not fill this page (the browser blocked it).', 'err') }
}

// ---- UPC capture ------------------------------------------------------------------------------------------------
// The distributor generates the UPC. Nothing is saved until you have looked at the number and pressed Save.
const upcOk = (u) => { // GS1 check digit for 12 (UPC-A) or 13 (EAN-13) digits
  if (!/^\d{12,13}$/.test(u)) return false
  const d = u.split('').map(Number), last = d.pop()
  const sum = d.reverse().reduce((a, n, i) => a + n * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === last
}
function closeUpc() { $('upcBox').hidden = true; $('upcMsg').textContent = '' }
function openUpc(candidate, note) {
  $('upcBox').hidden = false
  $('upcIn').value = candidate || ''
  const cur = DOC.release.upc
  $('upcMsg').textContent = note + (cur && cur !== candidate ? ` This release already has UPC ${cur}; saving will replace it.` : '')
  $('upcIn').focus()
}
async function captureUpc() {
  const { tab, dist } = await where()
  if (!dist) return openUpc('', 'Not an enabled distributor page, so nothing was read. Type the UPC in if you have it.')
  let found = []
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readUpcCandidates })
    found = result || []
  } catch { /* fall through to manual entry */ }
  if (found.length === 1) openUpc(found[0], 'Found this number on the page. Check it against the page, then save.')
  else if (found.length > 1) openUpc(found[0], `Found ${found.length} possible numbers (${found.join(', ')}). The first is shown. Check it, or type the right one.`)
  else openUpc('', 'No UPC found on this page. Type it in by hand.')
}
// Runs in the page. Looks only at fields and text labelled UPC / barcode / EAN and returns 12 or 13 digit numbers.
function readUpcCandidates() {
  const out = new Set(), digits = /(?<!\d)\d{12,13}(?!\d)/g, label = /\bupc\b|\bean\b|barcode/i
  const add = (t) => { for (const m of String(t || '').replace(/[\s-]/g, '').matchAll(digits)) out.add(m[0]) }
  for (const el of document.querySelectorAll('input, textarea')) {
    if (el.type === 'password' || el.type === 'hidden') continue
    const d = [...(el.labels || [])].map((l) => l.textContent).concat(el.placeholder, el.name, el.id, el.getAttribute('aria-label')).join(' ')
    if (label.test(d)) add(el.value)
  }
  for (const el of document.querySelectorAll('dt, th, label, span, div, p, td, strong, b')) {
    if (el.children.length > 3) continue
    const own = el.textContent || ''
    if (own.length < 120 && label.test(own)) { add(own); add(el.nextElementSibling && el.nextElementSibling.textContent) }
  }
  return [...out]
}
async function saveUpc() {
  const upc = $('upcIn').value.replace(/[\s-]/g, '')
  if (!/^\d{12,13}$/.test(upc)) return ($('upcMsg').textContent = 'A UPC is 12 or 13 digits.')
  if (!upcOk(upc) && !confirm('This number fails the barcode check-digit test, so it may have a typo. Save it anyway?')) return
  try {
    const id = $('release').value
    await call(`/releases/${id}/upc`, { method: 'PUT', body: JSON.stringify({ upc }) })
    DOC.release.upc = upc
    renderPreview(); say(`Saved UPC ${upc} to this release.`, 'ok')
  } catch (e) { $('upcMsg').textContent = e.message }
}

function renderDists() {
  $('dists').innerHTML = DISTRIBUTORS.map((d) =>
    `<label class="dist"><input type="checkbox" data-id="${d.id}" ${(ENABLED[d.id] ?? d.enabledByDefault) ? 'checked' : ''}/> ${esc(d.name)}</label>`).join('')
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('button.copy')
  if (b) { navigator.clipboard.writeText(b.dataset.v); b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy'), 1000) }
})
$('dists').addEventListener('change', async (e) => {
  ENABLED = { ...ENABLED, [e.target.dataset.id]: e.target.checked }
  await store.setLocal({ enabled: ENABLED }); where()
})
$('signin').onclick = signIn
$('signout').onclick = signOut
$('release').onchange = onPick
$('track').onchange = renderTrack
$('fillRelease').onclick = () => DOC && fill({ values: releaseValues(DOC), choices: releaseChoices(DOC), lists: releaseLists(DOC) })
$('fillTrack').onclick = async () => {
  if (!DOC) return
  const { dist } = await where(), t = trackAt()
  fill({ values: trackValues(t, dist && dist.extra.previewFormat), choices: trackChoices(t), lists: trackLists(DOC, t) })
}
$('captureUpc').onclick = () => DOC && captureUpc()
$('manualUpc').onclick = () => DOC && openUpc('', 'Type the UPC from your distributor.')
$('upcSave').onclick = saveUpc
$('upcCancel').onclick = closeUpc

;(async () => {
  API = (await store.local('api')) || DEFAULT_API
  ENABLED = (await store.local('enabled')) || {}
  $('api').value = API
  TOKEN = (await store.session('token')) || null
  renderDists(); await where()
  show(!!TOKEN)
  if (TOKEN) await loadReleases()
})()

// Show / hide the password
$('pwToggle').addEventListener('click', () => {
  const show = $('pw').type === 'password'
  $('pw').type = show ? 'text' : 'password'
  $('pwIcon').classList.toggle('on', show)
  $('pwToggle').setAttribute('aria-pressed', String(show))
  $('pwToggle').setAttribute('aria-label', show ? 'Hide password' : 'Show password')
  $('pwToggle').title = show ? 'Hide password' : 'Show password'
})
