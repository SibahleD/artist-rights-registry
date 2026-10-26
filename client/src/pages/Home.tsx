import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { ArtCard } from '../components/files'
import { Badge, Collapsible, fmtDate } from '../components/ui'
import Hero from '../components/Hero'
import { groupOf } from '../lib/groups'
import type { ReadinessCheck, ReadinessReport, Release, SharedTrack } from '../types'

// Slot for analytics on released tracks. Intentionally empty until play counts are sorted out (build guide step 11).
function AnalyticsSlot(): null { return null }

// What to do next on a draft: the first thing still blocking it, else the first warning.
function nextStep(checks: ReadinessCheck[]): ReadinessCheck | null {
  return checks.find((c) => c.level === 'error') ?? checks.find((c) => c.level === 'warn') ?? null
}

const MAX_DRAFTS_SHOWN = 6
const JUST_RELEASED_DAYS = 30
const ymd = (d: Date) => d.toLocaleDateString('en-CA') // YYYY-MM-DD in the user's own time zone

// A release card on Home that leads straight to the next action.
function ActionCard({ r, to, message, badge }: { r: Release; to: string; message: string; badge?: ReactNode }) {
  return (
    <ArtCard to={to} artworkId={r.artwork_id}>
      <div>
        <strong>{r.title}</strong>
        <div className="muted">{message}</div>
        {badge && <div className="badges">{badge}</div>}
      </div>
    </ArtCard>
  )
}

export default function Home() {
  const { user } = useAuth()
  const [releases, setReleases] = useState<Release[] | null>(null)
  const [shared, setShared] = useState<SharedTrack[] | null>(null)
  const [next, setNext] = useState<Record<string, ReadinessCheck | null>>({})

  useEffect(() => {
    api<{ releases: Release[] }>('/releases').then((r) => setReleases(r.releases)).catch(() => {})
    api<{ tracks: SharedTrack[] }>('/shared-tracks').then((r) => setShared(r.tracks)).catch(() => {})
  }, [])

  // Plain drafts first, then drafts waiting on co-writers.
  const toFinish = (releases ?? [])
    .filter((r) => r.status === 'draft')
    .sort((a, b) => Number(groupOf(a) === 'awaiting') - Number(groupOf(b) === 'awaiting'))
    .slice(0, MAX_DRAFTS_SHOWN)
  const key = toFinish.map((r) => r.id).join(',')

  useEffect(() => {
    if (!key) return
    let live = true
    Promise.all(key.split(',').map((id) =>
      api<ReadinessReport>(`/releases/${id}/readiness`).then((c) => [id, nextStep(c.checks)] as const).catch(() => [id, null] as const),
    )).then((pairs) => { if (live) setNext(Object.fromEntries(pairs)) })
    return () => { live = false }
  }, [key])

  // Drafts with co-writer confirmations outstanding, and ready releases whose date passed in the last 30 days but have no store links yet.
  const toManage = (releases ?? []).filter((r) => r.status === 'draft' && (r.pending_notices ?? 0) > 0)
  const today = ymd(new Date())
  const since = ymd(new Date(Date.now() - JUST_RELEASED_DAYS * 86_400_000))
  const justReleased = (releases ?? []).filter((r) => r.status === 'ready' && !r.released_at && (r.link_count ?? 0) === 0 && !!r.release_date && r.release_date >= since && r.release_date <= today)

  const count = (g: ReturnType<typeof groupOf>) => releases?.filter((r) => groupOf(r) === g).length
  const drafts = releases?.filter((r) => r.status === 'draft').length

  return (
    <div className="stack">
      <Hero centered>
        <h1>Welcome, {user?.artist_name}</h1>
        <div className="stats">
          <Link to="/discography" className="option stat"><b>{count('released') ?? ''}</b>Released</Link>
          <Link to="/discography" className="option stat"><b>{count('yet') ?? ''}</b>Yet to release</Link>
          <Link to="/discography" className="option stat"><b>{drafts ?? ''}</b>Drafts</Link>
          <Link to="/discography" className="option stat"><b>{shared?.length ?? ''}</b>Collaborations</Link>
        </div>
      </Hero>
      <div className="row">
        <Link className="btn" to="/new/song">+ New Song Listing</Link>
        <Link className="btn secondary" to="/new/album">+ New Album / EP</Link>
      </div>

      {toFinish.length > 0 && (
        <Collapsible title="Finish your drafts" level="h2" className="">
          <div className="stack">
            {toFinish.map((r) => {
              const step = next[r.id]
              const known = r.id in next
              const waiting = (r.pending_notices ?? 0) > 0
              return (
                <ArtCard key={r.id} to={step ? step.fix : `/releases/${r.id}`} artworkId={r.artwork_id}>
                  <div>
                    <strong>{r.title}</strong>
                    <div className="muted">{known ? (step ? `Next: ${step.message}` : 'Everything required is done. Mark it ready.') : 'Checking what is left…'}</div>
                    <div className="badges">
                      <Badge status="draft" />
                      {waiting && <Badge status="pending" label={`${r.pending_notices} to confirm`} />}
                    </div>
                  </div>
                </ArtCard>
              )
            })}
          </div>
        </Collapsible>
      )}

      {toManage.length > 0 && (
        <Collapsible title="Manage splits" level="h2" className="">
          <div className="stack">
            {toManage.map((r) => (
              <ActionCard key={r.id} r={r} to={`/releases/${r.id}/splits`}
                message={`${r.pending_notices} co-writer${r.pending_notices === 1 ? '' : 's'} still to confirm. Open the splits to remind or resolve.`}
                badge={<Badge status="pending" label={`${r.pending_notices} to confirm`} />} />
            ))}
          </div>
        </Collapsible>
      )}

      {justReleased.length > 0 && (
        <Collapsible title="Just released, add the links" level="h2" className="">
          <div className="stack">
            {justReleased.map((r) => (
              <ActionCard key={r.id} r={r} to={`/releases/${r.id}#released`}
                message={`Out since ${fmtDate(r.release_date)}. Add its store links to mark it released.`} />
            ))}
          </div>
        </Collapsible>
      )}

      <AnalyticsSlot />
    </div>
  )
}
