import { fmtCompact, fmtInt, fmtMonth } from '../lib/format'
import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { api, ApiError } from '../api'
import { AuthImage, vinylFallback } from './files'
import { Collapsible, ErrorBox, Spinner, Modal, Note } from './ui'
import { releaseTypeLabel, type ReleaseLine, type Selection, parseCsv, findHeaderRow, FIELD_LABELS, STREAMING_PLATFORMS, guessMapping, platformLabel, readRows, type DateOrder, type FieldKey, type Mapping } from '../lib/stats'

// ---- Charts ----------------------------------------------------------------
// Small inline-SVG charts, so there is no chart library to ship. They scale to the width of their container.

const PALETTE = ['var(--accent)', '#4fc3ff', '#ff8c42', '#8bd17c', '#c792ea', '#f2c94c']

export interface Series { name: string; values: number[] }

// The y-axis is built from the highest value on the chart: whole-number steps (1, 2, 2.5, 5 or 10 times a power of ten),
// about four of them, and a top that is the first step at or above the highest value. So a chart peaking at 1,200 tops
// out at 1,250 rather than 2,000, and a chart peaking at 3 shows 0, 1, 2, 3 and never 0.75.
export function axisFor(max: number): { top: number; ticks: number[] } {
  if (!(max > 0)) return { top: 4, ticks: [0, 1, 2, 3, 4] }
  const raw = max / 4
  const p = 10 ** Math.floor(Math.log10(raw))
  const n = raw / p
  const step = Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 && p >= 10 ? 2.5 : n <= 5 ? 5 : 10) * p)
  const count = Math.ceil(max / step - 1e-9)
  return { top: count * step, ticks: Array.from({ length: count + 1 }, (_, i) => i * step) }
}

interface LineProps {
  labels: string[]
  series: Series[]
  height?: number
  /** Axis label formatter. Defaults to compact numbers (1.2K, 3M). */
  format?: (n: number) => string
  /** Exact value shown when a point is selected. Defaults to `format`. */
  exact?: (n: number) => string
  /** Word after the exact value, e.g. " streams". */
  unit?: string
  /** Read out to screen readers, e.g. "Streams per month". */
  label: string
}

export function LineChart({ labels, series, height = 240, format = fmtCompact, exact, unit = '', label }: LineProps) {
  const W = 640, H = height
  const m = { l: 46, r: 12, t: 12, b: 28 }
  const iw = W - m.l - m.r, ih = H - m.t - m.b
  const n = labels.length
  const { top, ticks } = axisFor(Math.max(0, ...series.flatMap((s) => s.values)))
  const x = (i: number) => m.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v: number) => m.t + ih - (v / top) * ih
  const every = Math.max(1, Math.ceil(n / 8))
  const show = exact ?? format
  // The point the person has clicked (or reached with the keyboard): its exact value is drawn beside it.
  const [active, setActive] = useState<{ s: number; i: number } | null>(null)
  const pick = (s: number, i: number) => setActive((a) => (a && a.s === s && a.i === i ? null : { s, i }))
  const cur = active && series[active.s] && active.i < n ? active : null

  if (n === 0) return <p className="muted">No data for this period.</p>

  let tip: React.ReactNode = null
  if (cur) {
    const sr = series[cur.s], v = sr.values[cur.i]
    const line1 = `${sr.name} · ${labels[cur.i]}`, line2 = `${show(v)}${unit}`
    const w = Math.max(line1.length * 6.3, line2.length * 7.6) + 20, h = 40
    const px = x(cur.i), py = y(v)
    const tx = Math.min(Math.max(px - w / 2, m.l), W - m.r - w)
    const ty = py - h - 12 < m.t ? py + 12 : py - h - 12   // flip below the point when it is near the top
    tip = (
      <g className="chart-tip" pointerEvents="none">
        <line x1={px} x2={px} y1={m.t} y2={m.t + ih} className="chart-guide" />
        <circle cx={px} cy={py} r={6} fill="none" stroke={PALETTE[cur.s % PALETTE.length]} strokeWidth={2} />
        <rect x={tx} y={ty} width={w} height={h} rx={8} className="chart-tip-box" />
        <text x={tx + 10} y={ty + 16} className="chart-tip-name">{line1}</text>
        <text x={tx + 10} y={ty + 33} className="chart-tip-value">{line2}</text>
      </g>
    )
  }

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={label} onClick={() => setActive(null)}>
        <title>{label}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={m.l - 6} y={y(t) + 3.5} textAnchor="end" className="chart-axis">{format(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => i % every === 0 && (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="chart-axis">{l}</text>
        ))}
        {series.map((s, k) => {
          const c = PALETTE[k % PALETTE.length]
          const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
          return (
            <g key={s.name}>
              <polyline points={pts} fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={n > 24 ? 0 : 3} fill={c} pointerEvents="none" />)}
            </g>
          )
        })}
        {/* Larger invisible targets on top of the dots, so a node is easy to click, tap or tab to. */}
        {series.map((s, k) => s.values.map((v, i) => (
          <circle key={`${k}-${i}`} cx={x(i)} cy={y(v)} r={n > 24 ? 6 : 9} className="chart-hit" tabIndex={0} role="button"
            aria-pressed={cur?.s === k && cur.i === i} aria-label={`${s.name}, ${labels[i]}: ${show(v)}${unit}`}
            onClick={(e) => { e.stopPropagation(); pick(k, i) }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(k, i) } else if (e.key === 'Escape') setActive(null) }}>
            <title>{`${s.name}, ${labels[i]}: ${show(v)}${unit}`}</title>
          </circle>
        )))}
        {tip}
      </svg>
      {series.length > 1 && (
        <figcaption className="chart-legend">
          {series.map((s, k) => <span key={s.name}><i style={{ background: PALETTE[k % PALETTE.length] }} />{s.name}</span>)}
        </figcaption>
      )}
    </figure>
  )
}

