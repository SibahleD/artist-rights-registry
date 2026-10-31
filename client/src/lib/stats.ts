import { estimate, type Estimate } from '../data/rates'
import { SERVICES, serviceById } from '../data/services'

// ---- performance -----------------------------------------------------------
// Sums and groups stream figures for the Performance page and its PDF reports.
// Months are "YYYY-MM" strings throughout, which sort and compare correctly as text.

export interface StatRow { isrc: string; platform: string; period: string; streams: number }
export interface CatalogTrack {
  id: string; title: string; isrc: string | null; track_number: number
  release_id: string; release_title: string; release_type: 'single' | 'ep' | 'album'
  artwork_id?: string | null; has_audio?: boolean
}
export interface PerfData { stats: StatRow[]; tracks: CatalogTrack[]; first_period: string | null; last_period: string | null }

export type Selection = { kind: 'release' | 'track'; id: string } | null
export interface Range { from: string; to: string }

export const monthOf = (period: string) => period.slice(0, 7)

/** Every month from `from` to `to`, inclusive. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  let [y, m] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    if (++m > 12) { m = 1; y++ }
    if (out.length > 600) break
  }
  return out
}

export const currentMonth = () => new Date().toLocaleDateString('en-CA').slice(0, 7)

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number)
  const i = y * 12 + (m - 1) + by
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
}

/** The ISRCs a selection covers, or null for "everything". */
export function isrcsFor(sel: Selection, tracks: CatalogTrack[]): Set<string> | null {
  if (!sel) return null
  const hit = sel.kind === 'track' ? tracks.filter((t) => t.id === sel.id) : tracks.filter((t) => t.release_id === sel.id)
  return new Set(hit.map((t) => t.isrc).filter((x): x is string => !!x))
}

export function filterStats(stats: StatRow[], range: Range, isrcs: Set<string> | null): StatRow[] {
  return stats.filter((s) => {
    const m = monthOf(s.period)
    return m >= range.from && m <= range.to && (!isrcs || isrcs.has(s.isrc))
  })
}

export const total = (rows: StatRow[]) => rows.reduce((a, r) => a + r.streams, 0)

export function sumBy(rows: StatRow[], key: (r: StatRow) => string): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of rows) out.set(key(r), (out.get(key(r)) ?? 0) + r.streams)
  return out
}

export const ranked = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

export interface TrackLine { id: string; title: string; isrc: string | null; streams: number; trackNumber: number; hasAudio: boolean }
export interface ReleaseLine { id: string; title: string; type: string; artworkId: string | null; streams: number; tracks: TrackLine[] }

/** One line per release, with each song's streams and the release total made by adding its songs. */
export function releaseLines(tracks: CatalogTrack[], rows: StatRow[]): ReleaseLine[] {
  const byIsrc = sumBy(rows, (r) => r.isrc)
  const map = new Map<string, ReleaseLine>()
  for (const t of tracks) {
    let rel = map.get(t.release_id)
    if (!rel) { rel = { id: t.release_id, title: t.release_title, type: t.release_type, artworkId: t.artwork_id ?? null, streams: 0, tracks: [] }; map.set(t.release_id, rel) }
    const streams = t.isrc ? byIsrc.get(t.isrc) ?? 0 : 0
    rel.tracks.push({ id: t.id, title: t.title, isrc: t.isrc, streams, trackNumber: t.track_number, hasAudio: !!t.has_audio })
    rel.streams += streams
  }
  return [...map.values()]
}

/** Figures whose ISRC is not on any of the artist's songs, grouped by ISRC. */
export function unmatchedLines(tracks: CatalogTrack[], rows: StatRow[]): [string, number][] {
  const known = new Set(tracks.map((t) => t.isrc).filter(Boolean))
  return ranked(sumBy(rows.filter((r) => !known.has(r.isrc)), (r) => r.isrc))
}

