// Shared helpers for the k6 scripts.
//   MODE=relaxed  rate limiters relaxed (server.env). Measures capacity. A 429 counts as a failure.
//   MODE=limited  production rate limits on (limiters-on.env). Measures the protection. A 429 is expected and counted separately.
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'

export const BASE = (__ENV.BASE_URL || 'http://localhost:4000').replace(/\/$/, '')
export const MODE = __ENV.MODE || 'relaxed'
export const USERS = Number(__ENV.USERS || (MODE === 'limited' ? 4 : 20)) // accounts created in setup (auth limit is 10 per 15 min when limited)
export const rateLimited = new Rate('rate_limited') // share of requests answered with 429

// In limited mode a 429 is the correct answer, so it must not count as a failed request.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, ...(MODE === 'limited' ? [429] : [])))

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const auth = (token, name) => ({ headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` }, tags: { name } })
const track = (res) => { rateLimited.add(res.status === 429); return res }

export function health() {
  const res = track(http.get(`${BASE}/health`, { tags: { name: 'GET /health' } }))
  check(res, { 'health 200 (or 429)': (r) => r.status === 200 || r.status === 429 })
}

export function register(runId, i) {
  const body = JSON.stringify({ email: `k6+${runId}.${i}@example.com`, password: 'Passw0rd!load', artistName: `K6 Artist ${runId}-${i}`, legalName: 'K6 Load', acceptedTerms: true })
  const res = track(http.post(`${BASE}/api/auth/register`, body, { headers: JSON_HEADERS, tags: { name: 'POST /auth/register' } }))
  return res.status === 201 ? res.json('token') : null
}

export function createRelease(token, label) {
  const body = JSON.stringify({ title: `K6 ${label} ${Date.now()}`, releaseType: 'single', genre: 'Afrobeats' })
  const res = track(http.post(`${BASE}/api/releases`, body, auth(token, 'POST /releases')))
  const ok = check(res, { 'release created': (r) => r.status === 201 || r.status === 429 })
  return ok && res.status === 201 ? res.json('release.id') : null
}

// Creates one user, one release and one track each, so the read scenarios have something to read.
export function setupData() {
  const runId = Date.now()
  const users = []
  for (let i = 0; i < USERS; i++) {
    const token = register(runId, i)
    if (!token) continue
    const releaseId = createRelease(token, 'seed')
    if (!releaseId) continue
    const t = JSON.stringify({ title: 'K6 Track', explicit: 'not_explicit' })
    track(http.post(`${BASE}/api/releases/${releaseId}/tracks`, t, auth(token, 'POST /tracks')))
    users.push({ token, releaseId })
  }
  if (users.length === 0) throw new Error('Setup could not create any test user. Check BASE_URL, MODE and the rate limits (see README).')
  return { users }
}

// Removes the accounts (and their draft releases) created in setup, so the database is left clean.
export function teardownData(data) {
  for (const u of data.users) {
    http.post(`${BASE}/api/users/me/delete`, JSON.stringify({ password: 'Passw0rd!load' }), auth(u.token, 'POST /users/me/delete'))
  }
}

const pick = (data) => data.users[(__VU - 1) % data.users.length]

// One user action. The mix is roughly: 60% browse, 25% write, 10% export, 5% health.
export function userAction(data) {
  const u = pick(data)
  const roll = Math.random()
  if (roll < 0.6) {
    const list = track(http.get(`${BASE}/api/releases`, auth(u.token, 'GET /releases')))
    check(list, { 'list ok': (r) => r.status === 200 || r.status === 429 })
    const one = track(http.get(`${BASE}/api/releases/${u.releaseId}`, auth(u.token, 'GET /releases/:id')))
    check(one, { 'get ok': (r) => r.status === 200 || r.status === 429 })
  } else if (roll < 0.85) {
    const id = createRelease(u.token, 'load')
    if (id) {
      const t = track(http.post(`${BASE}/api/releases/${id}/tracks`, JSON.stringify({ title: 'K6 Track' }), auth(u.token, 'POST /tracks')))
      check(t, { 'track created': (r) => r.status === 201 || r.status === 429 })
      const d = track(http.del(`${BASE}/api/releases/${id}`, null, auth(u.token, 'DELETE /releases/:id')))
      check(d, { 'release deleted': (r) => r.status === 204 || r.status === 200 || r.status === 429 })
    }
  } else if (roll < 0.95) {
    const ex = track(http.get(`${BASE}/api/releases/${u.releaseId}/export`, auth(u.token, 'GET /releases/:id/export')))
    check(ex, { 'export ok': (r) => r.status === 200 || r.status === 429 })
  } else {
    health()
  }
  sleep(0.5 + Math.random()) // think time
}

// Thresholds: latency and errors only matter when the limiters are relaxed. When limited, the point is that 429s appear.
export function thresholds(p95 = 800) {
  const t = { http_req_failed: ['rate<0.01'], checks: ['rate>0.99'] }
  if (MODE === 'relaxed') {
    t.http_req_duration = [`p(95)<${p95}`]
    t['http_req_duration{name:GET /releases}'] = ['p(95)<500']
    t.rate_limited = ['rate==0']
  } else {
    t.rate_limited = ['rate>0'] // proves the limiter engaged
  }
  return t
}

export function summaryTitle(name) { return `${name} (${MODE} rate limits) against ${BASE}` }
