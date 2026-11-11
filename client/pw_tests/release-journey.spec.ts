import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import path from 'node:path'

// User journey: make a release -> co-writer disputes the split -> artist accepts the correction -> release marked ready.
// The five tests share state, so they run in order in one worker (serial mode).
//
// Needs: the API on API_URL (default http://localhost:4000) started with DEV_OUTBOX=true and MAIL_TRANSPORT=console,
// so that co-writer emails can be read from /api/dev/outbox instead of a real mailbox.

const API = process.env.API_URL ?? 'http://localhost:4000'
const FIXTURES = path.join(import.meta.dirname, 'fixtures')
const COVER = path.join(FIXTURES, 'cover.png')
const AUDIO = path.join(FIXTURES, 'tone.mp3')

const run = Date.now()
const OWNER = { artist: `Journey Artist ${run}`, legal: 'Journey Owner', email: `owner.${run}@example.com`, password: 'Passw0rd!123' }
const CO_EMAIL = `cowriter.${run}@example.com`
const SONG = `Journey Single ${run}`

test.describe.configure({ mode: 'serial' })

let ownerCtx: BrowserContext
let owner: Page
let releaseId = ''

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  ownerCtx = await browser.newContext()
  owner = await ownerCtx.newPage()
})
test.afterAll(async () => { await ownerCtx.close() })

// Reads the newest co-writer email from the dev outbox and returns the token in its link.
async function latestNoticeToken(request: import('@playwright/test').APIRequestContext): Promise<string> {
  let token = ''
  await expect.poll(async () => {
    const res = await request.get(`${API}/api/dev/outbox`, { params: { to: CO_EMAIL } })
    const emails = (await res.json()).emails as { text: string }[]
    token = emails[0]?.text.match(/\/notice\/([A-Za-z0-9_-]+)/)?.[1] ?? ''
    return token
  }, { message: 'invitation email should reach the dev outbox', timeout: 15_000 }).not.toBe('')
  return token
}

// Opens the co-writer's link in a fresh browser context: they have no account and are not logged in.
async function openAsCoWriter(browser: Browser, token: string) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(`/app/notice/${token}`)
  return { ctx, page }
}

async function saveSplits(page: Page) {
  await page.getByRole('region', { name: 'Save' }).getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Saved.')
}

test('1. artist registers and creates a release with cover art and audio', async () => {
  await owner.goto('/app/register')
  await owner.getByLabel('Artist name').fill(OWNER.artist)
  await owner.getByLabel('Legal name').fill(OWNER.legal)
  await owner.getByLabel('Email').fill(OWNER.email)
  await owner.locator('input[type="password"]').fill(OWNER.password)
  await owner.getByRole('checkbox').check()
  await owner.getByRole('button', { name: 'Register' }).click()
  await expect(owner).toHaveURL(/\/app\/?$/)

  await owner.goto('/app/new/song')
  await expect(owner.getByRole('heading', { name: 'New Song Listing' })).toBeVisible()

  // Release part: title, date and cover art
  await owner.getByLabel('Song title').fill(SONG)
  await owner.locator('[data-field="release-date"] input').fill('2027-02-01')
  await owner.getByRole('tab', { name: /Cover art/ }).click()
  await owner.locator('input[type="file"][accept^="image"]').setInputFiles(COVER)

  // Song part: audio file
  await owner.getByRole('tab', { name: 'Song', exact: true }).click()
  await owner.getByRole('tab', { name: /Audio file/ }).click()
  await owner.locator('input[type="file"][accept*=".mp3"]').setInputFiles(AUDIO)

  await owner.getByRole('button', { name: 'Save', exact: true }).click()

  // The first save goes straight to the splits page for the new release.
  await expect(owner).toHaveURL(/\/app\/releases\/[0-9a-f-]{36}\/splits/)
  releaseId = owner.url().match(/releases\/([0-9a-f-]{36})/)![1]
  await expect(owner.getByRole('heading', { name: /Splits/ })).toBeVisible()
  await expect(owner.locator('.badge.draft')).toBeVisible()
})

