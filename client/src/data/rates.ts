// Average revenue per stream (ARPS), in US dollars, used by the Earnings page to ESTIMATE earnings.
//
// These are industry averages, not rates any platform publishes or guarantees. Platforms pay out of a shared
// pool, so the real figure depends on the listener's country, free or paid plan, and your distributor's deal.
// `typical` is used for the estimate; `low` and `high` give the range. A null rate means we have no
// dependable figure, so the Earnings page shows "no rate set" instead of guessing.
//
// To update: edit the numbers below and bump REVIEWED_ON. Sources are noted per row.

export interface PlatformRate {
  /** Service id from data/services.ts */
  id: string
  low: number
  typical: number
  high: number
  source: string
}

export const RATE_CURRENCY = 'USD'
export const REVIEWED_ON = '2026-10-27'

export const RATES: readonly PlatformRate[] = [
  { id: 'spotify',       low: 0.003,  typical: 0.004,  high: 0.005, source: 'Royalty Exchange, OnesToWatch, 2026' },
  { id: 'apple_music',   low: 0.007,  typical: 0.0085, high: 0.01,  source: 'Royalty Exchange, 2026 (some sources report lower)' },
  { id: 'amazon_music',  low: 0.004,  typical: 0.004,  high: 0.005, source: 'Royalty Exchange, 2026' },
  { id: 'deezer',        low: 0.005,  typical: 0.006,  high: 0.007, source: 'Royalty Exchange, 2026' },
  { id: 'tidal',         low: 0.012,  typical: 0.0135, high: 0.015, source: 'Royalty Exchange, 2026' },
  { id: 'youtube_music', low: 0.0007, typical: 0.001,  high: 0.002, source: 'Royalty Exchange, 2026 (estimates vary widely)' },
  { id: 'youtube',       low: 0.0005, typical: 0.0007, high: 0.001, source: 'Industry estimate via ads and Content ID' },
]

const BY_ID = new Map(RATES.map((r) => [r.id, r]))
export const rateFor = (platformId: string): PlatformRate | undefined => BY_ID.get(platformId)

export interface Estimate { low: number; typical: number; high: number }

/** Estimated earnings for `streams` on one platform, or null when the platform has no rate. */
export function estimate(platformId: string, streams: number): Estimate | null {
  const r = rateFor(platformId)
  if (!r || !Number.isFinite(streams) || streams < 0) return null
  return { low: streams * r.low, typical: streams * r.typical, high: streams * r.high }
}

/** Adds up estimates across platforms; platforms without a rate are listed in `unrated`. */
export function estimateTotal(byPlatform: Record<string, number>): { total: Estimate; unrated: string[] } {
  const total = { low: 0, typical: 0, high: 0 }
  const unrated: string[] = []
  for (const [id, streams] of Object.entries(byPlatform)) {
    const e = estimate(id, streams)
    if (!e) { if (streams > 0) unrated.push(id); continue }
    total.low += e.low; total.typical += e.typical; total.high += e.high
  }
  return { total, unrated }
}

// Shown on the Earnings page and repeated on every export.
export const EARNINGS_DISCLAIMER =
  'These figures are estimates. They multiply your streams by an industry average revenue per stream and do not ' +
  'reflect what you were actually paid. Check your distributor dashboard or statements for your true earnings.'
