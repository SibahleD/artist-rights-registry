// Turns the rows of a distributor's CSV into stream figures: guesses which column is which, reads the
// dates, platform names and numbers in their many spellings, and reports what could not be read.
//
// The server checks everything again. This is here so the artist sees problems before importing.

import { SERVICES, serviceById } from '../data/services'

export type FieldKey = 'isrc' | 'streams' | 'period' | 'platform'
export type DateOrder = 'dmy' | 'mdy'

/** Column index for each field, or -1 when there is none. */
export type Mapping = Record<FieldKey, number>

export interface StreamRow { isrc: string; platform: string; period: string; streams: number }

export const FIELD_LABELS: Record<FieldKey, string> = {
  isrc: 'ISRC', streams: 'Streams', period: 'Month or date', platform: 'Platform / store',
}

// ---- Column guessing ------------------------------------------------------------------------------------

const GUESS: Record<FieldKey, RegExp[]> = {
  isrc: [/^isrc$/i, /isrc/i],
  streams: [/^(total )?streams?$/i, /^(net )?(units|quantity|plays)$/i, /stream|quantity|units|plays|listens/i],
  period: [/^(reporting|sales?|statement|report)[ _-]?(month|period|date)$/i, /^(month|period)$/i, /month|period|date/i],
  platform: [/^(store|platform|service|dsp|retailer|outlet|channel)$/i, /store|platform|service|dsp|retailer|outlet|channel/i],
}

export function guessMapping(headers: string[]): Mapping {
  const m: Mapping = { isrc: -1, streams: -1, period: -1, platform: -1 }
  const taken = new Set<number>()
  for (const key of Object.keys(GUESS) as FieldKey[]) {
    for (const re of GUESS[key]) {
      const i = headers.findIndex((h, idx) => !taken.has(idx) && re.test(h.trim()))
      if (i !== -1) { m[key] = i; taken.add(i); break }
    }
  }
  return m
}

// ---- Platforms -------------------------------------------------------------------------------------------

const ALIASES: [RegExp, string][] = [
  [/^spotify/, 'spotify'],
  [/^apple\s*music|^applemusic/, 'apple_music'],
  [/^itunes/, 'itunes'],
  [/^youtube\s*music|^yt\s*music/, 'youtube_music'],
  [/^youtube|^yt\b|^google\s*play/, 'youtube'],
  [/^amazon/, 'amazon_music'],
  [/^deezer/, 'deezer'],
  [/^tidal/, 'tidal'],
  [/^soundcloud/, 'soundcloud'],
  [/^boomplay/, 'boomplay'],
  [/^audiomack/, 'audiomack'],
  [/^tiktok|^tik\s*tok/, 'tiktok'],
  [/^instagram|^facebook|^meta\b/, 'facebook'],
]

/** "Spotify", "Apple Music (Free)" -> the app's service id; unknown names become a tidy id of their own. */
export function platformId(name: string): string | null {
  const s = name.trim().toLowerCase()
  if (!s) return null
  for (const [re, id] of ALIASES) if (re.test(s)) return id
  const slug = s.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
  return slug || null
}

/** A readable name for any platform id, including ones the app does not list. */
export function platformLabel(id: string): string {
  return serviceById(id)?.label ?? id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export const STREAMING_PLATFORMS = SERVICES.filter((s) => s.kind === 'streaming')

// ---- Values ----------------------------------------------------------------------------------------------

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const ok = (y: number, m: number) => (y >= 2000 && y <= 2100 && m >= 1 && m <= 12 ? `${y}-${String(m).padStart(2, '0')}` : null)

/** Reads a date or month in common layouts and returns "YYYY-MM", or null. */
export function parsePeriod(raw: string, order: DateOrder = 'dmy'): string | null {
  const s = raw.trim()
  let m: RegExpExecArray | null
  if ((m = /^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?(?:[ T].*)?$/.exec(s))) return ok(+m[1], +m[2])
  if ((m = /^(\d{4})(\d{2})$/.exec(s))) return ok(+m[1], +m[2])
  if ((m = /^(\d{1,2})[-/.](\d{4})$/.exec(s))) return ok(+m[2], +m[1])
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[ T].*)?$/.exec(s))) {
    const a = +m[1], b = +m[2]
    if (a > 12) return ok(+m[3], b)           // 25/09/2026 can only be day/month
    if (b > 12) return ok(+m[3], a)           // 09/25/2026 can only be month/day
    return ok(+m[3], order === 'dmy' ? b : a)
  }
  if ((m = /^([a-z]{3})[a-z]*[ ,.-]+(\d{4})$/i.exec(s))) {
    const i = MONTH_NAMES.indexOf(m[1].toLowerCase())
    return i === -1 ? null : ok(+m[2], i + 1)
  }
  if ((m = /^(\d{4})[ ,.-]+([a-z]{3})[a-z]*$/i.exec(s))) {
    const i = MONTH_NAMES.indexOf(m[2].toLowerCase())
    return i === -1 ? null : ok(+m[1], i + 1)
  }
  return null
}

/** A whole number of streams: "1,234", "1 234" and "12.0" are fine; "12.5" and text are not. */
export function parseStreamCount(raw: string): number | null {
  const s = raw.trim().replace(/[\s,]/g, '')
  if (!/^\d+(\.0+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isSafeInteger(n) ? n : null
}

export const parseIsrc = (raw: string): string | null => {
  const s = raw.trim().toUpperCase().replace(/[\s-]/g, '')
  return /^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(s) ? s : null
}

// ---- Putting it together -----------------------------------------------------------------------------------

export interface ParseOptions {
  mapping: Mapping
  /** Used for every row when the file has no platform column. */
  fixedPlatform: string
  dateOrder: DateOrder
}

export interface ParseResult {
  rows: StreamRow[]
  /** Data rows read from the file. */
  read: number
  /** Reason -> how many rows failed for it. */
  problems: Record<string, number>
  months: string[]
  platforms: string[]
}

export function readRows(data: string[][], opts: ParseOptions): ParseResult {
  const { mapping: m } = opts
  const merged = new Map<string, StreamRow>()
  const problems: Record<string, number> = {}
  const bad = (why: string) => { problems[why] = (problems[why] ?? 0) + 1 }

  for (const r of data) {
    const isrc = m.isrc >= 0 ? parseIsrc(r[m.isrc] ?? '') : null
    if (!isrc) { bad('Missing or invalid ISRC'); continue }
    const platform = m.platform >= 0 ? platformId(r[m.platform] ?? '') : opts.fixedPlatform || null
    if (!platform) { bad('No platform'); continue }
    const period = m.period >= 0 ? parsePeriod(r[m.period] ?? '', opts.dateOrder) : null
    if (!period) { bad('Date not recognised'); continue }
    const streams = m.streams >= 0 ? parseStreamCount(r[m.streams] ?? '') : null
    if (streams === null) { bad('Streams is not a whole number'); continue }
    const key = `${isrc}|${platform}|${period}`
    const hit = merged.get(key)
    if (hit) hit.streams += streams
    else merged.set(key, { isrc, platform, period, streams })
  }
  const rows = [...merged.values()]
  return {
    rows, read: data.length, problems,
    months: [...new Set(rows.map((r) => r.period))].sort(),
    platforms: [...new Set(rows.map((r) => r.platform))].sort(),
  }
}
