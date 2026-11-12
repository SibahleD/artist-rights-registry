import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, fetchBlob } from '../api'
import { useAuth } from '../auth'
import { BarList, LineChart, type Series, PlaylistProjections } from '../components/performance'
import { SpotifyAudiencePanel, SpotifyImport } from '../components/SpotifyAudience'
import { AuthImage, vinylFallback, type RGB } from '../components/files'
import { Collapsible, ConfirmModal, ErrorBox, fmtDateTime, Hero, Loading, Modal, Note } from '../components/ui'
import { fmtCompact, fmtInt, fmtMonth } from '../lib/format'
import { currentMonth, filterStats, isrcsFor, matchesSearch, monthsBetween, ranked, releaseLines, releaseTypeLabel, shiftMonth, sumBy, total, unmatchedLines, type PerfData, type Range, type ReleaseLine, type Selection, type TrackLine, platformLabel } from '../lib/stats'
import { buildPerformanceReport, downloadReport, reportTitle, type ReportKind } from '../lib/reports'

interface ImportLog { id: string; source: string; platform: string | null; file_name: string | null; rows_read: number; rows_saved: number; rows_skipped: number; created_at: string }

const monthLabel = (m: string, short = true) => fmtMonth(`${m}-01`, short)

// ---- Download play counts -------------------------------------------------------------------------------

