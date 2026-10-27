// Sums and groups stream figures for the Performance page and its PDF reports.
// Months are "YYYY-MM" strings throughout, which sort and compare correctly as text.

export interface StatRow { isrc: string; platform: string; period: string; streams: number }
export interface CatalogTrack {
  id: string; title: string; isrc: string | null; track_number: number
  release_id: string; release_title: string; release_type: 'single' | 'ep' | 'album'
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

export interface TrackLine { id: string; title: string; isrc: string | null; streams: number }
export interface ReleaseLine { id: string; title: string; type: string; streams: number; tracks: TrackLine[] }

/** One line per release, with each song's streams and the release total made by adding its songs. */
export function releaseLines(tracks: CatalogTrack[], rows: StatRow[]): ReleaseLine[] {
  const byIsrc = sumBy(rows, (r) => r.isrc)
  const map = new Map<string, ReleaseLine>()
  for (const t of tracks) {
    let rel = map.get(t.release_id)
    if (!rel) { rel = { id: t.release_id, title: t.release_title, type: t.release_type, streams: 0, tracks: [] }; map.set(t.release_id, rel) }
    const streams = t.isrc ? byIsrc.get(t.isrc) ?? 0 : 0
    rel.tracks.push({ id: t.id, title: t.title, isrc: t.isrc, streams })
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
