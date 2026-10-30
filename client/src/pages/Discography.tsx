import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { Badge, Collapsible, ErrorBox, fmtDate, Loading } from '../components/ui'
import { AuthImage, vinylFallback, type RGB } from '../components/files'
import { groupOf, type Group } from '../lib/groups'
import type { Release, SharedTrack } from '../types'

function ReleaseCard({ r }: { r: Release }) {
  // Every release opens its release page. Drafts are edited from there ("Edit draft").
  const waiting = r.pending_notices ?? 0
  const to = `/releases/${r.id}`
  const [tints, setTints] = useState<[RGB, RGB] | null>(null)
  const style = tints ? ({ '--tint': tints[0].join(', '), '--tint-2': tints[1].join(', ') } as CSSProperties) : undefined
  return (
    <Link to={to} className={`card release${tints ? ' art' : ''}`} style={style}>
      <div className="cover"><AuthImage mediaId={r.artwork_id} alt="" fallback={vinylFallback} onColors={setTints} /></div>
      <div>
        <strong>{r.title}</strong>
        <div className="muted">{r.album_artist}</div>
        <div className="muted">
          {r.release_type.toUpperCase()} · {r.track_count ?? 0} song{r.track_count === 1 ? '' : 's'} ·{' '}
          {r.release_date ? fmtDate(r.release_date) : 'No release date'}
        </div>
        <div className="badges">
          <Badge status={r.released_at ? 'released' : r.status} />
          {waiting > 0 && <Badge status="pending" label={r.status === 'draft' ? `${waiting} to confirm` : 'co-writers unconfirmed'} />}
        </div>
      </div>
    </Link>
  )
}

function SharedTrackCard({ t }: { t: SharedTrack }) {
  const pct = Number(t.ownership_percent)
  return (
    <Link to={`/shared-tracks/${t.id}`} className="card release">
      <div className="cover">{vinylFallback}</div>
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

const GROUPS: { key: Group; title: string; empty: string }[] = [
  { key: 'released', title: 'Releases', empty: 'Nothing is live yet. Mark a ready release as released once it is on the stores.' },
  { key: 'awaiting', title: 'Awaiting approval', empty: 'No drafts are waiting on co-writers.' },
  { key: 'draft', title: 'Drafts', empty: 'No drafts.' },
  { key: 'yet', title: 'Yet to release', empty: 'Nothing is ready and waiting. Finish a draft and mark it ready to see it here.' },
]

// A bin: a labelled container that holds a set of releases. It collapses from its header, and when it is empty it says what belongs in it.
function Bin({ title, count, empty, children }: { title: string; count: number; empty: string; children: ReactNode }) {
  return (
    <Collapsible className="bin" level="h2" title={<>{title} <span className="bin-count">{count}</span></>}>
      {count ? children : <p className="bin-empty">{empty}</p>}
    </Collapsible>
  )
}

function ReleaseGroup({ title, items, empty }: { title: string; items: Release[]; empty: string }) {
  return (
    <Bin title={title} count={items.length} empty={empty}>
      <div className="cards">{items.map((r) => <ReleaseCard key={r.id} r={r} />)}</div>
    </Bin>
  )
}

export default function DiscographyPage() {
  const [releases, setReleases] = useState<Release[] | null>(null)
  const [shared, setShared] = useState<SharedTrack[] | null>(null)
  const [err, setErr] = useState('')
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
  if (!releases || !shared) return <Loading what="Loading your discography" variant="list" />


  return (
    <div className="stack">
      <div className="row between">
        <h1>Discography</h1>
        <div className="row">
          <button onClick={() => nav('/new/song')}>+ New Song</button>
          <button className="secondary" onClick={() => nav('/new/album')}>+ New Album / EP</button>
        </div>
      </div>

      {GROUPS.map((g) => (
        <ReleaseGroup key={g.key} title={g.title} empty={g.empty} items={releases.filter((r) => groupOf(r) === g.key)} />
      ))}

      <Bin title="Collaborations" count={shared.length} empty="Songs where you are listed as a collaborator will appear here once the release is ready.">
        <div className="cards">{shared.map((t) => <SharedTrackCard key={t.id} t={t} />)}</div>
      </Bin>
    </div>
  )
}