interface BarsProps {
  items: { label: string; value: number }[]
  format?: (n: number) => string
}

// A ranked list of horizontal bars, for things like streams by platform.
export function BarList({ items, format = fmtCompact }: BarsProps) {
  const max = Math.max(1, ...items.map((i) => i.value))
  if (items.length === 0) return <p className="muted">No data for this period.</p>
  return (
    <ul className="bar-list">
      {items.map((it) => (
        <li key={it.label}>
          <span className="bar-label">{it.label}</span>
          <span className="bar-track"><span className="bar-fill" style={{ width: `${Math.max(1, (it.value / max) * 100)}%` }} /></span>
          <span className="bar-value">{format(it.value)}</span>
        </li>
      ))}
    </ul>
  )
}

// ---- PlaylistProjections ---------------------------------------------------
interface Fit { id: string; label: string; fit: number; band: string; why: string[] }
interface Features { acousticness?: number; danceability?: number; energy?: number; instrumentalness?: number; liveness?: number; loudness?: number; speechiness?: number; tempo?: number; valence?: number }
interface Analysis { track_id: string; features: Features; summary: string[]; projections: Fit[]; source: string; analysed_at: string }

const pct = (v?: number) => (v === undefined ? '—' : `${Math.round(v * 100)}%`)

// What each number means, in plain words.
const FEATURE_ROWS: [keyof Features, string, (v?: number) => string][] = [
  ['energy', 'Energy', pct], ['danceability', 'Danceability', pct], ['valence', 'Mood (higher is happier)', pct],
  ['acousticness', 'Acoustic', pct], ['instrumentalness', 'Instrumental', pct], ['speechiness', 'Spoken words', pct], ['liveness', 'Live feel', pct],
  ['tempo', 'Tempo', (v) => (v === undefined ? '—' : `${Math.round(v)} BPM`)], ['loudness', 'Loudness', (v) => (v === undefined ? '—' : `${v.toFixed(1)} dB`)],
]

