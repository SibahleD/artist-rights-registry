import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { Badge, ErrorBox, fmtDate, fmtDateTime, fmtDuration, Loading } from '../components/ui'
import type { Collaborator, Release, Track } from '../types'

export function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click(); URL.revokeObjectURL(url)
}

const TYPE_LABEL = { single: 'Single', ep: 'EP', album: 'Album' } as const

export default function ReleaseView() {
  const { id } = useParams()
  const nav = useNavigate()
  const [r, setR] = useState<Release | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [err, setErr] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<{ release: Release; tracks: Track[] }>(`/releases/${id}`)
      .then((x) => { setR(x.release); setTracks(x.tracks) })
      .catch((e) => setErr(e.message))
  }, [id])

  if (err) return <ErrorBox error={err} />
  if (!r) return <Loading />

  // There is no export endpoint, so assemble the metadata from the release, track and split endpoints.
  async function exportMetadata() {
    if (!r) return
    setBusy(true); setActionErr('')
    try {
      const { tracks: full } = await api<{ tracks: Track[] }>(`/releases/${r.id}/tracks`)
      const splits = await Promise.all(
        full.map((t) => api<{ collaborators: Collaborator[] }>(`/releases/${r.id}/tracks/${t.id}/collaborators`)),
      )
      downloadJson(`${r.title}.json`, {
        release: r,
        tracks: full.map((t, i) => ({ ...t, collaborators: splits[i].collaborators })),
      })
    } catch (e) { setActionErr((e as Error).message) } finally { setBusy(false) }
  }

  async function revert() {
    if (!r) return
    setBusy(true); setActionErr('')
    try {
      await api(`/releases/${r.id}/revert`, 'POST')
      nav(`/releases/${r.id}/edit`)
    } catch (e) { setActionErr((e as Error).message); setBusy(false) }
  }

  async function remove() {
    if (!r || !window.confirm(`Delete "${r.title}"? This can't be undone.`)) return
    setBusy(true); setActionErr('')
    try {
      await api(`/releases/${r.id}`, 'DELETE')
      nav('/discography')
    } catch (e) { setActionErr((e as Error).message); setBusy(false) }
  }

  return (
    <div className="stack">
      <div className="hero">
        <Link to="/discography" className="back">← Back to Discography</Link>
        <h1>{r.title} ({TYPE_LABEL[r.release_type]}) <Badge status={r.status} /></h1>
        <div className="sub">Artist: {r.album_artist}</div>
        <div className="sub">Set to release: {r.release_date ? fmtDate(r.release_date) : '—'}</div>
        <div className="row actions">
          <button className="secondary" disabled={busy} onClick={exportMetadata}>Export metadata (JSON)</button>
          {r.status === 'draft' && <Link className="btn secondary" to={`/releases/${r.id}/edit`}>Edit draft</Link>}
          {r.status === 'ready' && <button className="secondary" disabled={busy} onClick={revert}>Revert to draft</button>}
          {r.status === 'draft' && <button className="danger" disabled={busy} onClick={remove}>Delete release</button>}
        </div>
      </div>
      {actionErr && <ErrorBox error={actionErr} />}

      <div className="card grid2">
        <div><span className="muted">Album artist</span><br />{r.album_artist}</div>
        <div><span className="muted">Genre</span><br />{r.genre || '—'}</div>
        <div><span className="muted">Release date</span><br />{r.release_date ? fmtDate(r.release_date) : '—'}</div>
        <div><span className="muted">UPC</span><br />{r.upc || '—'}</div>
        <div><span className="muted">℗ line</span><br />{r.p_line || '—'}</div>
        <div><span className="muted">© line</span><br />{r.c_line || '—'}</div>
        <div><span className="muted">Created</span><br />{fmtDateTime(r.created_at)}</div>
        <div><span className="muted">Marked ready</span><br />{r.ready_at ? fmtDateTime(r.ready_at) : '—'}</div>
      </div>

      <h2>{r.release_type === 'single' ? 'Song' : 'Tracklist'}</h2>
      <table><thead><tr><th>#</th><th>Title</th><th>ISRC</th><th>Duration</th></tr></thead>
        <tbody>{tracks.map((t) => (
          <tr key={t.id}>
            <td>{t.track_number}</td>
            <td><Link to={`/releases/${r.id}/tracks/${t.id}`}>{t.title}</Link></td>
            <td>{t.isrc || '—'}</td>
            <td>{fmtDuration(t.duration_seconds)}</td>
          </tr>
        ))}</tbody></table>
      {tracks.length === 0 && <p className="muted">No songs on this release yet.</p>}
    </div>
  )
}
