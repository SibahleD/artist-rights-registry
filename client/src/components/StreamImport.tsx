import { useMemo, useRef, useState } from 'react'
import { api, ApiError } from '../api'
import { parseCsv, findHeaderRow } from '../lib/csv'
import { FIELD_LABELS, STREAMING_PLATFORMS, guessMapping, platformLabel, readRows, type DateOrder, type FieldKey, type Mapping } from '../lib/streamImport'
import { fmtInt, fmtMonth } from '../lib/format'
import { ErrorBox, Hint, Modal } from './ui'

const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_FIGURES = 20000
const FIELDS: FieldKey[] = ['isrc', 'streams', 'period', 'platform']

interface Done { saved: number; skipped: number; unmatched: number; fileProblems: number; serverSkipped: string[] }

// Three steps in one dialog: pick a CSV, check how its columns are read, then import.
export default function StreamImport({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
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
            <Hint>Importing the same month again replaces the earlier figure, so it is safe to re-upload a corrected file.</Hint>
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
