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
export const REVIEWED_ON = '2026-10-29'

export const RATES: readonly PlatformRate[] = [
  { id: 'spotify',       low: 0.003,  typical: 0.004,  high: 0.005, source: 'Royalty Exchange, OnesToWatch, 2026' },
  { id: 'apple_music',   low: 0.007,  typical: 0.0085, high: 0.01,  source: 'Royalty Exchange, 2026 (some sources report lower)' },
  { id: 'amazon_music',  low: 0.004,  typical: 0.004,  high: 0.005, source: 'Royalty Exchange, 2026' },
  { id: 'deezer',        low: 0.005,  typical: 0.006,  high: 0.007, source: 'Royalty Exchange, 2026' },
  { id: 'tidal',         low: 0.012,  typical: 0.0135, high: 0.015, source: 'Royalty Exchange, 2026' },
  { id: 'youtube_music', low: 0.0007, typical: 0.001,  high: 0.002, source: 'Royalty Exchange, 2026 (estimates vary widely)' },
  { id: 'youtube',       low: 0.0005, typical: 0.0007, high: 0.001, source: 'Industry estimate via ads and Content ID' },
  { id: 'boomplay',       low: 0.001,  typical: 0.003,  high: 0.005, source: 'Widely repeated $0.003-$0.005 range (SoundCloud, Adom Online, 2026); Nigerian rates near $0.001 (Interspace). Boomplay does not publish its rate' },
  { id: 'audiomack',     low: 0.0005, typical: 0.001,  high: 0.003, source: 'Audiomack AMP page (variable rate, 50% share); third-party estimates vary widely' },
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

// Shown on the Earnings page and repeated on every export.
export const EARNINGS_DISCLAIMER =
  'These figures are estimates. They multiply your streams by an industry average revenue per stream and do not ' +
  'reflect what you were actually paid. Check your distributor dashboard or statements for your true earnings.'
