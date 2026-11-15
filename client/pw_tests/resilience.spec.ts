import { test, expect, request as pwRequest, type Page, type Route } from '@playwright/test'

// Resilience tests: how the app behaves when the network or the server misbehaves.
// Covers: unreachable server, server errors (500), rate limiting (429), expired session (401),
// slow responses, going offline mid-session, a slow connection, and static-asset caching.
//
// Needs: the API on API_URL (default http://localhost:4000) with relaxed rate limits. The web app is started by playwright.config.ts.
// Run:   npx playwright test pw_tests/resilience.spec.ts            (all three browsers)
//        npx playwright test pw_tests/resilience.spec.ts --project=chromium
// Caching test (against the deployed site): LIVE_URL=https://trackrecordrw.netlify.app npx playwright test pw_tests/resilience.spec.ts -g caching

const API = process.env.API_URL ?? 'http://localhost:4000'
const unique = `${Date.now()}.${Math.random().toString(36).slice(2, 7)}`
const USER = { artist: `Resilience Artist ${unique}`, legal: 'Resilience Tester', email: `resilience.${unique}@example.com`, password: 'Passw0rd!123' }
let token = ''

test.beforeAll(async () => {
  const ctx = await pwRequest.newContext()
  const res = await ctx.post(`${API}/api/auth/register`, {
    data: { email: USER.email, password: USER.password, artistName: USER.artist, legalName: USER.legal, acceptedTerms: true },
  })
  expect(res.status(), 'test account should be created through the API').toBe(201)
  token = (await res.json()).token
  await ctx.dispose()
})

// Every API call except "who am I" (so the session itself stays valid while the data calls are broken).
const dataCalls = (url: URL) => url.pathname.startsWith('/api/') && !url.pathname.endsWith('/users/me')

// Answers a request with a fixed JSON body. CORS headers are added because the web app and the API are on different ports locally.
async function fulfillJson(route: Route, status: number, body: unknown) {
  const origin = route.request().headers()['origin'] ?? '*'
  const cors = { 'access-control-allow-origin': origin, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
  return route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) })
}

// Signs in without the form: stores the token the way the app does. Done on the login page so a later reload keeps it.
async function signedIn(page: Page) {
  await page.goto('/app/login')
  await page.evaluate((t) => localStorage.setItem('token', t), token)
}

async function fillLogin(page: Page) {
  await page.getByLabel('Email').fill(USER.email)
  await page.locator('input[type="password"]').fill(USER.password)
}

test.describe('login under failure', () => {
  test('server unreachable: clear message, then recovers when the connection returns', async ({ page }) => {
    await page.route('**/api/auth/login', (route) => route.abort())
    await page.goto('/app/login')
    await fillLogin(page)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByRole('alert')).toContainText('Cannot reach the server')
    await expect(page).toHaveURL(/\/app\/login/)
    await expect(page.getByRole('button', { name: 'Log in' })).toBeEnabled()

    await page.unroute('**/api/auth/login') // the connection is back
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/app\/?$/)
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()
  })

  test('server error (500): an error message, not a blank page', async ({ page }) => {
    await page.route('**/api/auth/login', (route) => fulfillJson(route, 500, { error: 'Internal server error' }))
    await page.goto('/app/login')
    await fillLogin(page)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByRole('alert')).toContainText('Internal server error')
    await expect(page.getByRole('button', { name: 'Log in' })).toBeEnabled()
  })

  test('rate limited (429): tells the user to wait', async ({ page }) => {
    await page.route('**/api/auth/login', (route) => fulfillJson(route, 429, { error: 'Too many attempts, please try again later.' }))
    await page.goto('/app/login')
    await fillLogin(page)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByRole('alert')).toContainText('Too many attempts')
  })
})

