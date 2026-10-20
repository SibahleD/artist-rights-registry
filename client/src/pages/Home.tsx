import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { AuthImage, vinylFallback } from '../components/files'
import { Badge, Collapsible } from '../components/ui'
import { groupOf } from '../lib/groups'
import type { ReadinessCheck, ReadinessReport, Release, SharedTrack } from '../types'

// Slot for analytics on released tracks. Intentionally empty until play counts are sorted out (build guide step 11).
function AnalyticsSlot(): null { return null }

// What to do next on a draft: the first thing still blocking it, else the first unacknowledged warning.
function nextStep(checks: ReadinessCheck[]): ReadinessCheck | null {
  return checks.find((c) => c.level === 'error') ?? checks.find((c) => c.level === 'warn' && !c.acknowledged) ?? null
}

const MAX_DRAFTS_SHOWN = 6

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

  const count = (g: ReturnType<typeof groupOf>) => releases?.filter((r) => groupOf(r) === g).length
  const drafts = releases?.filter((r) => r.status === 'draft').length

  return (
    <div className="stack">
      <h1>Welcome, {user?.artist_name}</h1>
      <div className="stats">
        <Link to="/discography" className="option stat"><b>{count('released') ?? ''}</b>Released</Link>
        <Link to="/discography" className="option stat"><b>{count('yet') ?? ''}</b>Yet to release</Link>
        <Link to="/discography" className="option stat"><b>{drafts ?? ''}</b>Drafts</Link>
        <Link to="/discography" className="option stat"><b>{shared?.length ?? ''}</b>Collaborations</Link>
      </div>
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
                <Link key={r.id} to={step ? step.fix : `/releases/${r.id}`} className="card release">
                  <div className="cover"><AuthImage mediaId={r.artwork_id} alt="" fallback={vinylFallback} /></div>
                  <div>
                    <strong>{r.title}</strong>
                    <div className="muted">{known ? (step ? `Next: ${step.message}` : 'Everything required is done. Mark it ready.') : 'Checking what is left…'}</div>
                    <div className="badges">
                      <Badge status="draft" />
                      {waiting && <Badge status="pending" label={`${r.pending_notices} to confirm`} />}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </Collapsible>
      )}

      <AnalyticsSlot />
    </div>
  )
}