test('2. artist splits the song 60/40 with a co-writer and sends the invitation', async () => {
  await owner.goto(`/app/releases/${releaseId}/splits`)

  await owner.getByPlaceholder('%').first().fill('60')
  await owner.getByRole('button', { name: '+ Add split holder' }).click()
  await owner.getByPlaceholder('Legal name').nth(1).fill('Co Writer')
  await owner.getByPlaceholder('%').nth(1).fill('40')
  await owner.getByPlaceholder('Email').nth(1).fill(CO_EMAIL)
  await expect(owner.locator('.total-pill.ok')).toHaveText('100%')
  await saveSplits(owner)

  await owner.getByRole('button', { name: 'Send invitations' }).click()
  await expect(owner.getByText('invitation sent')).toBeVisible()
  await expect(owner.locator('.notice-row .badge.pending')).toBeVisible()
})

test('3. co-writer disputes the split and the release cannot be marked ready', async ({ browser, request }) => {
  const { ctx, page } = await openAsCoWriter(browser, await latestNoticeToken(request))
  await expect(page.getByRole('heading', { name: 'Confirm your share' })).toBeVisible()
  await expect(page.getByText('60%')).toBeVisible()

  await page.getByRole('button', { name: 'The details are wrong' }).click()
  await page.getByRole('textbox').fill('I was told the split is 50/50')
  await page.getByRole('button', { name: 'Send dispute' }).click()
  await expect(page.getByText(/we have recorded that you disagree/)).toBeVisible()
  await ctx.close()

  // The artist sees the dispute with the co-writer's message.
  await owner.goto(`/app/releases/${releaseId}/splits`)
  await expect(owner.locator('.notice-row .badge.disputed')).toBeVisible()
  await expect(owner.getByText('I was told the split is 50/50')).toBeVisible()

  // Marking ready is refused while a dispute is open.
  await owner.goto(`/app/releases/${releaseId}`)
  await owner.getByRole('button', { name: 'Mark ready', exact: true }).click()
  await expect(owner.getByText(/disputed these details/)).toBeVisible()
  await expect(owner.locator('.badge.draft')).toBeVisible()
})

test('4. artist accepts the correction, resends, and the co-writer confirms', async ({ browser, request }) => {
  const oldToken = await latestNoticeToken(request)

  await owner.goto(`/app/releases/${releaseId}/splits`)
  await owner.getByPlaceholder('%').first().fill('50')
  await owner.getByPlaceholder('%').nth(1).fill('50')
  await expect(owner.locator('.total-pill.ok')).toHaveText('100%')
  await saveSplits(owner)
  await owner.getByRole('button', { name: 'Send / update invitations' }).click()
  await expect(owner.getByText('details changed, updated invitation sent')).toBeVisible()

  // The updated invitation carries a new link.
  let newToken = oldToken
  await expect.poll(async () => (newToken = await latestNoticeToken(request)), { timeout: 15_000 }).not.toBe(oldToken)

  const { ctx, page } = await openAsCoWriter(browser, newToken)
  await expect(page.getByText('50%')).toBeVisible()
  await page.getByRole('button', { name: 'This is correct' }).click()
  await expect(page.getByText('Thanks, your share is confirmed.')).toBeVisible()
  await ctx.close()

  await owner.reload()
  await expect(owner.locator('.notice-row .badge.confirmed')).toBeVisible()
})

test('5. artist marks the release ready and it is locked', async () => {
  await owner.goto(`/app/releases/${releaseId}`)
  await owner.getByRole('button', { name: 'Mark ready', exact: true }).click()

  await expect(owner.locator('.badge.ready').first()).toBeVisible()
  await expect(owner.getByRole('button', { name: 'Revert to draft' })).toBeVisible()
  await expect(owner.getByRole('button', { name: 'Mark ready', exact: true })).toHaveCount(0)

  await owner.goto(`/app/releases/${releaseId}/splits`)
  await expect(owner.getByText(/This release is locked/)).toBeVisible()
})