// The sliders the artist moves to describe their own song, with what each end means.
type Slider = 'energy' | 'danceability' | 'valence' | 'acousticness' | 'instrumentalness' | 'speechiness'
const SLIDERS: { key: Slider; label: string; low: string; high: string }[] = [
  { key: 'energy', label: 'Energy', low: 'Calm', high: 'Intense' },
  { key: 'danceability', label: 'Danceability', low: 'Hard to dance to', high: 'Made for dancing' },
  { key: 'valence', label: 'Mood', low: 'Dark or sad', high: 'Happy or upbeat' },
  { key: 'acousticness', label: 'Acoustic', low: 'Electronic', high: 'Acoustic instruments' },
  { key: 'instrumentalness', label: 'Instrumental', low: 'Clear vocals', high: 'No vocals' },
  { key: 'speechiness', label: 'Spoken words', low: 'Sung', high: 'Rapped or spoken' },
]
type Form = Record<Slider, number> & { tempo: string }
const blankForm = (f?: Features): Form => ({
  energy: Math.round((f?.energy ?? 0.5) * 100), danceability: Math.round((f?.danceability ?? 0.5) * 100), valence: Math.round((f?.valence ?? 0.5) * 100),
  acousticness: Math.round((f?.acousticness ?? 0.3) * 100), instrumentalness: Math.round((f?.instrumentalness ?? 0.05) * 100), speechiness: Math.round((f?.speechiness ?? 0.05) * 100),
  tempo: f?.tempo ? String(Math.round(f.tempo)) : '',
})

