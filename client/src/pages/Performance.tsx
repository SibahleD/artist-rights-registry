import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { BarList, LineChart, type Series } from '../components/Charts'
import StreamImport from '../components/StreamImport'
import { Collapsible, ConfirmModal, ErrorBox, fmtDateTime, Hint, Loading, Modal } from '../components/ui'
import { fmtCompact, fmtInt, fmtMonth } from '../lib/format'
import {
  currentMonth, filterStats, isrcsFor, matchesSearch, monthsBetween, ranked, releaseLines, shiftMonth, sumBy, total, unmatchedLines,
  type PerfData, type Range, type Selection,
} from '../lib/performance'
import { buildPerformanceReport, reportTitle, type ReportKind } from '../lib/performanceReport'
import { platformLabel } from '../lib/streamImport'

interface ImportLog { id: string; source: string; platform: string | null; file_name: string | null; rows_read: number; rows_saved: number; rows_skipped: number; created_at: string }

const monthLabel = (m: string, short = true) => fmtMonth(`${m}-01`, short)

// ---- PDF report dialog ----------------------------------------------------------------------------------

function ReportDialog({ data, range, selection, artist, onClose }: { data: PerfData; range: Range; selection: Selection; artist: string; onClose: () => void }) {
  const last = data.last_period ? data.last_period.slice(0, 7) : currentMonth()
  const first = data.first_period ? data.first_period.slice(0, 7) : last
  const years = useMemo(() => {
    const out: string[] = []
    for (let y = Number(currentMonth().slice(0, 4)); y >= Number(first.slice(0, 4)); y--) out.push(String(y))
    return out
  }, [first])

  const [kind, setKind] = useState<ReportKind>('monthly')
  const [month, setMonth] = useState(last)
  const [year, setYear] = useState(last.slice(0, 4))
  const [custom, setCustom] = useState<Range>(range)
  const [scoped, setScoped] = useState(!!selection)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const rep: Range = kind === 'monthly' ? { from: month, to: month } : kind === 'yearly' ? { from: `${year}-01`, to: `${year}-12` } : custom
  const valid = /^\d{4}-\d{2}$/.test(rep.from) && /^\d{4}-\d{2}$/.test(rep.to) && rep.from <= rep.to && monthsBetween(rep.from, rep.to).length <= 120

  async function download() {
    setBusy(true); setError('')
    try {
      const { downloadReport } = await import('../lib/pdf')
      await downloadReport(buildPerformanceReport({ kind, range: rep, artist, stats: data.stats, tracks: data.tracks, selection: scoped ? selection : null }))
    } catch { setError('Could not build the PDF. Try again.') }
    finally { setBusy(false) }
  }

  return (
    <Modal title="Export a PDF report" onClose={() => !busy && onClose()}>
      <div className="tabs" role="tablist">
        {(['monthly', 'yearly', 'custom'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} className={`tab${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}>
            {k === 'monthly' ? 'Monthly' : k === 'yearly' ? 'Yearly' : 'Date range'}
          </button>
        ))}
      </div>
      <div className="map-grid">
        {kind === 'monthly' && <label><span>Month</span><input type="month" value={month} max={currentMonth()} onChange={(e) => setMonth(e.target.value)} /></label>}
        {kind === 'yearly' && <label><span>Year</span><select value={year} onChange={(e) => setYear(e.target.value)}>{years.map((y) => <option key={y}>{y}</option>)}</select></label>}
        {kind === 'custom' && (
          <>
            <label><span>From</span><input type="month" value={custom.from} max={custom.to || undefined} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></label>
            <label><span>To</span><input type="month" value={custom.to} min={custom.from || undefined} max={currentMonth()} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></label>
          </>
        )}
      </div>
      {selection && (
        <label className="check">
          <input type="checkbox" checked={scoped} onChange={(e) => setScoped(e.target.checked)} /> Only the {selection.kind === 'release' ? 'release' : 'song'} I have selected
        </label>
      )}
      {valid ? <p className="muted">{reportTitle(kind, rep)}</p> : <Hint>Choose a valid range of up to 10 years.</Hint>}
      {error && <ErrorBox error={error} />}
      <div className="row actions">
        <button type="button" disabled={!valid || busy} onClick={download}>{busy ? 'Building…' : 'Download PDF'}</button>
        <button type="button" className="ghost" disabled={busy} onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  )
}

// ---- Import history -------------------------------------------------------------------------------------

function ImportHistory({ reloadKey, onChanged }: { reloadKey: number; onChanged: () => void }) {
  const [list, setList] = useState<ImportLog[] | null>(null)
  const [del, setDel] = useState<ImportLog | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    api<{ imports: ImportLog[] }>('/streams/imports').then((r) => live && setList(r.imports)).catch(() => live && setList([]))
    return () => { live = false }
  }, [reloadKey])

  async function remove() {
    if (!del) return
    setBusy(true); setError('')
    try { await api(`/streams/imports/${del.id}`, 'DELETE'); setDel(null); onChanged() }
    catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Collapsible title="Import history" defaultOpen={false}>
      {!list ? <Loading /> : list.length === 0 ? <p className="muted">Nothing imported yet.</p> : (
        <div className="table-scroll">
          <table>
            <thead><tr><th>When</th><th>File</th><th className="num">Saved</th><th className="num">Skipped</th><th /></tr></thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id}>
                  <td>{fmtDateTime(i.created_at)}</td>
                  <td>{i.file_name ?? i.source}</td>
                  <td className="num">{fmtInt(i.rows_saved)}</td>
                  <td className="num">{fmtInt(i.rows_skipped)}</td>
                  <td className="num"><button type="button" className="ghost danger" onClick={() => { setError(''); setDel(i) }}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {del && (
        <ConfirmModal title="Remove this import?" confirmLabel="Remove" danger busy={busy} onConfirm={remove} onClose={() => setDel(null)}>
          <p>This removes the figures this import last set ({fmtInt(del.rows_saved)} at most). Figures that a later import replaced are not affected.</p>
          {error && <ErrorBox error={error} />}
        </ConfirmModal>
      )}
    </Collapsible>
  )
}

// ---- Page -----------------------------------------------------------------------------------------------

export default function Performance() {
  const { user } = useAuth()
  const [data, setData] = useState<PerfData | null>(null)
  const [error, setError] = useState('')
  const [range, setRange] = useState<Range | null>(null)
  const [sel, setSel] = useState<Selection>(null)
  const [q, setQ] = useState('')
  const [importing, setImporting] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reload, setReload] = useState(0)

  const load = useCallback(async () => {
    try {
      const d = await api<PerfData>('/streams')
      setData(d)
      setRange((r) => {
        if (r) return r
        const to = d.last_period ? d.last_period.slice(0, 7) : currentMonth()
        const from = shiftMonth(to, -11)
        const first = d.first_period?.slice(0, 7)
        return { from: first && first > from ? first : from, to }
      })
    } catch (e) { setError((e as Error).message) }
  }, [])
  useEffect(() => { load() }, [load, reload])

  const refreshed = () => setReload((n) => n + 1)

  // Everything below depends on the loaded data, so it is computed only once there is some.
  const view = useMemo(() => {
    if (!data || !range) return null
    const isrcs = isrcsFor(sel, data.tracks)
    const rows = filterStats(data.stats, range, isrcs)
    const inRange = filterStats(data.stats, range, null)
    const months = monthsBetween(range.from, range.to)
    const byPlatform = ranked(sumBy(rows, (r) => r.platform))
    const byMonth = sumBy(rows, (r) => r.period.slice(0, 7))

    const top = byPlatform.slice(0, 5).map(([id]) => id)
    const series: Series[] = top.map((id) => ({
      name: platformLabel(id),
      values: months.map((m) => rows.filter((r) => r.platform === id && r.period.startsWith(m)).reduce((a, r) => a + r.streams, 0)),
    }))
    if (byPlatform.length > 5) {
      series.push({ name: 'Other', values: months.map((m) => rows.filter((r) => !top.includes(r.platform) && r.period.startsWith(m)).reduce((a, r) => a + r.streams, 0)) })
    }
    const bestMonth = ranked(byMonth)[0]
    const lines = releaseLines(data.tracks, inRange)
    return { rows, inRange, months, byPlatform, byMonth, series, bestMonth, lines, unmatched: unmatchedLines(data.tracks, inRange) }
  }, [data, range, sel])

  if (error) return <ErrorBox error={error} />
  if (!data || !range || !view) return <Loading what="Loading your streams" />

  const noData = data.stats.length === 0
  const noIsrc = data.tracks.filter((t) => !t.isrc)
  const selectedTitle = !sel ? '' : sel.kind === 'release'
    ? data.tracks.find((t) => t.release_id === sel.id)?.release_title ?? ''
    : data.tracks.find((t) => t.id === sel.id)?.title ?? ''
  const sum = total(view.rows)
  const lastMonth = data.last_period?.slice(0, 7) ?? currentMonth()
  const lastYear = `${lastMonth.slice(0, 4)}`

  const presets: [string, Range][] = [
    ['Last 12 months', { from: shiftMonth(lastMonth, -11), to: lastMonth }],
    [`${lastYear}`, { from: `${lastYear}-01`, to: `${lastYear}-12` }],
    ['All time', { from: data.first_period?.slice(0, 7) ?? lastMonth, to: lastMonth }],
  ]
  const rangeOk = range.from <= range.to && monthsBetween(range.from, range.to).length < 600

  return (
    <div className="performance">
      <div className="row perf-head">
        <h2>Performance</h2>
        <div className="row perf-actions">
          {!noData && <button type="button" className="ghost" onClick={() => setReporting(true)}>Export PDF</button>}
          <button type="button" onClick={() => setImporting(true)}>Import streams</button>
        </div>
      </div>

      {noData ? (
        <section className="card">
          <h4>No streams yet</h4>
          <p className="muted">Import the streaming report from your distributor (a CSV file) and your streams will show up here by song, platform and month. Songs are matched by ISRC, so each song needs its ISRC filled in.</p>
          <button type="button" onClick={() => setImporting(true)}>Import streams</button>
        </section>
      ) : (
        <>
          <section className="card perf-controls">
            <div className="tabs">
              {presets.map(([label, r]) => (
                <button key={label} type="button" className={`tab${range.from === r.from && range.to === r.to ? ' on' : ''}`} onClick={() => setRange(r)}>{label}</button>
              ))}
            </div>
            <div className="row perf-range">
              <label><span>From</span><input type="month" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} /></label>
              <label><span>To</span><input type="month" value={range.to} min={range.from} max={currentMonth()} onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} /></label>
            </div>
            {!rangeOk && <Hint>Choose a start month that is before the end month.</Hint>}
          </section>

          {sel && (
            <div className="perf-selected">
              Showing <strong>{selectedTitle}</strong>
              <button type="button" className="ghost" onClick={() => setSel(null)}>Show everything</button>
            </div>
          )}

          <div className="stats">
            <div className="option stat"><span>Total streams</span><b>{fmtCompact(sum)}</b></div>
            <div className="option stat"><span>Platforms</span><b>{view.byPlatform.length}</b></div>
            <div className="option stat"><span>Best month</span><b>{view.bestMonth ? monthLabel(view.bestMonth[0]) : '—'}</b></div>
          </div>

          <section className="card">
            <h4>Streams over time</h4>
            {sum === 0 ? <p className="muted">No streams in this period.</p> : (
              <LineChart labels={view.months.map((m) => monthLabel(m))} series={view.series} label="Streams per month by platform" />
            )}
          </section>

          <section className="card">
            <h4>Streams by platform</h4>
            <BarList items={view.byPlatform.map(([id, v]) => ({ label: platformLabel(id), value: v }))} format={fmtInt} />
          </section>

          <section className="card">
            <div className="row perf-search">
              <h4>Songs and releases</h4>
              <input type="search" placeholder="Search by release or song" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search releases and songs" />
            </div>
            {view.lines.length === 0 ? (
              <p className="muted">You have no songs yet. <Link to="/new/song">Add a song</Link> and put its ISRC on it to see its streams here.</p>
            ) : (
              <div className="table-scroll">
                <table className="perf-table">
                  <thead><tr><th>Release / song</th><th className="num">Streams</th></tr></thead>
                  <tbody>
                    {view.lines.map((rel) => {
                      const hit = matchesSearch(rel, q)
                      if (!hit.release) return null
                      const relOn = sel?.kind === 'release' && sel.id === rel.id
                      return [
                        <tr key={rel.id} className={`perf-release${relOn ? ' on' : ''}`}>
                          <td>
                            <button type="button" className="linklike" aria-pressed={relOn} onClick={() => setSel(relOn ? null : { kind: 'release', id: rel.id })}>{rel.title}</button>
                            <span className="muted"> · {rel.type.toUpperCase()}</span>
                          </td>
                          <td className="num">{fmtInt(rel.streams)}</td>
                        </tr>,
                        ...rel.tracks.filter((t) => hit.tracks.has(t.id)).map((t) => {
                          const on = sel?.kind === 'track' && sel.id === t.id
                          return (
                            <tr key={t.id} className={`perf-track${on ? ' on' : ''}`}>
                              <td>
                                <button type="button" className="linklike" aria-pressed={on} disabled={!t.isrc} onClick={() => setSel(on ? null : { kind: 'track', id: t.id })}>{t.title}</button>
                                {!t.isrc && <span className="muted"> · no ISRC</span>}
                              </td>
                              <td className="num">{t.isrc ? fmtInt(t.streams) : '—'}</td>
                            </tr>
                          )
                        }),
                      ]
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {noIsrc.length > 0 && <Hint>{noIsrc.length} song{noIsrc.length === 1 ? ' has' : 's have'} no ISRC, so streams cannot be matched to {noIsrc.length === 1 ? 'it' : 'them'}. Add the ISRC on the song's page.</Hint>}
            <Hint>Release totals add up their songs.</Hint>
          </section>

          {view.unmatched.length > 0 && (
            <Collapsible title={`Not matched to a song (${view.unmatched.length})`} defaultOpen={false}>
              <p className="muted">These ISRCs are in your imports but not on any song in Track Record. They count in the platform and monthly totals when nothing is selected.</p>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>ISRC</th><th className="num">Streams</th></tr></thead>
                  <tbody>{view.unmatched.map(([isrc, v]) => <tr key={isrc}><td>{isrc}</td><td className="num">{fmtInt(v)}</td></tr>)}</tbody>
                </table>
              </div>
            </Collapsible>
          )}
        </>
      )}

      <ImportHistory reloadKey={reload} onChanged={refreshed} />

      {importing && <StreamImport onClose={() => setImporting(false)} onDone={refreshed} />}
      {reporting && <ReportDialog data={data} range={range} selection={sel} artist={user?.artist_name ?? ''} onClose={() => setReporting(false)} />}
    </div>
  )
}
