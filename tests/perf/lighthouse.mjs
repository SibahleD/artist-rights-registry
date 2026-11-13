// Runs Lighthouse over the public and signed-in pages, under several network profiles, several times each,
// and writes HTML + JSON reports and a summary table (medians) to reports/lighthouse/.
//
// Usage (from the repo root, after: npm i -D lighthouse @playwright/test && npx playwright install chromium):
//   node perf/lighthouse.mjs
//   TARGET=http://localhost:4173 API=http://localhost:4000/api node perf/lighthouse.mjs      # local production build
//   LH_EMAIL=me@example.com LH_PASSWORD=... node perf/lighthouse.mjs                         # include signed-in pages
//
// Settings (environment variables): TARGET, API, RUNS (default 3), PROFILES (default mobile,desktop,constrained),
// OUT (default reports/lighthouse), LH_EMAIL, LH_PASSWORD.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import { chromium } from '@playwright/test'

const TARGET = (process.env.TARGET ?? 'https://trackrecordrw.netlify.app').replace(/\/$/, '')
const API = (process.env.API ?? `${TARGET}/api`).replace(/\/$/, '')
const RUNS = Number(process.env.RUNS ?? 3)
const OUT = process.env.OUT ?? 'reports/lighthouse'
const PROFILES = (process.env.PROFILES ?? 'mobile,desktop,constrained').split(',').map((s) => s.trim())
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']

const PAGES = [
  { name: 'landing', path: '/', auth: false },
  { name: 'login', path: '/app/login', auth: false },
  { name: 'register', path: '/app/register', auth: false },
  { name: 'home', path: '/app/', auth: true },
  { name: 'discography', path: '/app/discography', auth: true },
  { name: 'glossary', path: '/app/glossary', auth: true },
  { name: 'metrics', path: '/app/metrics', auth: true },
]

// Lighthouse's own "mobile" is a Moto G Power on simulated slow 4G (150 ms RTT, 1.6 Mbps, 4x CPU slowdown).
// "constrained" is a harsher profile for poor connections (400 ms RTT, 400 Kbps, 4x CPU), closer to a weak mobile network.
function configFor(profile) {
  const base = { extends: 'lighthouse:default', settings: { onlyCategories: CATEGORIES } }
  if (profile === 'desktop') return { ...desktopConfig, settings: { ...desktopConfig.settings, onlyCategories: CATEGORIES } }
  if (profile === 'constrained') {
    return { ...base, settings: { ...base.settings, throttlingMethod: 'simulate',
      throttling: { rttMs: 400, throughputKbps: 400, requestLatencyMs: 1500, downloadThroughputKbps: 360, uploadThroughputKbps: 360, cpuSlowdownMultiplier: 4 } } }
  }
  return base // mobile
}

