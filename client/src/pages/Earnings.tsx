import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { BarList, LineChart } from '../components/Charts'
import { Collapsible, ErrorBox, Hint, Loading } from '../components/ui'
import { EARNINGS_DISCLAIMER, RATES, RATE_CURRENCY, REVIEWED_ON, rateFor } from '../data/rates'
import { earn, earnBy, rankedEst, unrated } from '../lib/earnings'
import { buildEarningsReport } from '../lib/earningsReport'
import { fmtInt, fmtMoney, fmtMonth } from '../lib/format'
import { currentMonth, filterStats, monthsBetween, shiftMonth, sumBy, total, type PerfData, type Range } from '../lib/performance'
import { platformLabel } from '../lib/streamImport'
import { Link } from 'react-router-dom'

const money = (n: number) => fmtMoney(n, RATE_CURRENCY)
const label = (m: string) => fmtMonth(`${m}-01`, true)

export default function Earnings() {
  const { user } = useAuth()
  const [data, setData] = useState<PerfData | null>(null)
  const [error, setError] = useState('')
  const [range, setRange] = useState<Range | null>(null)
  const [busy, setBusy] = useState(false)
  const [pdfError, setPdfError] = useState('')

  useEffect(() => {
    api<PerfData>('/streams').then((d) => {
      setData(d)
      const to = d.last_period?.slice(0, 7) ?? currentMonth()
      const from = shiftMonth(to, -11)
      const first = d.first_period?.slice(0, 7)
      setRange({ from: first && first > from ? first : from, to })
    }).catch((e) => setError((e as Error).message))
  }, [])

  const view = useMemo(() => {
    if (!data || !range) return null
    const rows = filterStats(data.stats, range, null)
    const months = monthsBetween(range.from, range.to)
    const byMonth = earnBy(rows, (r) => r.period.slice(0, 7))
    const streamsBy = sumBy(rows, (r) => r.platform)
    const estPlatform = earnBy(rows, (r) => r.platform)
    const byIsrc = earnBy(rows, (r) => r.isrc)
    const trackIsrcs = new Map<string, { title: string; release: string }>()
    for (const t of data.tracks) if (t.isrc) trackIsrcs.set(t.isrc, { title: t.title, release: t.release_title })
    return {
      rows, months, byMonth, streamsBy, estPlatform, e: earn(rows), missing: unrated(rows),
      songs: rankedEst(byIsrc).filter(([isrc]) => trackIsrcs.has(isrc)).map(([isrc, v]) => ({ ...trackIsrcs.get(isrc)!, v })),
    }
  }, [data, range])

  if (error) return <ErrorBox error={error} />
  if (!data || !range || !view) return <Loading what="Loading your earnings estimate" />

  const noData = data.stats.length === 0
  const lastMonth = data.last_period?.slice(0, 7) ?? currentMonth()
  const lastYear = lastMonth.slice(0, 4)
  const presets: [string, Range][] = [
    ['Last 12 months', { from: shiftMonth(lastMonth, -11), to: lastMonth }],
    [lastYear, { from: `${lastYear}-01`, to: `${lastYear}-12` }],
    ['All time', { from: data.first_period?.slice(0, 7) ?? lastMonth, to: lastMonth }],
  ]
  const rangeOk = range.from <= range.to && monthsBetween(range.from, range.to).length <= 120

  async function exportPdf() {
    if (!data || !range) return
    setBusy(true); setPdfError('')
    try {
      const { downloadReport } = await import('../lib/pdf')
      await downloadReport(buildEarningsReport({ range, artist: user?.artist_name ?? '', stats: data.stats, tracks: data.tracks }))
    } catch { setPdfError('Could not build the PDF. Try again.') }
    finally { setBusy(false) }
  }

  return (
    <div className="performance">
      <div className="row perf-head">
        <h2>Earnings (estimate)</h2>
        {!noData && <button type="button" className="ghost" disabled={busy || !rangeOk} onClick={exportPdf}>{busy ? 'Building…' : 'Export PDF'}</button>}
      </div>

      {/* Always visible on the page, never hidden in a tooltip. */}
      <div className="notice" role="note"><strong>Estimate only.</strong> {EARNINGS_DISCLAIMER}</div>
      {pdfError && <ErrorBox error={pdfError} />}

      {noData ? (
        <section className="card">
          <h4>No streams yet</h4>
          <p className="muted">Estimates are worked out from your streams. Import your distributor's streaming report on the <Link to="/performance">Performance page</Link> first.</p>
        </section>
      ) : (
        <>
          <section className="card perf-controls">
            <div className="tabs">
              {presets.map(([l, r]) => <button key={l} type="button" className={`tab${range.from === r.from && range.to === r.to ? ' on' : ''}`} onClick={() => setRange(r)}>{l}</button>)}
            </div>
            <div className="row perf-range">
              <label><span>From</span><input type="month" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} /></label>
              <label><span>To</span><input type="month" value={range.to} min={range.from} max={currentMonth()} onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} /></label>
            </div>
            {!rangeOk && <Hint>Choose a start month before the end month, within 10 years.</Hint>}
          </section>

          <div className="stats">
            <div className="option stat"><span>Estimated earnings</span><b>{money(view.e.typical)}</b></div>
            <div className="option stat"><span>Likely range</span><b className="stat-sm">{money(view.e.low)} to {money(view.e.high)}</b></div>
            <div className="option stat"><span>Streams</span><b>{fmtInt(total(view.rows))}</b></div>
          </div>

          {view.missing.length > 0 && (
            <Hint>No rate is set for {view.missing.map(platformLabel).join(', ')}, so those streams are not in the estimate.</Hint>
          )}

          <section className="card">
            <h4>Estimated earnings by month</h4>
            {view.e.typical === 0 ? <p className="muted">Nothing to estimate in this period.</p> : (
              <LineChart labels={view.months.map(label)} series={[{ name: 'Estimate', values: view.months.map((m) => view.byMonth.get(m)?.typical ?? 0) }]} format={money} label="Estimated earnings per month" />
            )}
          </section>

          <section className="card">
            <h4>By platform</h4>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Platform</th><th className="num">Streams</th><th className="num">Rate per stream</th><th className="num">Estimate</th></tr></thead>
                <tbody>
                  {[...view.streamsBy.entries()].sort((a, b) => b[1] - a[1]).map(([id, s]) => {
                    const r = rateFor(id)
                    const est = view.estPlatform.get(id)
                    return (
                      <tr key={id}>
                        <td>{platformLabel(id)}</td>
                        <td className="num">{fmtInt(s)}</td>
                        <td className="num">{r ? money(r.typical) : <span className="muted">No rate set</span>}</td>
                        <td className="num">{est ? <>{money(est.typical)}<div className="muted">{money(est.low)} to {money(est.high)}</div></> : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="perf-gap" />
            <BarList items={rankedEst(view.estPlatform).map(([id, v]) => ({ label: platformLabel(id), value: v.typical }))} format={money} />
          </section>

          {view.songs.length > 0 && (
            <section className="card">
              <h4>By song</h4>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Song</th><th>Release</th><th className="num">Estimate</th></tr></thead>
                  <tbody>{view.songs.map((s) => <tr key={s.title + s.release}><td>{s.title}</td><td className="muted">{s.release}</td><td className="num">{money(s.v.typical)}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <Collapsible title="Rates used" defaultOpen={false}>
        <p className="muted">Average revenue per stream in {RATE_CURRENCY}, last reviewed {REVIEWED_ON}. Platforms pay from a shared pool, so real rates vary by country, plan and your distributor's deal.</p>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Platform</th><th className="num">Low</th><th className="num">Typical</th><th className="num">High</th><th>Source</th></tr></thead>
            <tbody>{RATES.map((r) => <tr key={r.id}><td>{platformLabel(r.id)}</td><td className="num">{money(r.low)}</td><td className="num">{money(r.typical)}</td><td className="num">{money(r.high)}</td><td className="muted">{r.source}</td></tr>)}</tbody>
          </table>
        </div>
      </Collapsible>
    </div>
  )
}
