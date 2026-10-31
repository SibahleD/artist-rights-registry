import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { ArtCard } from '../components/files'
import { Badge, Collapsible, fmtDate, Hero } from '../components/ui'
import { LineChart } from '../components/performance'
import { fmtCompact, fmtInt, fmtMonth } from '../lib/format'
import { groupOf } from '../lib/release'
import { filterStats, monthOf, monthsBetween, platformLabel, ranked, shiftMonth, sumBy, type PerfData } from '../lib/stats'
import type { ReadinessCheck, ReadinessReport, Release, SharedTrack } from '../types'

// A short summary of the Performance page: the latest month against the one before, the last 12 months, and what led.
function PerformanceSummary() {
  const [data, setData] = useState<PerfData | null | undefined>(undefined) // undefined while loading, null if it failed
  useEffect(() => { api<PerfData>('/streams').then(setData).catch(() => setData(null)) }, [])

  const v = useMemo(() => {
    if (!data || data.stats.length === 0 || !data.last_period) return null
    const last = monthOf(data.last_period)
    const months = monthsBetween(shiftMonth(last, -11), last)
    const rows = filterStats(data.stats, { from: months[0], to: last }, null)
    const byMonth = sumBy(rows, (r) => monthOf(r.period))
    const values = months.map((m) => byMonth.get(m) ?? 0)
    const thisMonth = values[values.length - 1], before = values[values.length - 2] ?? 0
    const latest = rows.filter((r) => monthOf(r.period) === last)
    const titleOf = new Map(data.tracks.filter((t) => t.isrc).map((t) => [t.isrc as string, t.title]))
    const topSong = ranked(sumBy(latest, (r) => r.isrc))[0]
    const topPlatform = ranked(sumBy(latest, (r) => r.platform))[0]
    return {
      last, months, values, thisMonth,
      change: before > 0 ? (thisMonth - before) / before : null,
      year: values.reduce((a, n) => a + n, 0),
      topPlatform: topPlatform ? platformLabel(topPlatform[0]) : '—',
      topSong: topSong ? titleOf.get(topSong[0]) ?? topSong[0] : '—',
    }
  }, [data])

  if (data === undefined || data === null) return null
  const open = <Link className="btn secondary" to="/performance">Open Performance</Link>

  if (!v) {
    return (
      <Collapsible title="Performance" level="h2" className="" actions={open}>
        <p className="muted">No streams yet. Import the streaming report from your distributor on the Performance page and your numbers will show up here.</p>
      </Collapsible>
    )
  }
  return (
    <Collapsible title="Performance" level="h2" className="" actions={open}>
      <div className="stack">
        <div className="stats">
          <Link to="/performance" className="option stat">
            <span>Streams in {fmtMonth(`${v.last}-01`)}</span>
            <b>{fmtCompact(v.thisMonth)}</b>
            {v.change !== null && <span className={`perf-delta ${v.change >= 0 ? 'up' : 'down'}`}>{v.change >= 0 ? '▲' : '▼'} {Math.abs(Math.round(v.change * 100))}% vs last month</span>}
          </Link>
          <Link to="/performance" className="option stat"><span>Last 12 months</span><b>{fmtCompact(v.year)}</b></Link>
          <Link to="/performance" className="option stat"><span>Top platform, {fmtMonth(`${v.last}-01`, true)}</span><b className="stat-text">{v.topPlatform}</b></Link>
          <Link to="/performance" className="option stat"><span>Top song, {fmtMonth(`${v.last}-01`, true)}</span><b className="stat-text">{v.topSong}</b></Link>
        </div>
        <LineChart height={180} labels={v.months.map((m) => fmtMonth(`${m}-01`, true))} series={[{ name: 'Streams', values: v.values }]} exact={fmtInt} unit=" streams" label="Streams per month, last 12 months" />
      </div>
    </Collapsible>
  )
}

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

      <PerformanceSummary />

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

    </div>
  )
}
