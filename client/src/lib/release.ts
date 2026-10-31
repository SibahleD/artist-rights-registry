import type { Collaborator, CollaboratorInput, CreditRow, ReleaseForm, YesNo, Notice, Track, Release } from '../types'
import { CONTRIBUTOR_TITLES, DEFAULT_CONTRIBUTOR_TITLE } from '../data/contributorTitles'
import { api, ApiError } from '../api'

// ---- collab ----------------------------------------------------------------
// A stored credit, in the shape the splits editor works with and the save endpoint accepts.
export const toCollaboratorInput = (c: Collaborator): CollaboratorInput => ({
  legalName: c.legal_name, role: c.role, ownershipPercent: Number(c.ownership_percent),
  invitedEmail: c.invited_email,
  ipi: c.ipi ?? '', writerStatus: c.writer_status ?? null,
  publisherName: c.publisher_name ?? '', isSelfPublished: !!c.is_self_published, isFeatured: !!c.is_featured,
  ...(c.removed_by_writer ? { id: c.id, removedByWriter: true } : {}),
})

// Percentages in whole cents, so 33.33 + 33.33 + 33.34 adds up to exactly 100.
export const sumPercent = (list: CollaboratorInput[]) =>
  list.filter((c) => !c.discard && !c.removedByWriter).reduce((s, c) => s + Math.round((Number(c.ownershipPercent) || 0) * 100), 0) / 100

export const featuredNames = (list: Collaborator[]) => list.filter((c) => c.is_featured && !c.removed_by_writer).map((c) => c.legal_name)
export const featTitle = (title: string, names: string[]) => (names.length ? `${title} (feat. ${names.join(', ')})` : title)
export const featuredCredit = (name: string): CollaboratorInput => ({ legalName: name, role: 'performer', ownershipPercent: 0, isFeatured: true })

// ---- distribution ----------------------------------------------------------
// Helpers for the distribution details on the listing form. Plain functions, no React, so they can be tested on their own.
// The rules mirror server/src/lib/distribution.js. The server is the one that counts; these only catch mistakes before anything is saved.




// ---- Yes / no -----------------------------------------------------------------------------------------------------

export const yesNoToBool = (v: YesNo): boolean | null => (v === 'yes' ? true : v === 'no' ? false : null)
export const boolToYesNo = (b?: boolean | null): YesNo => (b === true ? 'yes' : b === false ? 'no' : '')

// ---- Preview start ------------------------------------------------------------------------------------------------

const MAX_PREVIEW_SECONDS = 3600   // the server accepts 0 to 3600

// Accepts "45" (seconds) or "0:45" (minutes and seconds). Empty means not set.
export function parseStartTime(text: string): { ok: true; seconds: number | null } | { ok: false } {
  const t = text.trim()
  if (!t) return { ok: true, seconds: null }
  let seconds: number
  const colon = /^(\d{1,3}):([0-5]\d)$/.exec(t)
  if (colon) seconds = Number(colon[1]) * 60 + Number(colon[2])
  else if (/^\d{1,4}$/.test(t)) seconds = Number(t)
  else return { ok: false }
  return seconds <= MAX_PREVIEW_SECONDS ? { ok: true, seconds } : { ok: false }
}