// "Playlist Projections": how well each song's sound matches the usual sound of different kinds of playlist. The artist describes
// the sound of their own song and the fits are worked out from that. It is an estimate of fit, not a forecast of streams or a promise of placement.
export function PlaylistProjections({ lines, sel }: { lines: ReleaseLine[]; sel: Selection }) {
  const [data, setData] = useState<Map<string, Analysis> | null>(null)
  const [error, setError] = useState('')
  const [edit, setEdit] = useState<{ rel: ReleaseLine; id: string; title: string } | null>(null)
  const [form, setForm] = useState<Form>(blankForm())
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    try { const r = await api<{ songs: Analysis[] }>('/streams/projections'); setData(new Map(r.songs.map((s) => [s.track_id, s]))) }
    catch (e) { setError((e as Error).message); setData(new Map()) }
  }, [])
  useEffect(() => { load() }, [load])

  // The same scope as the rest of the page: one song, one release, or everything.
  const rows = lines.flatMap((rel) => rel.tracks
    .filter((t) => !sel || (sel.kind === 'track' ? sel.id === t.id : sel.id === rel.id))
    .map((t) => ({ rel, t })))

  function describeSong(rel: ReleaseLine, id: string, title: string) {
    setForm(blankForm(data?.get(id)?.features)); setError(''); setEdit({ rel, id, title })
  }

  async function save() {
    if (!edit) return
    const { rel, id } = edit
    const body: Record<string, number> = {}
    for (const { key } of SLIDERS) body[key] = form[key] / 100
    const bpm = Number(form.tempo)
    if (form.tempo.trim() && Number.isFinite(bpm) && bpm > 0) body.tempo = Math.min(300, bpm)
    setSaving(true); setError('')
    try {
      const result = await api<Analysis>(`/releases/${rel.id}/tracks/${id}/audio-features`, 'PUT', body)
      setData((m) => new Map(m).set(id, result))
      setOpen((o) => ({ ...o, [id]: true }))
      setEdit(null)
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  async function remove(rel: ReleaseLine, id: string) {
    setError('')
    try { await api(`/releases/${rel.id}/tracks/${id}/audio-features`, 'DELETE'); setData((m) => { const n = new Map(m); n.delete(id); return n }) }
    catch (e) { setError((e as Error).message) }
  }

  return (
    <section className="card proj" aria-label="Playlist Projections">
      <h4>Playlist Projections</h4>
      <p className="muted">How closely each song’s sound matches the usual sound of different kinds of playlist, before it has any streams. You describe the sound; these are estimates, not a forecast of streams or a promise of playlist placement.</p>

      <Collapsible title="Why the sound of a song matters" defaultOpen={false} level="h4" className="proj-why">
        <div className="stack tight">
          <p>Streaming apps recommend music in two main ways. One looks at <strong>listening behaviour</strong>: people who played this also played that. The other looks at the <strong>sound itself</strong>: tempo, energy, mood, how acoustic it is.</p>
          <p>A brand-new or unreleased song has no listening history, so the first way has nothing to work with. This is called the cold-start problem. The sound is all there is, so it is how a new song gets placed next to similar songs, and how playlists built around a mood or activity (workout, chill, party) can be matched to it.</p>
          <p>The numbers here are the ones you set for your own song. The playlist fits are our own rule of thumb on top of them: each playlist type has a typical range for energy, tempo and so on, and a song scores higher the closer it falls. Real placement also depends on listeners, editors and your metadata, so treat a high fit as “this sound belongs there”, not “this will get in”.</p>
        </div>
      </Collapsible>

      {error && !edit && <ErrorBox error={error} />}
      {!data ? <Spinner label="Loading projections" /> : rows.length === 0 ? <p className="muted">No songs to show.</p> : (
        <div className="proj-list">
          {rows.map(({ rel, t }) => {
            const a = data.get(t.id)
            const isOpen = !!open[t.id]
            return (
              <div className="proj-row" key={t.id}>
                <div className="proj-head">
                  <span className="perf-art"><AuthImage mediaId={rel.artworkId} alt="" fallback={vinylFallback} /></span>
                  <span className="perf-item-text">
                    <b className="perf-item-title">{t.title}</b>
                    <span className="perf-item-type">{rel.type === 'single' ? 'Single' : `${releaseTypeLabel(rel.type)} · track ${t.trackNumber}`}</span>
                  </span>
                  <span className="proj-actions">
                    {a
                      ? <button type="button" className="ghost" onClick={() => describeSong(rel, t.id, t.title)}>Edit sound</button>
                      : <button type="button" className="secondary" onClick={() => describeSong(rel, t.id, t.title)}>Describe the sound</button>}
                  </span>
                </div>

                {!a && <small className="muted">Not set yet. Describe how this song sounds to see which playlists it fits.</small>}

                {a && (
                  <>
                    <div className="proj-summary">{a.summary.map((s) => <span key={s} className="tag-pill">{s}</span>)}</div>
                    <ul className="fit-list">
                      {a.projections.slice(0, isOpen ? a.projections.length : 3).map((p) => (
                        <li key={p.id}>
                          <span className="fit-label">{p.label}</span>
                          <span className="bar-track" role="img" aria-label={`${p.label}: ${p.fit} out of 100, ${p.band}`}><span className="bar-fill" style={{ width: `${Math.max(2, p.fit)}%` }} /></span>
                          <span className="fit-value"><b>{p.fit}</b> <span className="muted">{p.band}</span></span>
                          {isOpen && p.why.length > 0 && <small className="fit-why muted">Matches on {p.why.join(' and ')}.</small>}
                        </li>
                      ))}
                    </ul>
                    <div className="row proj-foot">
                      <button type="button" className="ghost" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [t.id]: !isOpen })}>{isOpen ? 'Show less' : 'All playlist types and the numbers'}</button>
                      <button type="button" className="ghost danger" onClick={() => remove(rel, t.id)}>Remove</button>
                    </div>
                    {isOpen && (
                      <div className="stack tight">
                        <dl className="feature-grid">
                          {FEATURE_ROWS.map(([k, label, fmt]) => <div key={k}><dt>{label}</dt><dd>{fmt(a.features[k])}</dd></div>)}
                        </dl>
                        <Note>{a.source === 'manual' ? 'Set by you' : 'Estimated earlier by an audio analysis service'} on {new Date(a.analysed_at).toLocaleDateString()}. Use Edit sound to change it.</Note>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {edit && (
        <Modal title={`Describe “${edit.title}”`} onClose={() => !saving && setEdit(null)}>
          <p className="muted">Move each slider to where the song sits. Nothing is uploaded: these numbers are all that is saved.</p>
          <div className="stack tight">
            {SLIDERS.map(({ key, label, low, high }) => (
              <label key={key} className="proj-slider">
                <span className="proj-slider-top"><b>{label}</b><span className="muted">{form[key]}%</span></span>
                <input type="range" min={0} max={100} step={5} value={form[key]} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} />
                <span className="proj-slider-ends muted"><small>{low}</small><small>{high}</small></span>
              </label>
            ))}
            <label className="proj-slider">
              <span className="proj-slider-top"><b>Tempo (BPM)</b><span className="muted">optional</span></span>
              <input type="number" inputMode="numeric" min={30} max={300} placeholder="e.g. 112" value={form.tempo} onChange={(e) => setForm({ ...form, tempo: e.target.value })} />
            </label>
          </div>
          {error && <ErrorBox error={error} />}
          <div className="row actions">
            <button type="button" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save and show fits'}</button>
            <button type="button" className="ghost" disabled={saving} onClick={() => setEdit(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </section>
  )
}

// ---- StreamImport ----------------------------------------------------------
const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_FIGURES = 20000
const FIELDS: FieldKey[] = ['isrc', 'streams', 'period', 'platform']

interface Done { saved: number; skipped: number; unmatched: number; fileProblems: number; serverSkipped: string[] }

// Three steps in one dialog: pick a CSV, check how its columns are read, then import.
export function StreamImport({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [fileName, setFileName] = useState('')
  const [table, setTable] = useState<string[][] | null>(null)
  const [headerRow, setHeaderRow] = useState(0)
  const [mapping, setMapping] = useState<Mapping>({ isrc: -1, streams: -1, period: -1, platform: -1 })
  const [fixedPlatform, setFixedPlatform] = useState('')
  const [dateOrder, setDateOrder] = useState<DateOrder>('dmy')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Done | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const headers = table ? table[headerRow] ?? [] : []
  const data = useMemo(() => (table ? table.slice(headerRow + 1) : []), [table, headerRow])
  const parsed = useMemo(() => readRows(data, { mapping, fixedPlatform, dateOrder }), [data, mapping, fixedPlatform, dateOrder])

  async function pick(file: File | undefined) {
    if (!file) return
    setError('')
    if (file.size > MAX_FILE_BYTES) return setError('That file is over 20 MB. Export a shorter date range and try again.')
    try {
      const rows = parseCsv(await file.text())
      if (rows.length < 2) return setError('That file has no data rows. Check that it is a CSV export with a header row.')
      const h = findHeaderRow(rows)
      setFileName(file.name); setTable(rows); setHeaderRow(h)
      setMapping(guessMapping(rows[h]))
    } catch { setError('Could not read that file.') }
  }

  const mappedOk = mapping.isrc >= 0 && mapping.streams >= 0 && mapping.period >= 0 && (mapping.platform >= 0 || !!fixedPlatform)
  const tooMany = parsed.rows.length > MAX_FIGURES
  const canImport = mappedOk && parsed.rows.length > 0 && !tooMany && !busy

  async function run() {
    setBusy(true); setError('')
    try {
      const res = await api<{ import: { rows_saved: number }; skipped: { row: number; reason: string }[]; unmatched_isrcs: number }>(
        '/streams/imports', 'POST', { source: 'csv', fileName, rows: parsed.rows })
      const fileProblems = Object.values(parsed.problems).reduce((a, b) => a + b, 0)
      setDone({ saved: res.import.rows_saved, skipped: res.skipped.length, unmatched: res.unmatched_isrcs, fileProblems, serverSkipped: res.skipped.map((s) => s.reason) })
      onDone()
    } catch (e) {
      const err = e as ApiError
      setError([err.message, ...(err.details ?? [])].join(' '))
    } finally { setBusy(false) }
  }

  if (done) {
    return (
      <Modal title="Import finished" onClose={onClose}>
        <p>Saved <strong>{fmtInt(done.saved)}</strong> figure{done.saved === 1 ? '' : 's'} (one per song, platform and month).</p>
        {done.fileProblems > 0 && <p className="muted">{fmtInt(done.fileProblems)} row{done.fileProblems === 1 ? ' was' : 's were'} skipped because they could not be read.</p>}
        {done.unmatched > 0 && (
          <p className="muted">{done.unmatched} ISRC{done.unmatched === 1 ? '' : 's'} in this file {done.unmatched === 1 ? 'is' : 'are'} not on any song in your catalogue. The figures are kept. Add the ISRC to the song and they will line up.</p>
        )}
        <div className="row actions"><button type="button" onClick={onClose}>Done</button></div>
      </Modal>
    )
  }

  return (
    <Modal title="Import streams from a CSV" onClose={() => !busy && onClose()}>
      <div className="import-body">
        {!table ? (
          <>
            <p className="muted">Export your streaming report from your distributor as a CSV and choose it here. Each row needs an ISRC, a month or date, a number of streams and (unless the file is for one platform) the platform.</p>
            <input ref={input} type="file" accept=".csv,.tsv,.txt,text/csv" onChange={(e) => pick(e.target.files?.[0])} />
            <Note>Importing the same month again replaces the earlier figure, so it is safe to re-upload a corrected file.</Note>
          </>
        ) : (
          <>
            <p><strong>{fileName}</strong> <span className="muted">· {fmtInt(data.length)} data rows</span> <button type="button" className="ghost" onClick={() => { setTable(null); setFileName(''); setError('') }}>Choose another file</button></p>

            <h4>Which column is which?</h4>
            <div className="map-grid">
              {FIELDS.map((f) => (
                <label key={f}>
                  <span>{FIELD_LABELS[f]}{f !== 'platform' && ' *'}</span>
                  <select value={mapping[f]} onChange={(e) => setMapping({ ...mapping, [f]: Number(e.target.value) })}>
                    <option value={-1}>{f === 'platform' ? 'No column (one platform for the whole file)' : 'Choose a column'}</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h.trim() || `Column ${i + 1}`}</option>)}
                  </select>
                </label>
              ))}
              {mapping.platform < 0 && (
                <label>
                  <span>Platform for every row *</span>
                  <select value={fixedPlatform} onChange={(e) => setFixedPlatform(e.target.value)}>
                    <option value="">Choose a platform</option>
                    {STREAMING_PLATFORMS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </label>
              )}
              <label>
                <span>Dates like 03/04/2026 mean</span>
                <select value={dateOrder} onChange={(e) => setDateOrder(e.target.value as DateOrder)}>
                  <option value="dmy">3 April (day first)</option>
                  <option value="mdy">March 4 (month first)</option>
                </select>
              </label>
            </div>

            {mappedOk && (
              <div className="import-preview">
                <h4>What will be imported</h4>
                {parsed.rows.length === 0 ? (
                  <p className="muted">No rows could be read with these settings.</p>
                ) : (
                  <>
                    <p>
                      <strong>{fmtInt(parsed.rows.length)}</strong> figure{parsed.rows.length === 1 ? '' : 's'} on {parsed.platforms.map(platformLabel).join(', ')},{' '}
                      {fmtMonth(`${parsed.months[0]}-01`, true)}{parsed.months.length > 1 && ` to ${fmtMonth(`${parsed.months[parsed.months.length - 1]}-01`, true)}`}.
                    </p>
                    <div className="table-scroll">
                      <table>
                        <thead><tr><th>ISRC</th><th>Platform</th><th>Month</th><th className="num">Streams</th></tr></thead>
                        <tbody>
                          {parsed.rows.slice(0, 5).map((r) => (
                            <tr key={`${r.isrc}${r.platform}${r.period}`}>
                              <td>{r.isrc}</td><td>{platformLabel(r.platform)}</td><td>{fmtMonth(`${r.period}-01`, true)}</td><td className="num">{fmtInt(r.streams)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                {Object.entries(parsed.problems).length > 0 && (
                  <ul className="muted import-problems">
                    {Object.entries(parsed.problems).map(([why, n]) => <li key={why}>{fmtInt(n)} row{n === 1 ? '' : 's'} skipped: {why.toLowerCase()}</li>)}
                  </ul>
                )}
                {tooMany && <ErrorBox error={`That is ${fmtInt(parsed.rows.length)} figures. An import can hold ${fmtInt(MAX_FIGURES)}. Export a shorter date range and try again.`} />}
              </div>
            )}
          </>
        )}
        {error && <ErrorBox error={error} />}
      </div>
      <div className="row actions">
        {table && <button type="button" disabled={!canImport} onClick={run}>{busy ? 'Importing…' : 'Import'}</button>}
        <button type="button" className="ghost" disabled={busy} onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  )
}
