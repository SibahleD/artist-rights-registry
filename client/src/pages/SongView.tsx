import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { Badge, ErrorBox, fmtDate, fmtDateTime, fmtDuration, Loading } from '../components/ui'
import type { Collaborator, Release, Track } from '../types'
import { downloadJson } from './ReleaseView'

interface Data { release: Release; track: Track; collaborators: Collaborator[] }

const EXPLICIT_LABEL = { explicit: 'Explicit', not_explicit: 'Not explicit', cleaned: 'Cleaned' } as const

export default function SongView() {
  const { releaseId, trackId } = useParams()
  const { user } = useAuth()
  const [d, setD] = useState<Data | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    const base = `/releases/${releaseId}`
    Promise.all([
      api<{ release: Release }>(base),
      api<{ track: Track }>(`${base}/tracks/${trackId}`),
      api<{ collaborators: Collaborator[] }>(`${base}/tracks/${trackId}/collaborators`),
    ])
      .then(([r, t, c]) => setD({ release: r.release, track: t.track, collaborators: c.collaborators }))
      .catch((e) => setErr(e.message))
  }, [releaseId, trackId])

  if (err) return <ErrorBox error={err} />
  if (!d) return <Loading />
  const { release: r, track: t, collaborators } = d
  const backTo = r.release_type === 'single' ? '/discography' : `/releases/${r.id}`

  return (
    <div className="stack">
      <div className="hero">
        <Link to={backTo} className="back">← Back to {r.release_type === 'single' ? 'Discography' : r.title}</Link>
        <h1>{String(t.track_number).padStart(2, '0')}. {t.title} <Badge status={r.status} /></h1>
        <div className="sub">Artist: {t.artist_name || r.album_artist}</div>
        <div className="row actions">
          <button className="secondary" onClick={() => downloadJson(`${t.title}.json`, { release: r, track: { ...t, collaborators } })}>Export JSON</button>
          {r.status === 'draft' && <Link className="btn secondary" to={`/releases/${r.id}/edit`}>Edit draft</Link>}
        </div>
      </div>

      <div className="card grid2">
        <div><span className="muted">Album artist</span><br />{r.album_artist}</div>
        <div><span className="muted">Composition title</span><br />{t.composition_title || '—'}</div>
        <div><span className="muted">ISRC</span><br />{t.isrc || '—'}</div>
        <div><span className="muted">ISWC</span><br />{t.iswc || '—'}</div>
        <div><span className="muted">Genre / duration</span><br />{t.genre || '—'} · {fmtDuration(t.duration_seconds)}</div>
        <div><span className="muted">Explicit content</span><br />{t.explicit ? EXPLICIT_LABEL[t.explicit] : '—'}</div>
        <div><span className="muted">Composition ©</span><br />{[t.composition_copyright_year, t.composition_copyright].filter(Boolean).join(' ') || '—'}</div>
        <div><span className="muted">Recording ℗</span><br />{[t.recording_copyright_year, t.recording_copyright].filter(Boolean).join(' ') || '—'}</div>
        <div><span className="muted">Audio file</span><br />{t.audio ? `${t.audio.file_name} (${t.audio.format.toUpperCase()})` : '—'}</div>
        <div><span className="muted">Release date / ready</span><br />{r.release_date ? fmtDate(r.release_date) : '—'}<br />{r.ready_at ? fmtDateTime(r.ready_at) : '—'}</div>
      </div>

      <h2>Royalty splits</h2>
      <table><thead><tr><th>Legal name</th><th>Role</th><th>Share</th></tr></thead>
        <tbody>{collaborators.map((c) => (
          <tr key={c.id}>
            <td>
              {c.legal_name}{c.user_id === user?.id && ' (you)'}
              {c.invited_email && !c.user_id && <span className="muted"> · invited, no account yet</span>}
            </td>
            <td>{c.role}</td>
            <td>{Number(c.ownership_percent)}%</td>
          </tr>
        ))}</tbody></table>
    </div>
  )
}
