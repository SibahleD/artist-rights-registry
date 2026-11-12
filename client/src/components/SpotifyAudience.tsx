import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../api'
import { ConfirmModal, ErrorBox, fmtDateTime, Loading, Modal, Note } from './ui'
import { LineChart } from './performance'
import { fmtCompact, fmtInt, fmtMonth } from '../lib/format'
import { byMonth, readSpotifyCsv, sumOf, type AudienceDay, type AudienceRow } from '../lib/spotifyAudience'

const MAX_FILE_BYTES = 2 * 1024 * 1024

interface Saved { saved: number; trimmed: number; skipped_count: number; first_day: string; last_day: string }

// Pick the file from Spotify for Artists, see what it holds, import.
export function SpotifyImport({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<AudienceRow[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Saved | null>(null)
  const input = useRef<HTMLInputElement>(null)

  async function pick(file: File | undefined) {
    if (!file) return
    setError('')
    if (file.size > MAX_FILE_BYTES) return setError('That file is over 2 MB, so it is probably not the audience file from Spotify for Artists.')
    try {
      const r = readSpotifyCsv(await file.text())
      if (r.error) return setError(r.error)
      setFileName(file.name); setRows(r.rows)
    } catch { setError('Could not read that file.') }
  }

  async function run() {
    if (!rows) return
    setBusy(true); setError('')
    try {
      setDone(await api<Saved>('/spotify-audience', 'POST', { fileName, rows }))
      onDone()
    } catch (e) {
      const err = e as ApiError
      setError([err.message, ...(err.details ?? [])].join(' '))
    } finally { setBusy(false) }
  }

  if (done) {
    return (
      <Modal title="Import finished" onClose={onClose}>
        <p>Saved <strong>{fmtInt(done.saved)}</strong> days, from {fmtMonth(`${done.first_day.slice(0, 7)}-01`, true)} to {fmtMonth(`${done.last_day.slice(0, 7)}-01`, true)}.</p>
        {done.trimmed > 0 && <p className="muted">{fmtInt(done.trimmed)} empty day{done.trimmed === 1 ? '' : 's'} at the start of the file {done.trimmed === 1 ? 'was' : 'were'} left out, from before you had any activity.</p>}
        {done.skipped_count > 0 && <p className="muted">{fmtInt(done.skipped_count)} row{done.skipped_count === 1 ? ' was' : 's were'} skipped because the values could not be read.</p>}
        <div className="row actions"><button type="button" onClick={onClose}>Done</button></div>
      </Modal>
    )
  }

  return (
    <Modal title="Import Spotify for Artists data" onClose={() => !busy && onClose()}>
      <div className="import-body">
        {!rows ? (
          <>
            <p className="muted">In Spotify for Artists, open <strong>Audience</strong>, choose a date range, and download the CSV. Then choose that file here. It has one row per day with your listeners, streams, playlist adds, saves and followers.</p>
            <input ref={input} type="file" accept=".csv,text/csv" onChange={(e) => pick(e.target.files?.[0])} />
            <Note>Importing again replaces the days that are in the new file, so it is safe to upload a newer export.</Note>
          </>
        ) : (
          <>
            <p><strong>{fileName}</strong> <span className="muted">· {fmtInt(rows.length)} days</span> <button type="button" className="ghost" onClick={() => { setRows(null); setFileName(''); setError('') }}>Choose another file</button></p>
            <p className="muted">First day {rows[0]?.date}, last day {rows[rows.length - 1]?.date}.</p>
          </>
        )}
        {error && <ErrorBox error={error} />}
      </div>
      <div className="row actions">
        {rows && <button type="button" disabled={busy} onClick={run}>{busy ? 'Importing…' : 'Import'}</button>}
        <button type="button" className="ghost" disabled={busy} onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  )
}

interface Audience { days: AudienceDay[]; imported_at: string | null; file_name: string | null }

// The saved Spotify figures: headline numbers and two charts. Reloads whenever `reloadKey` changes.
export function SpotifyAudiencePanel({ reloadKey, onImport, onChanged }: { reloadKey: number; onImport: () => void; onChanged: () => void }) {
  const [a, setA] = useState<Audience | null>(null)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api<Audience>('/spotify-audience').then(setA).catch((e) => setError((e as Error).message))
  }, [])
  useEffect(() => { load() }, [load, reloadKey])

  async function remove() {
    setBusy(true)
    try { await api('/spotify-audience', 'DELETE'); setRemoving(false); setA({ days: [], imported_at: null, file_name: null }); onChanged() }
    catch (e) { setError((e as Error).message); setRemoving(false) }
    finally { setBusy(false) }
  }

  if (error) return <ErrorBox error={error} />
  if (!a) return <Loading />

  if (a.days.length === 0) {
    return (
      <section className="card">
        <h4>No Spotify data yet</h4>
        <p className="muted">Import the audience CSV from Spotify for Artists to see your listeners, streams, playlist adds, saves and followers here.</p>
        <button type="button" onClick={onImport}>Import Spotify CSV</button>
      </section>
    )
  }

  const last = a.days[a.days.length - 1]
  const streams = byMonth(a.days, 'streams', 'sum')
  const listeners = byMonth(a.days, 'monthly_listeners', 'last')
  const lab = (m: [string, number][]) => m.map(([k]) => fmtMonth(`${k}-01`, true))

  return (
    <>
      <div className="stats">
        <div className="option stat"><span>Streams</span><b>{fmtCompact(sumOf(a.days, 'streams'))}</b></div>
        <div className="option stat"><span>Monthly listeners (latest)</span><b>{fmtCompact(last.monthly_listeners)}</b></div>
        <div className="option stat"><span>Followers (latest)</span><b>{fmtCompact(last.followers)}</b></div>
        <div className="option stat"><span>Playlist adds</span><b>{fmtCompact(sumOf(a.days, 'playlist_adds'))}</b></div>
        <div className="option stat"><span>Saves</span><b>{fmtCompact(sumOf(a.days, 'saves'))}</b></div>
      </div>
      <section className="card">
        <h4>Spotify streams per month</h4>
        <LineChart labels={lab(streams)} series={[{ name: 'Streams', values: streams.map(([, v]) => v) }]} exact={fmtInt} unit=" streams" label="Spotify streams per month" />
      </section>
      <section className="card">
        <h4>Monthly listeners, end of each month</h4>
        <LineChart labels={lab(listeners)} series={[{ name: 'Monthly listeners', values: listeners.map(([, v]) => v) }]} exact={fmtInt} unit=" listeners" label="Spotify monthly listeners" />
      </section>
      <p className="muted">
        From Spotify for Artists, {a.days[0].day} to {last.day}{a.imported_at ? `, imported ${fmtDateTime(a.imported_at)}` : ''}. {' '}
        <button type="button" className="ghost" onClick={onImport}>Import a newer file</button>{' '}
        <button type="button" className="ghost" onClick={() => setRemoving(true)}>Remove Spotify data</button>
      </p>
      {removing && (
        <ConfirmModal title="Remove Spotify data?" confirmLabel="Remove" danger busy={busy} onConfirm={remove} onClose={() => setRemoving(false)}>
          <p>This deletes the {fmtInt(a.days.length)} days you imported. Your songs and per-song stats are not affected. You can import the file again at any time.</p>
        </ConfirmModal>
      )}
    </>
  )
}