function PlayCountDownload() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  async function download(format: 'csv' | 'json') {
    setBusy(true); setMsg('')
    try {
      const blob = await fetchBlob(`/streams/export?format=${format}`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `play-counts-${new Date().toISOString().slice(0, 10)}.${format}`; a.click()
      URL.revokeObjectURL(url)
      setMsg('Downloaded.')
    } catch (e) { setMsg((e as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <section className="card stack tight">
      <h4>Download your play counts</h4>
      <Note>Your own figures, one row per track, platform and month. Choose CSV for a spreadsheet or JSON for other tools.</Note>
      <div className="row actions">
        <button type="button" className="ghost" disabled={busy} onClick={() => void download('csv')}>Download CSV</button>
        <button type="button" className="ghost" disabled={busy} onClick={() => void download('json')}>Download JSON</button>
        {msg && <span className="muted" role="status">{msg}</span>}
      </div>
    </section>
  )
}

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
      {valid ? <p className="muted">{reportTitle(kind, rep)}</p> : <Note>Choose a valid range of up to 10 years.</Note>}
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

  if (list && list.length === 0) return null
  return (
    <Collapsible title="Earlier per-song imports" defaultOpen={false}>
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

// ---- Release and song picker ----------------------------------------------------------------------------

// One slim row of the picker, all on a single line: title, type, song count and streams. With artwork the row takes the
// art's two accent colours (the same wash the Discography cards use). Songs have no cover of their own, so they borrow
// the colours of their release.
const tintStyle = (t: [RGB, RGB] | null): CSSProperties | undefined => (t ? ({ '--tint': t[0].join(', '), '--tint-2': t[1].join(', ') } as CSSProperties) : undefined)

function PickItem({ artworkId, title, info, streams, on, disabled, tints, onTints, onPick, className = '' }: {
  artworkId?: string | null; title: string; info: string; streams: string; on: boolean; disabled?: boolean
  tints?: [RGB, RGB] | null; onTints?: (t: [RGB, RGB] | null) => void; onPick: () => void; className?: string
}) {
  return (
    <button type="button" className={`perf-item${on ? ' on' : ''}${tints ? ' art' : ''} ${className}`} style={tintStyle(tints ?? null)} aria-pressed={on} disabled={disabled} onClick={onPick}>
      {artworkId !== undefined && <span className="perf-art"><AuthImage mediaId={artworkId} alt="" fallback={vinylFallback} onColors={onTints} /></span>}
      <b className="perf-item-title">{title}</b>
      <span className="perf-item-info">{info}</span>
      <span className="perf-item-streams">{streams}</span>
    </button>
  )
}

function ReleaseGroup({ rel, q, sel, open, toggle, pick }: {
  rel: ReleaseLine; q: string; sel: Selection; open: boolean; toggle: () => void; pick: (s: Selection) => void
}) {
  const [tints, setTints] = useState<[RGB, RGB] | null>(null)
  const hit = matchesSearch(rel, q)
  if (!hit.release) return null
  const searching = q.trim() !== ''
  const relOn = sel?.kind === 'release' && sel.id === rel.id
  const songs = rel.tracks.filter((t) => hit.tracks.has(t.id))
  const expanded = searching || open || (sel?.kind === 'track' && rel.tracks.some((t) => t.id === sel.id))
  return (
    <div className="perf-group">
      <div className="perf-release-row">
        <PickItem artworkId={rel.artworkId} title={rel.title} tints={tints} onTints={setTints}
          info={`${releaseTypeLabel(rel.type)} · ${rel.tracks.length} song${rel.tracks.length === 1 ? '' : 's'}`}
          streams={`${fmtInt(rel.streams)} streams`} on={relOn} onPick={() => pick(relOn ? null : { kind: 'release', id: rel.id })} />
        <button type="button" className="ghost perf-expand" aria-expanded={expanded} aria-label={`${expanded ? 'Hide' : 'Show'} the songs on ${rel.title}`} disabled={searching}
          onClick={toggle}>{expanded ? 'Hide songs' : 'Songs'}</button>
      </div>
      {expanded && (
        <div className="perf-songs">
          {songs.map((t: TrackLine) => {
            const on = sel?.kind === 'track' && sel.id === t.id
            return (
              <PickItem key={t.id} className="perf-song" title={t.title} tints={tints}
                info={`${rel.type === 'single' ? 'Single' : `Track ${t.trackNumber}`}${t.isrc ? '' : ' · no ISRC'}`}
                streams={t.isrc ? `${fmtInt(t.streams)} streams` : 'Add an ISRC'}
                on={on} disabled={!t.isrc} onPick={() => pick(on ? null : { kind: 'track', id: t.id })} />
            )
          })}
        </div>
      )}
    </div>
  )
}

// Sits under the filters and starts minimised. Picking something sends the person back to the top, where the charts are.
function ReleasePicker({ lines, q, setQ, sel, setSel }: { lines: ReleaseLine[]; q: string; setQ: (v: string) => void; sel: Selection; setSel: (s: Selection) => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const pick = (s: Selection) => {
    setSel(s)
    if (s) window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  return (
    <Collapsible title="Your releases and songs" defaultOpen={false} className="card perf-picker">
      <div className="perf-picker-body">
        <div className="row perf-search">
          <p className="muted">Pick a release to see its streams, or open it to pick one of its songs. {lines.length} release{lines.length === 1 ? '' : 's'} in the app.</p>
          <input type="search" placeholder="Search by release or song" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search releases and songs" />
        </div>
        <div className="perf-list">
          {lines.map((rel) => (
            <ReleaseGroup key={rel.id} rel={rel} q={q} sel={sel} open={!!open[rel.id]} toggle={() => setOpen({ ...open, [rel.id]: !open[rel.id] })} pick={pick} />
          ))}
        </div>
      </div>
    </Collapsible>
  )
}

// ---- Page -----------------------------------------------------------------------------------------------

export default function Performance({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth()
  const [data, setData] = useState<PerfData | null>(null)
  const [error, setError] = useState('')
  const [range, setRange] = useState<Range | null>(null)
  const [sel, setSel] = useState<Selection>(null)
  const [q, setQ] = useState('')
  const [importing, setImporting] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reload, setReload] = useState(0)
  // Two sections, kept in the address (?tab=projections) so a link or a refresh lands on the same one.
  const [params, setParams] = useSearchParams()
  const tab: 'stats' | 'projections' = params.get('tab') === 'projections' ? 'projections' : 'stats'
  const setTab = (t: 'stats' | 'projections') => setParams(t === 'stats' ? {} : { tab: t }, { replace: true })

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

  // The range the page opens with: the last 12 months, or everything if there is less than that.
  const defaultRange = useCallback((d: PerfData): Range => {
    const to = d.last_period ? d.last_period.slice(0, 7) : currentMonth()
    const from = shiftMonth(to, -11)
    const first = d.first_period?.slice(0, 7)
    return { from: first && first > from ? first : from, to }
  }, [])
  const resetFilters = () => { if (data) setRange(defaultRange(data)); setSel(null); setQ('') }

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
  if (!data || !range || !view) return <Loading what="Loading your streams" variant="dashboard" />

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
      {embedded ? (
        <div className="row actions perf-hero-actions">
          {!noData && <button type="button" className="secondary" onClick={() => setReporting(true)}>Export PDF</button>}
          <button type="button" onClick={() => setImporting(true)}>Import Spotify CSV</button>
        </div>
      ) : (
        <Hero>
          <h1>Performance</h1>
          <div className="sub">{user?.artist_name ? `Artist: ${user.artist_name}` : 'Your streams across every platform'}</div>
          <div className="row actions perf-hero-actions">
            {!noData && <button type="button" className="secondary" onClick={() => setReporting(true)}>Export PDF</button>}
            <button type="button" onClick={() => setImporting(true)}>Import Spotify CSV</button>
          </div>
        </Hero>
      )}

      <div className="tabs perf-tabs" role="tablist" aria-label="Performance sections">
        <button type="button" role="tab" id="perf-tab-stats" aria-selected={tab === 'stats'} aria-controls="perf-panel-stats" className={`tab${tab === 'stats' ? ' on' : ''}`} onClick={() => setTab('stats')}>Stats</button>
        <button type="button" role="tab" id="perf-tab-projections" aria-selected={tab === 'projections'} aria-controls="perf-panel-projections" className={`tab${tab === 'projections' ? ' on' : ''}`} onClick={() => setTab('projections')}>Projections</button>
      </div>

      {tab === 'stats' && (
        <div className="stack" role="tabpanel" id="perf-panel-stats" aria-labelledby="perf-tab-stats">
      <SpotifyAudiencePanel reloadKey={reload} onImport={() => setImporting(true)} onChanged={refreshed} />

      {noData ? null : (
        <>
          <p className="perf-scope" role="status">
            Showing <strong>streams</strong> (plays reported by your distributor) for <strong>{sel ? selectedTitle : 'all releases and songs'}</strong>,{' '}
            <strong>{monthLabel(range.from)} to {monthLabel(range.to)}</strong>, across <strong>{view.byPlatform.length} platform{view.byPlatform.length === 1 ? '' : 's'}</strong>.
          </p>

          <section className="card perf-controls" aria-label="Filters">
            <div className="perf-filter-row">
              <div className="perf-filter">
                <span className="perf-filter-label" id="perf-period">Period</span>
                <div className="tabs" role="group" aria-labelledby="perf-period">
                  {presets.map(([label, r]) => (
                    <button key={label} type="button" className={`tab${range.from === r.from && range.to === r.to ? ' on' : ''}`} onClick={() => setRange(r)}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="perf-filter">
                <span className="perf-filter-label">Custom range</span>
                <div className="row perf-range">
                  <input type="month" aria-label="From month" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} />
                  <span className="muted" aria-hidden="true">to</span>
                  <input type="month" aria-label="To month" value={range.to} min={range.from} max={currentMonth()} onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} />
                </div>
              </div>
              <div className="perf-filter perf-filter-pick">
                <span className="perf-filter-label">Release or song</span>
                <span className={sel ? 'perf-chip' : 'muted'}>{sel ? <><strong>{selectedTitle}</strong> <span className="muted">({sel.kind === 'release' ? 'release' : 'song'})</span></> : 'Everything'}</span>
              </div>
              <button type="button" className="ghost perf-reset" onClick={resetFilters}>Reset filters</button>
            </div>
            {!rangeOk && <Note>Choose a start month that is before the end month.</Note>}
          </section>

          {view.lines.length === 0 ? (
            <section className="card"><h4>Your releases and songs</h4><p className="muted">You have no songs yet. <Link to="/new/song">Add a song</Link> and put its ISRC on it to see its streams here.</p></section>
          ) : (
            <ReleasePicker lines={view.lines} q={q} setQ={setQ} sel={sel} setSel={setSel} />
          )}

          <div className="stats">
            <div className="option stat"><span>Total streams</span><b>{fmtCompact(sum)}</b></div>
            <div className="option stat"><span>Platforms</span><b>{view.byPlatform.length}</b></div>
            <div className="option stat"><span>Best month</span><b>{view.bestMonth ? monthLabel(view.bestMonth[0]) : '—'}</b></div>
          </div>

          <section className="card">
            <h4>Streams per month, by platform</h4>
            {sum === 0 ? <p className="muted">No streams in this period.</p> : (
              <LineChart labels={view.months.map((m) => monthLabel(m))} series={view.series} exact={fmtInt} unit=" streams" label="Streams per month by platform" />
            )}
          </section>

          <section className="card">
            <h4>Total streams by platform</h4>
            <BarList items={view.byPlatform.map(([id, v]) => ({ label: platformLabel(id), value: v }))} format={fmtInt} />
          </section>

          {noIsrc.length > 0 && <Note>{noIsrc.length} song{noIsrc.length === 1 ? ' has' : 's have'} no ISRC, so streams cannot be matched to {noIsrc.length === 1 ? 'it' : 'them'}. Add the ISRC on the song's page. Release totals add up their songs.</Note>}

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

        </div>
      )}

      {tab === 'projections' && (
        <div className="stack" role="tabpanel" id="perf-panel-projections" aria-labelledby="perf-tab-projections">
          {view.lines.length === 0 ? (
            <section className="card"><h4>Your releases and songs</h4><p className="muted">You have no songs yet. <Link to="/new/song">Add a song</Link> and put its ISRC on it to see its streams here.</p></section>
          ) : (
            <ReleasePicker lines={view.lines} q={q} setQ={setQ} sel={sel} setSel={setSel} />
          )}

          {view.lines.length > 0 && <PlaylistProjections lines={view.lines} sel={sel} />}
        </div>
      )}

      {tab === 'stats' && <ImportHistory reloadKey={reload} onChanged={refreshed} />}
      {tab === 'stats' && !noData && <PlayCountDownload />}

      {importing && <SpotifyImport onClose={() => setImporting(false)} onDone={refreshed} />}
      {reporting && <ReportDialog data={data} range={range} selection={sel} artist={user?.artist_name ?? ''} onClose={() => setReporting(false)} />}
    </div>
  )
}