export const formatStartTime = (n?: number | null): string => (n === null || n === undefined ? '' : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`)

// ---- Names and credits --------------------------------------------------------------------------------------------

export const cleanName = (v: string) => v.trim().replace(/\s+/g, ' ')

// Drops rows with no name (a title on its own means nothing) and tidies the rest.
export const cleanCredits = (rows: CreditRow[]): CreditRow[] =>
  rows.map((r) => ({ name: cleanName(r.name), title: r.title || DEFAULT_CONTRIBUTOR_TITLE })).filter((r) => r.name)

export const cleanArtists = (names: string[]): string[] => names.map(cleanName).filter(Boolean)

export const newCredit = (): CreditRow => ({ name: '', title: DEFAULT_CONTRIBUTOR_TITLE })

// A title already saved that is no longer in the list is kept as it is, so nothing stored is lost on the next save.
export const knownTitle = (t: string) => CONTRIBUTOR_TITLES.includes(t)

// ---- Checks before saving -----------------------------------------------------------------------------------------

// Originally released must be on or before the sales start date. YYYY-MM-DD strings compare correctly as text.
export function dateOrderProblem(originallyReleased: string, salesStartDate: string): string | null {
  return originallyReleased && salesStartDate && originallyReleased > salesStartDate
    ? 'Originally released must be on or before the sales start date.' : null
}

function creditDuplicates(rows: CreditRow[], where: string): string | null {
  const seen = new Set<string>()
  for (const c of cleanCredits(rows)) {
    const key = `${c.name.toLowerCase()}|${c.title}`
    if (seen.has(key)) return `“${c.name}” is credited as ${c.title} twice${where}.`
    seen.add(key)
  }
  return null
}

// Everything that would make the server refuse the save, as plain sentences. Empty means fine.
export function validateDistribution(form: ReleaseForm): string[] {
  const problems: string[] = []
  const date = dateOrderProblem(form.originallyReleased, form.salesStartDate)
  if (date) problems.push(date)

  const seen = new Set<string>()
  for (const a of cleanArtists(form.primaryArtists)) {
    if (seen.has(a.toLowerCase())) problems.push(`“${a}” is listed twice as a primary artist.`)
    seen.add(a.toLowerCase())
  }

  const release = creditDuplicates(form.credits, '')
  if (release) problems.push(release)

  form.tracks.forEach((t, i) => {
    const label = `Song ${i + 1}${t.title ? ` (“${t.title}”)` : ''}`
    const featured = new Set<string>()
    for (const f of cleanArtists(t.featuring)) {
      if (featured.has(f.toLowerCase())) problems.push(`${label}: “${f}” is listed twice as a featured artist.`)
      featured.add(f.toLowerCase())
    }
    const preview = parseStartTime(t.previewStart)
    if (!preview.ok) problems.push(`${label}: the preview start should look like 0:45, or a number of seconds up to ${MAX_PREVIEW_SECONDS}.`)
    else if (preview.seconds !== null && t.durationSeconds && preview.seconds >= t.durationSeconds) {
      problems.push(`${label}: the preview start (${formatStartTime(preview.seconds)}) is after the end of the song (${formatStartTime(t.durationSeconds)}).`)
    }
    const dup = creditDuplicates(t.credits, ` on ${label.toLowerCase()}`)
    if (dup) problems.push(dup)
  })
  return problems
}

// ---- Cover art guidance -------------------------------------------------------------------------------------------

// General guidance, not tied to any one distributor. The server checks the size and weight and warns;
// the rest cannot be checked by a program, so the artist reads the list and confirms.
export const ART_TARGET = 'A square image, 3000 x 3000 pixels, under 25 MB, in RGB colour. JPEG or PNG.'
export const ART_NOT_ALLOWED: readonly string[] = [
  'Web addresses (URLs) or contact details',
  'Pornographic images',
  'Pricing or sales information',
  'Copyrighted images you do not have the right to use',
  'Scans of a CD',
  'Blurry or pixelated images',
  'A colour space other than RGB',
]

// ---- ready -----------------------------------------------------------------
export type ReadyResult =
  | { ok: true }
  | { ok: false; error: string; problems?: string[] }

export async function tryMarkReady(rid: string): Promise<ReadyResult> {
  try {
    await api(`/releases/${rid}/ready`, 'POST')
    return { ok: true }
  } catch (e) {
    const ae = e as ApiError
    if (ae.details) return { ok: false, error: ae.message, problems: ae.details }
    throw e
  }
}

// ---- splitRows -------------------------------------------------------------
export type SendResult = { trackId: string; name: string; email: string; action: string }

export const SEND_TEXT: Record<string, string> = {
  sent: 'invitation sent',
  updated: 'details changed, updated invitation sent',
  resent: 'invitation sent again',
  unchanged: 'already invited, nothing to send',
  blocked: 'removed themselves and cannot be invited again',
  limit: 'daily invitation limit reached, try again tomorrow',
  skipped_self: 'that is your own email, skipped',
  email_failed: 'the email could not be sent, nothing was recorded. Click send again in a few minutes',
}

// One line on the Splits page: a sent notice, or someone with an email who has not been invited yet.
export interface Row {
  key: string; trackId: string; noticeId?: string; name: string; email: string | null; role: string; share: number
  status: string; note: string | null; expiresAt?: string; canRemind: boolean
}

// Notices plus the people with an email but no notice yet (the owner's own email never gets one).
export function buildRows(notices: Notice[], people: Collaborator[], tracks: Track[], ownerEmail?: string): Row[] {
  const title = (tid: string) => tracks.find((t) => t.id === tid)?.title ?? 'Song'
  return [
    ...notices.map((n): Row => ({
      key: n.id, trackId: n.track_id, noticeId: n.id,
      name: n.co_writer_name ?? (n.status === 'removed' ? 'Removed by writer' : 'Email removed'),
      email: n.email, role: n.role, share: Number(n.share_percent), status: n.status, note: n.note,
      expiresAt: n.expires_at,
      canRemind: n.status === 'pending' && !n.reminder_sent_at && !!n.email && new Date(n.expires_at) > new Date(),
    })),
    ...people.filter((c) => c.invited_email && !c.removed_by_writer && c.invited_email !== ownerEmail
      && !notices.some((n) => n.track_id === c.track_id && n.email?.toLowerCase() === c.invited_email!.toLowerCase()))
      .map((c): Row => ({
        key: c.id, trackId: c.track_id, name: c.legal_name, email: c.invited_email, role: c.role,
        share: Number(c.ownership_percent), status: 'not_sent', note: null, canRemind: false,
      })),
  ].sort((a, b) => title(a.trackId).localeCompare(title(b.trackId)))
}

// Statuses that still need the co-writer (or the artist) to do something.
const AWAITING = ['not_sent', 'pending', 'disputed', 'expired']

export function summarize(rows: Row[], removedLines: number) {
  return {
    confirmed: rows.filter((r) => r.status === 'confirmed').length,
    awaiting: rows.filter((r) => AWAITING.includes(r.status)).length,
    disputed: rows.filter((r) => r.status === 'disputed').length,
    removed: removedLines,
  }
}

// ---- groups ----------------------------------------------------------------
// The four Discography groups. A release lands in the first one that matches.
export type Group = 'released' | 'awaiting' | 'draft' | 'yet'

export function groupOf(r: Release): Group {
  if (r.released_at) return 'released'
  if (r.status === 'draft') return (r.pending_notices ?? 0) > 0 ? 'awaiting' : 'draft'
  return 'yet'
}

// ---- focusFields -----------------------------------------------------------
// Which part of the edit form each readiness check points at. The key is the check id from the server.
// Checks that open another page (the splits page) get no focus parameter.
const FIELD_FOR_CHECK: Record<string, string> = {
  'release-date': 'release-date',
  'release-artwork': 'cover-art',
  'no-tracks': 'song-info',
  'track-audio': 'track-audio',
  'track-splits': 'track-splits',
  'dist-sales-start': 'sales-start',
  'dist-sales-start-soon': 'sales-start',
  'dist-sales-start-far': 'sales-start',
  'dist-originally-released': 'originally-released',
  'dist-date-order': 'originally-released',
  'dist-preorder-order': 'preorder',
  'dist-preorder-far': 'preorder',
  'dist-primary-artists': 'primary-artists',
  'dist-art-size': 'cover-art',
  'dist-art-bytes': 'cover-art',
  'dist-audio-spec': 'track-audio',
  'dist-track-lyrics': 'track-lyrics',
  'isrc-missing': 'track-isrc',
  'upc-missing': 'upc',
}

// Adds ?focus=<field> to a fix link that opens the edit form.
export function fixLink(fix: string, checkId: string): string {
  const field = FIELD_FOR_CHECK[checkId]
  if (!field || !/\/edit(\?|$)/.test(fix)) return fix
  return `${fix}${fix.includes('?') ? '&' : '?'}focus=${field}`
}
