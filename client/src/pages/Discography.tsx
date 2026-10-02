import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { Badge, ErrorBox, fmtDate, Loading } from '../components/ui'
import type { Release, SharedTrack } from '../types'

function ReleaseCard({ r }: { r: Release }) {
  const to = r.status === 'draft' ? `/releases/${r.id}/edit` : `/releases/${r.id}`
  return (
    <Link to={to} className="card release">
      <div className="cover">{r.title.slice(0, 1).toUpperCase()}</div>
      <div>
        <strong>{r.title}</strong>
        <div className="muted">{r.album_artist}</div>
        <div className="muted">
          {r.release_type.toUpperCase()} · {r.track_count ?? 0} song{r.track_count === 1 ? '' : 's'} ·{' '}
          {r.release_date ? fmtDate(r.release_date) : 'No release date'}
        </div>
        <Badge status={r.status} />
      </div>
    </Link>
  )
}

function SharedTrackCard({ t }: { t: SharedTrack }) {
  const pct = Number(t.ownership_percent)
  return (
    <Link to={`/shared-tracks/${t.id}`} className="card release">
      <div className="cover">{t.title.slice(0, 1).toUpperCase()}</div>
      <div>
        <strong>{t.title}</strong>
        <div className="muted">{t.release_title} · {t.album_artist}</div>
        <div className="muted">
          {t.role} · {Number.isFinite(pct) ? `${pct}%` : '—'} · Owner: {t.owner_artist_name}
        </div>
        <div className="muted">{t.release_date ? fmtDate(t.release_date) : 'No release date'}</div>
      </div>
    </Link>
  )
}

function ReleaseGroup({ title, items, empty }: { title: string; items: Release[]; empty: string }) {
  return (
    <section>
      <h2>{title}</h2>
      {items.length
        ? <div className="cards">{items.map((r) => <ReleaseCard key={r.id} r={r} />)}</div>
        : <p className="muted">{empty}</p>}
    </section>
  )
}

export default function DiscographyPage() {
  const [releases, setReleases] = useState<Release[] | null>(null)
  const [shared, setShared] = useState<SharedTrack[] | null>(null)
  const [err, setErr] = useState('')
  const [showDrafts, setShowDrafts] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    Promise.all([
      api<{ releases: Release[] }>('/releases'),
      api<{ tracks: SharedTrack[] }>('/shared-tracks'),
    ])
      .then(([r, s]) => {
        setReleases(r.releases)
        setShared(s.tracks)
      })
      .catch((e) => setErr(e.message))
  }, [])

  if (err) return <ErrorBox error={err} />
  if (!releases || !shared) return <Loading what="Loading your discography" />

  // The backend has no /discography endpoint: split the owner's releases by status here.
  const ready = releases.filter((r) => r.status === 'ready')
  const drafts = releases.filter((r) => r.status === 'draft')

  return (
    <div className="stack">
      <div className="row between">
        <h1>Discography</h1>
        <div className="row">
          <button onClick={() => nav('/new/song')}>+ New Song</button>
          <button className="secondary" onClick={() => nav('/new/album')}>+ New Album / EP</button>
        </div>
      </div>

      <ReleaseGroup
        title="My releases"
        items={ready}
        empty="Nothing ready yet. Finish a draft and mark it ready to see it here."
      />

      <section>
        <h2>Collaborations</h2>
        {shared.length
          ? <div className="cards">{shared.map((t) => <SharedTrackCard key={t.id} t={t} />)}</div>
          : <p className="muted">Songs where you are listed as a collaborator will appear here once the release is ready.</p>}
      </section>

      <section>
        <h2 className="clickable" onClick={() => setShowDrafts(!showDrafts)}>
          {showDrafts ? '▾' : '▸'} Drafts ({drafts.length})
        </h2>
        {showDrafts && (drafts.length
          ? <div className="cards">{drafts.map((r) => <ReleaseCard key={r.id} r={r} />)}</div>
          : <p className="muted">No drafts.</p>)}
      </section>
    </div>
  )
}