/** Matches a release or any of its songs against what the artist typed. */
export function matchesSearch(rel: ReleaseLine, q: string): { release: boolean; tracks: Set<string> } {
  const s = q.trim().toLowerCase()
  if (!s) return { release: true, tracks: new Set(rel.tracks.map((t) => t.id)) }
  const release = rel.title.toLowerCase().includes(s)
  const tracks = new Set(rel.tracks.filter((t) => release || t.title.toLowerCase().includes(s)).map((t) => t.id))
  return { release: release || tracks.size > 0, tracks }
}

export const RELEASE_TYPE_LABELS: Record<string, string> = { single: 'Single', ep: 'EP', album: 'Album' }
export const releaseTypeLabel = (t: string) => RELEASE_TYPE_LABELS[t] ?? t

// ---- earnings --------------------------------------------------------------
// Estimated earnings from stream figures. Every number here is an ESTIMATE: streams multiplied by an
// average revenue per stream for the platform (data/rates.ts). Platforms with no rate are left out and listed.



const zero = (): Estimate => ({ low: 0, typical: 0, high: 0 })
const add = (a: Estimate, b: Estimate) => { a.low += b.low; a.typical += b.typical; a.high += b.high }

export function earn(rows: StatRow[]): Estimate {
  const out = zero()
  for (const r of rows) { const e = estimate(r.platform, r.streams); if (e) add(out, e) }
  return out
}

export function earnBy(rows: StatRow[], key: (r: StatRow) => string): Map<string, Estimate> {
  const out = new Map<string, Estimate>()
  for (const r of rows) {
    const e = estimate(r.platform, r.streams)
    if (!e) continue
    const k = key(r)
    const cur = out.get(k) ?? zero()
    add(cur, e)
    out.set(k, cur)
  }
  return out
}

/** Platforms that have streams in `rows` but no rate, so they add nothing to the estimate. */
export function unrated(rows: StatRow[]): string[] {
  return [...new Set(rows.filter((r) => r.streams > 0 && !estimate(r.platform, 1)).map((r) => r.platform))].sort()
}

export const rankedEst = (m: Map<string, Estimate>) => [...m.entries()].sort((a, b) => b[1].typical - a[1].typical || a[0].localeCompare(b[0]))

// ---- streamImport ----------------------------------------------------------
// Turns the rows of a distributor's CSV into stream figures: guesses which column is which, reads the
// dates, platform names and numbers in their many spellings, and reports what could not be read.
//
// The server checks everything again. This is here so the artist sees problems before importing.



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

// ---- csv -------------------------------------------------------------------
// A small CSV reader for distributor exports, so no parsing library has to be shipped.
// Handles a byte-order mark, quoted fields (with "" for a quote and line breaks inside quotes),
// CRLF or LF, and comma, semicolon or tab separators (picked from the first lines).

export type Delimiter = ',' | ';' | '\t'

export function detectDelimiter(text: string): Delimiter {
  const sample = text.split(/\r?\n/).slice(0, 10).join('\n')
  let best: Delimiter = ','
  let bestCount = -1
  for (const d of [',', ';', '\t'] as const) {
    // Count separators outside quotes only.
    let n = 0, quoted = false
    for (const ch of sample) { if (ch === '"') quoted = !quoted; else if (ch === d && !quoted) n++ }
    if (n > bestCount) { best = d; bestCount = n }
  }
  return best
}

export function parseCsv(input: string, delimiter?: Delimiter): string[][] {
  const text = input.replace(/^\uFEFF/, '')
  const d = delimiter ?? detectDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  const endCell = () => { row.push(cell); cell = '' }
  const endRow = () => { endCell(); if (row.some((c) => c.trim() !== '')) rows.push(row); row = [] }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else quoted = false }
      else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === d) endCell()
    else if (ch === '\n') endRow()
    else if (ch === '\r') { if (text[i + 1] === '\n') i++; endRow() }
    else cell += ch
  }
  if (cell !== '' || row.length > 0) endRow()
  return rows
}

/** The row that holds the column names: the first row with at least three filled cells, else the first row. */
export function findHeaderRow(rows: string[][]): number {
  const i = rows.slice(0, 15).findIndex((r) => r.filter((c) => c.trim()).length >= 3)
  return i === -1 ? 0 : i
}
