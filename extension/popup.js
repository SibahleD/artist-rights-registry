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

// What each Fill button sends. Keys match the patterns in filler.js.
function releaseValues(d) {
  const r = d.release
  return {
    title: r.title, artist: r.album_artist, label: r.label_name, genre: r.genre, releaseDate: r.release_date ? String(r.release_date).slice(0, 10) : '',
    upc: r.upc, pLine: r.p_line, cLine: r.c_line, language: languageName(r.language),
  }
}
function trackValues(t) {
  const names = (roles) => (t.credits || []).filter((c) => !c.is_featured && roles.includes(c.role) && c.legal_name).map((c) => c.legal_name)
  return {
    trackTitle: t.display_title || t.title, trackArtist: t.artist_name, version: t.version_title, isrc: t.isrc, iswc: t.iswc,
    writers: names(['songwriter', 'composer', 'lyricist', 'author']).join(', '),
    producers: names(['producer']).join(', '),
  }
}

const LABELS = { title: 'Title', artist: 'Artist', label: 'Label', genre: 'Genre', releaseDate: 'Release date', upc: 'UPC', pLine: '℗ line', cLine: '© line', language: 'Language',
  trackTitle: 'Song title', trackArtist: 'Artist', version: 'Version', isrc: 'ISRC', iswc: 'ISWC', writers: 'Writers', producers: 'Producers' }

function table(el, values) {
  const rows = Object.entries(values).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
  el.innerHTML = rows.map(([k, v]) => `<tr><td>${LABELS[k]}</td><td>${esc(v)}</td><td><button class="copy" data-v="${esc(v)}">Copy</button></td></tr>`).join('')
    || '<tr><td colspan="3">Nothing entered yet.</td></tr>'
}

function renderPreview() {
  $('preview').hidden = !DOC
  if (!DOC) return
  table($('relTable'), releaseValues(DOC))
  $('track').innerHTML = DOC.tracks.map((t, i) => `<option value="${i}">${t.track_number ?? i + 1}. ${esc(t.title)}</option>`).join('')
  renderTrack()
}
const renderTrack = () => table($('trackTable'), trackValues(DOC.tracks[Number($('track').value) || 0]))

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

async function fill(values) {
  const { tab, dist } = await where()
  if (!dist) return say('Not an enabled distributor page, so nothing was filled.', 'warn')
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['filler.js'] })
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (p) => window.__registryFill(p), args: [{ values, extra: dist.extra }] })
    const f = result.filled.map((k) => LABELS[k]).join(', ') || 'nothing'
    const m = result.missed.map((k) => LABELS[k]).join(', ')
    if (!result.filled.length) say(`No matching fields found on this page. Use Copy instead.`, 'warn')
    else say(`Filled: ${f}.${m ? ` Not found here: ${m}.` : ''} Check each one before you submit.`, m ? 'warn' : 'ok')
  } catch (e) { say('Could not fill this page (the browser blocked it).', 'err') }
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
$('fillRelease').onclick = () => DOC && fill(releaseValues(DOC))
$('fillTrack').onclick = () => DOC && fill(trackValues(DOC.tracks[Number($('track').value) || 0]))

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
