import type { PdfReport } from './pdf'
import { EARNINGS_DISCLAIMER, RATE_CURRENCY, REVIEWED_ON, rateFor } from '../data/rates'
import { earn, earnBy, rankedEst, unrated } from './earnings'
import { fmtInt, fmtMoney, fmtMonth } from './format'
import { filterStats, monthsBetween, sumBy, total, type CatalogTrack, type Range, type StatRow } from './performance'
import { platformLabel } from './streamImport'

// The disclaimer is printed as the first thing in the body AND in the footer of every page.
export function buildEarningsReport(a: { range: Range; artist: string; stats: StatRow[]; tracks: CatalogTrack[] }): PdfReport {
  const rows = filterStats(a.stats, a.range, null)
  const months = monthsBetween(a.range.from, a.range.to)
  const e = earn(rows)
  const money = (n: number) => fmtMoney(n, RATE_CURRENCY)
  const byPlatform = sumBy(rows, (r) => r.platform)
  const estPlatform = earnBy(rows, (r) => r.platform)
  const estMonth = earnBy(rows, (r) => r.period.slice(0, 7))
  const missing = unrated(rows)
  const trackByIsrc = new Map(a.tracks.filter((t) => t.isrc).map((t) => [t.isrc as string, t]))

  const blocks: PdfReport['blocks'] = [
    { type: 'text', text: `ESTIMATE ONLY. ${EARNINGS_DISCLAIMER}` },
    { type: 'stats', items: [
      { label: 'Estimated earnings', value: money(e.typical) },
      { label: 'Likely range', value: `${money(e.low)} - ${money(e.high)}` },
      { label: 'Streams', value: fmtInt(total(rows)) },
    ] },
  ]
  if (rows.length) {
    blocks.push({ type: 'heading', text: 'By platform' })
    blocks.push({ type: 'table', table: {
      head: ['Platform', 'Streams', 'Rate per stream', 'Estimate'], align: ['left', 'right', 'right', 'right'], widths: [3, 2, 2, 2],
      rows: [...byPlatform.entries()].sort((x, y) => y[1] - x[1]).map(([id, s]) => {
        const r = rateFor(id)
        return [platformLabel(id), fmtInt(s), r ? money(r.typical) : 'No rate', r ? money(estPlatform.get(id)?.typical ?? 0) : '-']
      }),
    } })
    if (months.length > 1) {
      blocks.push({ type: 'heading', text: 'By month' })
      blocks.push({ type: 'table', table: { head: ['Month', 'Estimate'], align: ['left', 'right'], widths: [3, 1],
        rows: months.map((m) => [fmtMonth(`${m}-01`), money(estMonth.get(m)?.typical ?? 0)]) } })
    }
    const songs = rankedEst(earnBy(rows, (r) => r.isrc)).filter(([isrc]) => trackByIsrc.has(isrc)).slice(0, 200)
    if (songs.length) {
      blocks.push({ type: 'heading', text: 'By song' })
      blocks.push({ type: 'table', table: { head: ['Song', 'Release', 'Estimate'], align: ['left', 'left', 'right'], widths: [3, 3, 1.5],
        rows: songs.map(([isrc, v]) => [trackByIsrc.get(isrc)!.title, trackByIsrc.get(isrc)!.release_title, money(v.typical)]) } })
    }
  }
  const notes = [`Rates are industry averages in ${RATE_CURRENCY}, last reviewed ${REVIEWED_ON}.`]
  if (missing.length) notes.push(`No rate is set for ${missing.map(platformLabel).join(', ')}, so those streams are left out of the estimate.`)
  blocks.push({ type: 'text', text: notes.join(' '), muted: true })

  const same = a.range.from === a.range.to
  return {
    title: same ? `Estimated earnings: ${fmtMonth(`${a.range.from}-01`)}` : `Estimated earnings: ${fmtMonth(`${a.range.from}-01`, true)} to ${fmtMonth(`${a.range.to}-01`, true)}`,
    subtitle: a.artist,
    fileName: `track-record-earnings-estimate-${same ? a.range.from : `${a.range.from}_to_${a.range.to}`}.pdf`,
    footerNote: EARNINGS_DISCLAIMER,
    blocks,
  }
}