test.describe('signed-in pages under failure', () => {
  test('discography: API unreachable shows an error banner', async ({ page }) => {
    await signedIn(page)
    await page.route(dataCalls, (route) => route.abort())
    await page.goto('/app/discography')
    await expect(page.getByRole('alert')).toContainText('Cannot reach the server')
  })

  test('discography: API error (500) shows an error banner', async ({ page }) => {
    await signedIn(page)
    await page.route(dataCalls, (route) => fulfillJson(route, 500, { error: 'Internal server error' }))
    await page.goto('/app/discography')
    await expect(page.getByRole('alert')).toContainText('Internal server error')
  })

  test('discography: slow API shows a loading state and the "server is waking up" note, then the page', async ({ page }) => {
    await signedIn(page)
    await page.route(dataCalls, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 4500)) // longer than the app's 3 second "slow" threshold
      await route.continue()
    })
    await page.goto('/app/discography')
    await expect(page.getByRole('status', { name: 'Loading your discography' })).toBeVisible()
    await expect(page.getByText(/server is waking up/)).toBeVisible({ timeout: 6_000 })
    await expect(page.getByRole('heading', { name: 'Discography' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('expired session (401) sends the user to the login page and clears the token', async ({ page }) => {
    await signedIn(page)
    await page.route(dataCalls, (route) => fulfillJson(route, 401, { error: 'Invalid or expired token.' }))
    await page.goto('/app/discography')
    await expect(page).toHaveURL(/\/app\/login/)
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull()
  })

  test('home page keeps working when every data call fails (no crash)', async ({ page }) => {
    const crashes: string[] = []
    page.on('pageerror', (e) => crashes.push(e.message))
    await signedIn(page)
    await page.route(dataCalls, (route) => route.abort())
    await page.goto('/app/')
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()
    expect(crashes, 'no uncaught errors in the page').toEqual([])
  })

  test('going offline mid-session shows an error, and the page recovers when back online', async ({ page, context }) => {
    await signedIn(page)
    await page.goto('/app/discography') // load this page once while online so its code is already in the browser
    await expect(page.getByRole('heading', { name: 'Discography' })).toBeVisible()
    await page.getByRole('link', { name: 'Home' }).first().click()
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()

    await context.setOffline(true)
    await page.getByRole('link', { name: 'Discography' }).first().click()
    await expect(page.getByRole('alert')).toContainText('Cannot reach the server')

    await context.setOffline(false)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Discography' })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
})

test.describe('slow connection and caching', () => {
  test('login still works on a slow connection (Chromium only)', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Network throttling uses the Chrome DevTools protocol')
    test.setTimeout(180_000)
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    // Roughly a poor mobile connection: 400 ms delay and 400 Kbps each way.
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 })

    const started = Date.now()
    await page.goto('/app/login', { waitUntil: 'load', timeout: 120_000 })
    await fillLogin(page)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible({ timeout: 90_000 })
    const seconds = ((Date.now() - started) / 1000).toFixed(1)
    test.info().annotations.push({ type: 'slow-connection login', description: `${seconds} s from opening the page to the signed-in home page` })
    console.log(`Slow connection (400 ms, 400 Kbps): login completed in ${seconds} s`)
  })

  test('caching: scripts and styles are served with a long cache lifetime (live site)', async ({ browser }) => {
    test.skip(!process.env.LIVE_URL, 'Set LIVE_URL=https://your-site to check the deployed site; the local dev server does not cache')
    const ctx = await browser.newContext({ baseURL: process.env.LIVE_URL })
    const page = await ctx.newPage()
    const assets: { url: string; cache: string }[] = []
    page.on('response', (res) => {
      const url = res.url()
      if (/\.(js|css)(\?|$)/.test(url)) assets.push({ url, cache: res.headers()['cache-control'] ?? '' })
    })
    await page.goto('/app/login', { waitUntil: 'networkidle' })
    expect(assets.length, 'script and style files were loaded').toBeGreaterThan(0)
    for (const a of assets) {
      const maxAge = Number(a.cache.match(/max-age=(\d+)/)?.[1] ?? 0)
      expect(maxAge, `${a.url} should be cacheable for at least a day (cache-control: "${a.cache}")`).toBeGreaterThanOrEqual(86_400)
    }
    test.info().annotations.push({ type: 'caching', description: `${assets.length} script/style files, each with max-age of a day or more` })
    await ctx.close()
  })
})
