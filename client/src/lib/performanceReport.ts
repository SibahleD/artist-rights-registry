// Builds the monthly, yearly and custom-range PDF reports for the Performance page.
import type { PdfReport } from './pdf'
import { fmtInt, fmtMonth } from './format'
import { platformLabel } from './streamImport'
import {
  filterStats, isrcsFor, monthsBetween, ranked, sumBy, total, unmatchedLines,
  type CatalogTrack, type Range, type Selection, type StatRow,
} from './performance'

export type ReportKind = 'monthly' | 'yearly' | 'custom'

export interface ReportInput {
  kind: ReportKind
  range: Range
  artist: string
  stats: StatRow[]
  tracks: CatalogTrack[]
  selection: Selection
}

export const REPORT_NOTE = 'Figures come from the files you imported into Track Record and may differ from your distributor statements.'

function scopeName(sel: Selection, tracks: CatalogTrack[]): string {
  if (!sel) return 'All releases'
  if (sel.kind === 'release') return tracks.find((t) => t.release_id === sel.id)?.release_title ?? 'Release'
  const t = tracks.find((x) => x.id === sel.id)
  return t ? `${t.title} (${t.release_title})` : 'Song'
}

export function reportTitle(kind: ReportKind, range: Range): string {
  if (kind === 'monthly') return `Monthly streaming report: ${fmtMonth(`${range.from}-01`)}`
  if (kind === 'yearly') return `Yearly streaming report: ${range.from.slice(0, 4)}`
  return `Streaming report: ${fmtMonth(`${range.from}-01`, true)} to ${fmtMonth(`${range.to}-01`, true)}`
}

export function buildPerformanceReport(i: ReportInput): PdfReport {
  const isrcs = isrcsFor(i.selection, i.tracks)
  const rows = filterStats(i.stats, i.range, isrcs)
  const sum = total(rows)
  const months = monthsBetween(i.range.from, i.range.to)
  const byMonth = sumBy(rows, (r) => r.period.slice(0, 7))
  const byPlatform = ranked(sumBy(rows, (r) => r.platform))
  const byIsrc = sumBy(rows, (r) => r.isrc)
  const best = ranked(byMonth)[0]

  const blocks: PdfReport['blocks'] = [
    { type: 'stats', items: [
      { label: 'Total streams', value: fmtInt(sum) },
      { label: 'Platforms', value: String(byPlatform.length) },
      { label: months.length > 1 ? 'Best month' : 'Songs with streams', value: months.length > 1 ? (best ? fmtMonth(`${best[0]}-01`, true) : 'None') : String(byIsrc.size) },
    ] },
  ]

  if (sum === 0) {
    blocks.push({ type: 'text', text: 'There are no streams recorded for this period. Import your distributor CSV on the Performance page to fill it in.', muted: true })
  } else {
    blocks.push({ type: 'heading', text: 'Streams by platform' })
    blocks.push({ type: 'bars', items: byPlatform.map(([id, v]) => ({ label: platformLabel(id), value: v })), format: fmtInt })

    if (months.length > 1) {
      blocks.push({ type: 'heading', text: 'Streams by month' })
      blocks.push({ type: 'table', table: {
        head: ['Month', 'Streams'], align: ['left', 'right'], widths: [3, 1],
        rows: months.map((m) => [fmtMonth(`${m}-01`), fmtInt(byMonth.get(m) ?? 0)]),
      } })
    }

    const trackByIsrc = new Map(i.tracks.filter((t) => t.isrc).map((t) => [t.isrc as string, t]))
    const songs = ranked(byIsrc).filter(([isrc]) => trackByIsrc.has(isrc)).slice(0, 200)
    if (songs.length) {
      blocks.push({ type: 'heading', text: 'Streams by song' })
      blocks.push({ type: 'table', table: {
        head: ['Song', 'Release', 'Streams', 'Share'], align: ['left', 'left', 'right', 'right'], widths: [3, 3, 1.2, 1],
        rows: songs.map(([isrc, v]) => {
          const t = trackByIsrc.get(isrc)!
          return [t.title, t.release_title, fmtInt(v), `${((v / sum) * 100).toFixed(1)}%`]
        }),
      } })
    }
    if (!i.selection) {
      const loose = unmatchedLines(i.tracks, rows)
      if (loose.length) {
        blocks.push({ type: 'text', text: `${fmtInt(loose.reduce((a, [, v]) => a + v, 0))} streams in this period belong to ${loose.length} ISRC${loose.length === 1 ? '' : 's'} that are not on any song in your catalogue, so they appear in the totals but not in the song list.`, muted: true })
      }
    }
  }

  const stamp = i.kind === 'yearly' ? i.range.from.slice(0, 4) : i.range.from === i.range.to ? i.range.from : `${i.range.from}_to_${i.range.to}`
  return {
    title: reportTitle(i.kind, i.range),
    subtitle: `${i.artist}  |  ${scopeName(i.selection, i.tracks)}`,
    fileName: `track-record-streams-${stamp}.pdf`,
    footerNote: REPORT_NOTE,
    blocks,
  }
}