async function login() {
  const email = process.env.LH_EMAIL, password = process.env.LH_PASSWORD
  if (!email || !password) return null
  const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
  if (!res.ok) throw new Error(`Login failed (${res.status}). Check LH_EMAIL / LH_PASSWORD and the API address (${API}).`)
  const { token } = await res.json()
  // Make sure the API accepts the token before starting the long runs.
  const me = await fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
  if (!me.ok) throw new Error(`The API rejected the new token (${me.status} on /users/me). Fix the account first (for example verify its email).`)
  return token
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const audit = (lhr, id) => lhr.audits[id]?.numericValue
const pct = (x) => (x == null ? '' : Math.round(x * 100))
const sec = (ms) => (ms == null ? '' : (ms / 1000).toFixed(1))

// One run = one fresh browser, so every run starts with an empty cache (a first visit).
async function runOnce(profile, page, token, n) {
  const port = 9300 + Math.floor(Math.random() * 500)
  // A persistent context is the browser's default profile, which is the one Lighthouse drives over the debugging port.
  // (A normal newContext() is a separate private profile, so a token set there is invisible to Lighthouse.)
  // A fresh profile folder per run keeps every run a cold first visit.
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-profile-'))
  const ctx = await chromium.launchPersistentContext(profileDir, { args: [`--remote-debugging-port=${port}`] })
  try {
    const pg = ctx.pages()[0] ?? (await ctx.newPage())
    // Belt and braces: the token is also re-set at the start of every document, so it is there even if storage gets cleared.
    if (page.auth) await ctx.addInitScript((t) => { try { localStorage.setItem('token', t) } catch { /* ignore */ } }, token)
    if (page.auth) {
      // localStorage belongs to the origin, so set it on a tiny image from the same site. The app itself is not loaded,
      // which keeps the cache cold for the run. Lighthouse is told not to clear storage so the token survives.
      await pg.goto(`${TARGET}/favicon-32.png`)
      await pg.evaluate((t) => localStorage.setItem('token', t), token)
    }
    const url = TARGET + page.path
    const flags = { port, output: ['html', 'json'], logLevel: 'error', disableStorageReset: Boolean(page.auth) }
    const result = await lighthouse(url, flags, configFor(profile))
    const lhr = result.lhr
    const dir = path.join(OUT, profile)
    fs.mkdirSync(dir, { recursive: true })
    const base = path.join(dir, `${page.name}-run${n}`)
    fs.writeFileSync(`${base}.html`, result.report[0])
    fs.writeFileSync(`${base}.json`, result.report[1])
    const landed = new URL(lhr.finalDisplayedUrl ?? url).pathname
    const bouncedToLogin = page.auth && landed.includes('/login')
    const reqs = lhr.audits['network-requests']?.details?.items ?? []
    const me = reqs.find((q) => /\/users\/me/.test(q.url))
    const meNote = me ? `the app called /users/me and got ${me.statusCode}` : 'the app never called /users/me, so it did not see a token at startup'
    return { lhr, base, bouncedToLogin, landed, meNote }
  } finally {
    await ctx.close()
    fs.rmSync(profileDir, { recursive: true, force: true })
  }
}

// Opens the app once in an ordinary browser with the token set, so a problem with the app or token shows up in seconds.
async function preflight(token) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-preflight-'))
  const ctx = await chromium.launchPersistentContext(dir, {})
  try {
    const pg = ctx.pages()[0] ?? (await ctx.newPage())
    await ctx.addInitScript((t) => { try { localStorage.setItem('token', t) } catch { /* ignore */ } }, token)
    let meStatus = null
    pg.on('response', (r) => { if (r.url().includes('/users/me')) meStatus = r.status() })
    await pg.goto(`${TARGET}/app/`, { waitUntil: 'networkidle' })
    await pg.waitForTimeout(1500)
    const landed = new URL(pg.url()).pathname
    return { ok: !landed.includes('/login'), landed, meStatus }
  } finally {
    await ctx.close()
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

const token = await login()
if (token) {
  const pf = await preflight(token)
  console.log(`Preflight: opened ${TARGET}/app/ with the token. Landed on ${pf.landed}; /users/me answered ${pf.meStatus ?? 'nothing (never called)'}.`)
  if (!pf.ok) throw new Error('The app sends this account to the login page even in a plain browser, so Lighthouse cannot be at fault. See the preflight line above.')
}
const rows = []
let authBroken = false
for (const profile of PROFILES) {
  for (const page of PAGES) {
    if (page.auth && (!token || authBroken)) continue
    const runs = []
    for (let n = 1; n <= RUNS; n++) {
      process.stdout.write(`${profile} ${page.name} run ${n}/${RUNS}... `)
      const r = await runOnce(profile, page, token, n)
      console.log(r.bouncedToLogin ? `REDIRECTED TO ${r.landed}: ${r.meNote}` : `performance ${pct(r.lhr.categories.performance.score)}`)
      runs.push(r)
      if (r.bouncedToLogin) break
    }
    if (runs.some((r) => r.bouncedToLogin)) {
      authBroken = true // no point repeating this for the other signed-in pages
      console.log('Signed-in pages skipped: the login token was not accepted by the app.')
      continue
    }
    // The median run (by performance score) is the one to screenshot.
    const ranked = [...runs].sort((a, b) => a.lhr.categories.performance.score - b.lhr.categories.performance.score)
    const mid = ranked[ranked.length >> 1]
    fs.copyFileSync(`${mid.base}.html`, path.join(OUT, profile, `${page.name}-median.html`))
    const L = runs.map((r) => r.lhr)
    rows.push({
      profile, page: page.name, runs: runs.length, redirected: runs.some((r) => r.bouncedToLogin),
      perf: median(L.map((l) => l.categories.performance.score)), a11y: median(L.map((l) => l.categories.accessibility.score)),
      bp: median(L.map((l) => l.categories['best-practices'].score)), seo: median(L.map((l) => l.categories.seo.score)),
      fcp: median(L.map((l) => audit(l, 'first-contentful-paint'))), lcp: median(L.map((l) => audit(l, 'largest-contentful-paint'))),
      tbt: median(L.map((l) => audit(l, 'total-blocking-time'))), cls: median(L.map((l) => audit(l, 'cumulative-layout-shift'))),
      si: median(L.map((l) => audit(l, 'speed-index'))), kb: median(L.map((l) => audit(l, 'total-byte-weight'))) / 1024,
      cache: L[0].audits['uses-long-cache-ttl']?.score,
    })
  }
}

const head = '| Profile | Page | Perf | A11y | Best practices | SEO | FCP (s) | LCP (s) | TBT (ms) | CLS | Speed Index (s) | Transfer (KB) | Cache policy |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n'
const body = rows.map((r) => `| ${r.profile} | ${r.page}${r.redirected ? ' (redirected to login, invalid)' : ''} | ${pct(r.perf)} | ${pct(r.a11y)} | ${pct(r.bp)} | ${pct(r.seo)} | ${sec(r.fcp)} | ${sec(r.lcp)} | ${Math.round(r.tbt)} | ${r.cls?.toFixed(3)} | ${sec(r.si)} | ${Math.round(r.kb)} | ${r.cache === 1 ? 'pass' : 'review'} |`).join('\n')
const md = `# Lighthouse summary\n\nTarget: ${TARGET}\nMedian of ${RUNS} runs per page and profile, each from a cold cache. ${new Date().toISOString()}\n\n${head}${body}\n`
fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'summary.md'), md)
console.log('\n' + md)
if (!token) console.log('Signed-in pages were skipped: set LH_EMAIL and LH_PASSWORD to include them.')
