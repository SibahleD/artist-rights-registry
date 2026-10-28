// Estimated earnings from stream figures. Every number here is an ESTIMATE: streams multiplied by an
// average revenue per stream for the platform (data/rates.ts). Platforms with no rate are left out and listed.
import { estimate, type Estimate } from '../data/rates'
import type { StatRow } from './performance'

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
