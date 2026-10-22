import { useEffect, useState } from 'react'
import Hero, { BackLink } from '../components/Hero'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import { Collapsible, ErrorBox, fmtDate, fmtDuration, Loading } from '../components/ui'
import type { SharedTrackDetail } from '../types'

const EXPLICIT_LABEL: Record<string, string> = {
  explicit: 'Explicit',
  not_explicit: 'Not explicit',
  cleaned: 'Clean version',
}

export default function SharedTrackView() {
  const { id } = useParams()
  const [data, setData] = useState<SharedTrackDetail | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    setData(null)
    setErr('')
    api<SharedTrackDetail>(`/shared-tracks/${id}`)
      .then((x) => { if (!cancelled) setData(x) })
      .catch((e) => { if (!cancelled) setErr(e.message) })
    return () => { cancelled = true }
  }, [id])

  if (err) {
    return (
      <div className="stack">
        <BackLink to="/discography">Back to Discography</BackLink>
        <ErrorBox error={err} />
      </div>
    )
  }
  if (!data) return <Loading what="Loading this song" />

  const { track: t, splits } = data

  return (
    <div className="stack">
      <Hero back={<BackLink to="/discography">Back to Discography</BackLink>}>
        <h1>{t.title}</h1>
        <div className="sub">From “{t.release_title}” by {t.album_artist}</div>
        <div className="sub">Release owner: {t.owner_artist_name}</div>
        <div className="sub">Release date: {t.release_date ? fmtDate(t.release_date) : '—'}</div>
      </Hero>

      <Collapsible title="General info">
      <div className="grid2">
        <div><span className="muted">Track number</span><br />{t.track_number}</div>
        <div><span className="muted">Performing artist</span><br />{t.artist_name || t.album_artist}</div>
        <div><span className="muted">Composition title</span><br />{t.composition_title || '—'}</div>
        <div><span className="muted">Duration</span><br />{fmtDuration(t.duration_seconds)}</div>
        <div><span className="muted">ISRC</span><br />{t.isrc || '—'}</div>
        <div><span className="muted">ISWC</span><br />{t.iswc || '—'}</div>
        <div><span className="muted">Content rating</span><br />{t.explicit ? EXPLICIT_LABEL[t.explicit] ?? t.explicit : '—'}</div>
      </div>
      </Collapsible>

      <Collapsible title="Credits and splits">
      <table>
        <thead>
          <tr><th>Name</th><th>Role</th><th>Share</th></tr>
        </thead>
        <tbody>
          {splits.map((s, i) => (
            <tr key={i}>
              <td>{s.legal_name}{s.is_you && <> <strong>(you)</strong></>}</td>
              <td>{s.role}</td>
              <td>{Number(s.ownership_percent)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      </Collapsible>
      <p className="muted">
        NOTE: This is a read-only record of what {t.owner_artist_name} has listed. Only the release owner can change it.
      </p>
    </div>
  )
}
