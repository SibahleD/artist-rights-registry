// Helpers for the distribution details on the listing form. Plain functions, no React, so they can be tested on their own.
// The rules mirror server/src/lib/distribution.js. The server is the one that counts; these only catch mistakes before anything is saved.

import type { CreditRow, ReleaseForm, YesNo } from '../types'
import { CONTRIBUTOR_TITLES, DEFAULT_CONTRIBUTOR_TITLE } from '../data/contributorTitles'

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
    if (!parseStartTime(t.previewStart).ok) problems.push(`${label}: the preview start should look like 0:45, or a number of seconds up to ${MAX_PREVIEW_SECONDS}.`)
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
