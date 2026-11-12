import { parseCsv } from './stats'

// The Spotify for Artists "audience timeline" export: one row per day for the whole catalogue.
export const AUDIENCE_COLUMNS = ['listeners', 'monthly_listeners', 'monthly_active_listeners', 'super_listeners', 'streams', 'playlist_adds', 'saves', 'followers'] as const
export type AudienceColumn = typeof AUDIENCE_COLUMNS[number]
export type AudienceDay = { day: string } & Record<AudienceColumn, number>
export type AudienceRow = { date: string } & Record<AudienceColumn, string>

const key = (h: string) => h.trim().toLowerCase().replace(/\s+/g, '_')

export interface ParsedAudience { rows: AudienceRow[]; error?: string }

// Reads the file text and checks the header is Spotify's. The server checks every value again.
export function readSpotifyCsv(text: string): ParsedAudience {
  const table = parseCsv(text)
  if (table.length < 2) return { rows: [], error: 'That file has no data rows. Check that it is the CSV from Spotify for Artists.' }
  const idx = new Map(table[0].map((h, i) => [key(h), i]))
  const missing = ['date', ...AUDIENCE_COLUMNS].filter((c) => !idx.has(c))
  if (missing.length) {
    return { rows: [], error: `This does not look like the Spotify for Artists audience file. Missing column${missing.length === 1 ? '' : 's'}: ${missing.map((m) => m.replace(/_/g, ' ')).join(', ')}.` }
  }
  const rows = table.slice(1).map((r) => {
    const o = { date: (r[idx.get('date')!] ?? '').trim() } as AudienceRow
    for (const c of AUDIENCE_COLUMNS) o[c] = (r[idx.get(c)!] ?? '').trim()
    return o
  })
  return { rows }
}

export const sumOf = (days: AudienceDay[], c: AudienceColumn) => days.reduce((a, d) => a + d[c], 0)

/** One value per month: the sum for flow figures (streams), the last day's value for running totals (listeners, followers). */
export function byMonth(days: AudienceDay[], c: AudienceColumn, how: 'sum' | 'last'): [string, number][] {
  const m = new Map<string, number>()
  for (const d of days) {
    const k = d.day.slice(0, 7)
    m.set(k, how === 'sum' ? (m.get(k) ?? 0) + d[c] : d[c])
  }
  return [...m.entries()]
}
