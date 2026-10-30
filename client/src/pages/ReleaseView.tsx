import { useEffect, useState } from 'react'
import Hero, { BackLink } from '../components/Hero'
import StoreButtons from '../components/StoreButtons'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { AuthImage, tintGradient } from '../components/files'
import type { RGB } from '../components/files'
import ImageViewer from '../components/ImageViewer'
import { formatCopyright } from '../components/CopyrightInput'
import { useAuth } from '../auth'
import { buildRows, summarize } from '../lib/splitRows'
import { tryMarkReady } from '../components/ready'
import { Badge, Collapsible, ConfirmModal, ErrorBox, fmtDate, fmtDateTime, fmtDuration, Hint, Loading } from '../components/ui'
import { featTitle, featuredNames } from '../lib/collab'
import LinkRows from '../components/LinkRows'
import { useUnsavedChanges } from '../components/UnsavedGuard'
import { languageName } from '../data/options'
import { fixLink } from '../lib/focusFields'
import { blankRow, isBlankRow, rowName, rowToStore, storeToRow, type LinkRow } from '../data/services'
import type { Collaborator, Notice, ReadinessCheck, ReadinessReport, Release, ReleaseExport, ReleaseLink, Track } from '../types'

export function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click(); URL.revokeObjectURL(url)
}

// Release lines left blank fall back to the first song's copyright, the same way the export does.
const derivedLine = (symbol: string, year?: number | null, line?: string | null) => {
  const t = formatCopyright(year, line)
  return t ? `${symbol} ${t}` : '—'
}

const TYPE_LABEL = { single: 'Single', ep: 'EP', album: 'Album' } as const

// Ready releases only: record where the release is live. Marking it released locks it until it is un-marked.
function ReleasedPanel({ release, links, onChanged }: { release: Release; links: ReleaseLink[]; onChanged: () => Promise<void> }) {
  const live = !!release.released_at
  const initial = () => (links.length ? links.map(storeToRow) : [blankRow('streaming')])
  const snap = (r: LinkRow[]) => JSON.stringify(r.filter((x) => !isBlankRow(x)).map((x) => [x.service, rowName(x), x.url.trim()]))
  const [rows, setRows] = useState<LinkRow[]>(initial)
  const [base, setBase] = useState(() => snap(initial()))
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [askUnmark, setAskUnmark] = useState(false)
  const open = () => { const r = initial(); setRows(r); setBase(snap(r)); setErr(''); setEditing(true) }
  const dirty = (!live || editing) && snap(rows) !== base

  async function save(): Promise<boolean> {
    const used = rows.filter((x) => !isBlankRow(x))
    if (used.some((x) => !x.service || !rowName(x))) { setErr('Choose a store for each link.'); return false }
    setBusy(true); setErr('')
    try {
      await api(`/releases/${release.id}/released`, 'PUT', { links: used.map(rowToStore) })
      setBase(snap(rows))
      setEditing(false)
      await onChanged()
      return true
    } catch (e) { setErr((e as Error).message); return false } finally { setBusy(false) }
  }
  const { modal: guardModal } = useUnsavedChanges({ dirty, onSave: save })

  async function unmark() {
    setBusy(true); setErr('')
    try { await api(`/releases/${release.id}/released`, 'DELETE'); setAskUnmark(false); await onChanged() }
    catch (e) { setAskUnmark(false); setErr((e as Error).message) } finally { setBusy(false) }
  }

  const form = (
    <div className="stack">
      <Hint>Once the release is live, paste its link from each store's share menu. At least one is needed.</Hint>
      <LinkRows rows={rows} onChange={setRows} kinds={['streaming', 'store']} addLabel="Add another store" minRows={1} />
      {err && <ErrorBox error={err} />}
      <div className="row actions">
        <button disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : live ? 'Save links' : 'Mark as released'}</button>
        {live && <button className="ghost" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>}
      </div>
    </div>
  )

  return (
    <>
    {guardModal}
    {askUnmark && (
      <ConfirmModal title="Mark as not released?" confirmLabel="Mark as not released" busy={busy} onConfirm={unmark} onClose={() => setAskUnmark(false)}>
        <p>This release will be unlocked again. Your store links are kept.</p>
      </ConfirmModal>
    )}
    <Collapsible title={live ? 'Released' : 'Mark as released'}>
      {live && !editing ? (
        <div className="stack">
          <span className="muted">Marked released {fmtDate(release.released_at)}. This release is locked.</span>
          <StoreButtons links={links} />
          {err && <ErrorBox error={err} />}
          <div className="row actions">
            <button className="secondary" disabled={busy} onClick={open}>Edit links</button>
            <button className="ghost" disabled={busy} onClick={() => setAskUnmark(true)}>Mark as not released</button>
          </div>
        </div>
      ) : form}
    </Collapsible>
    </>
  )
}

const LEVEL_LABEL = { error: 'Fix', warn: 'Check', info: 'Tip' } as const

function ReadinessChecklist({ checks }: { checks: ReadinessCheck[] }) {
  const blocking = checks.filter((c) => c.level === 'error').length
  const title = blocking ? `Before you can mark this ready (${blocking} to fix)` : 'Ready to mark ready'
  return (
    <Collapsible title={title}>
      {blocking === 0 && <p className="ok">Everything required is in place. The items below are optional.</p>}
      <ul className="checklist">
        {checks.map((c, i) => (
          <li key={`${c.id}-${c.track ?? ''}-${i}`} className={`check ${c.level}`}>
            <span className="lvl">{LEVEL_LABEL[c.level]}</span>
            <span>{c.message}</span>
            {c.level !== 'info' && <Link to={fixLink(c.fix, c.id)}>Open</Link>}
          </li>
        ))}
      </ul>
    </Collapsible>
  )
}

export default function ReleaseView() {
  const { id } = useParams()
  const nav = useNavigate()
  const [r, setR] = useState<Release | null>(null)
  const [tint, setTint] = useState<RGB | null>(null)
  const [viewing, setViewing] = useState(false)
  const [tracks, setTracks] = useState<Track[]>([])
  const [err, setErr] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [askDelete, setAskDelete] = useState(false)
  const { user } = useAuth()
  const [notices, setNotices] = useState<Notice[]>([])
  const [people, setPeople] = useState<Collaborator[]>([])
  const [problems, setProblems] = useState<string[] | undefined>()
  const [checks, setChecks] = useState<ReadinessCheck[] | null>(null)
  const [links, setLinks] = useState<ReleaseLink[]>([])
  const { hash } = useLocation()
  useEffect(() => {
    if (hash === '#released' && r) document.getElementById('released-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash, r?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const x = await api<{ release: Release; tracks: Track[]; links: ReleaseLink[] }>(`/releases/${id}`)
    setR(x.release); setTracks(x.tracks); setLinks(x.links ?? [])
    if (x.release.status === 'draft') api<ReadinessReport>(`/releases/${id}/readiness`).then((c) => setChecks(c.checks)).catch(() => setChecks(null))
    else setChecks(null)
    const [n, c] = await Promise.all([
      api<{ notices: Notice[] }>(`/releases/${id}/notices`),
      Promise.all(x.tracks.map((t) => api<{ collaborators: Collaborator[] }>(`/releases/${id}/tracks/${t.id}/collaborators`))),
    ])
    setNotices(n.notices); setPeople(c.flatMap((z) => z.collaborators))
  }

  useEffect(() => { load().catch((e) => setErr(e.message)) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <ErrorBox error={err} />
  if (!r) return <Loading variant="detail" />

  // One endpoint returns the whole release as clean metadata (no internal ids, no co-writer emails).
  async function exportMetadata() {
    if (!r) return
    setBusy(true); setActionErr('')
    try {
      downloadJson(`${r.title}.json`, await api<ReleaseExport>(`/releases/${r.id}/export`))
    } catch (e) { setActionErr((e as Error).message) } finally { setBusy(false) }
  }

  async function markReady() {
    if (!r) return
    setBusy(true); setActionErr(''); setProblems(undefined)
    try {
      const res = await tryMarkReady(r.id)
      if (res.ok) await load()
      else { setActionErr(res.error); setProblems(res.problems) }
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
    if (!r) return
    setBusy(true); setActionErr('')
    try {
      await api(`/releases/${r.id}`, 'DELETE')
      nav('/discography')
    } catch (e) { setActionErr((e as Error).message); setBusy(false) }
  }

  const rows = buildRows(notices, people, tracks, user?.email)
  const removedLines = people.filter((c) => c.removed_by_writer)
  const sum = summarize(rows, removedLines.length)
  const splitsSummary = [
    sum.confirmed && `${sum.confirmed} confirmed`,
    sum.awaiting && `${sum.awaiting} awaiting approval`,
    sum.disputed && `${sum.disputed} disputed`,
    sum.removed && `${sum.removed} removed ${sum.removed === 1 ? 'line' : 'lines'}`,
  ].filter(Boolean).join(' · ')

  return (
    <div className="stack">
      {askDelete && (
        <ConfirmModal title="Delete this release?" danger confirmLabel="Delete release" busy={busy} onConfirm={remove} onClose={() => setAskDelete(false)}>
          <p>“{r.title}” and everything in it (songs, audio files, cover art and splits) will be deleted. This can't be undone.</p>
        </ConfirmModal>
      )}
      {viewing && <ImageViewer mediaId={r.artwork_id} alt="Cover art" onClose={() => setViewing(false)} />}
      <Hero
        back={<BackLink to="/discography">Back to Discography</BackLink>}
        style={r.artwork_id && tint ? { background: tintGradient(tint) } : undefined}
        art={r.artwork_id ? (
          <button type="button" className="cover viewable hero-cover" aria-label="View cover art full size" title="Click to view" onClick={() => setViewing(true)}>
            <AuthImage mediaId={r.artwork_id} alt="Cover art" onColor={setTint} />
          </button>
        ) : undefined}
      >
        <h1>{r.release_type === 'single' && tracks[0] ? featTitle(r.title, featuredNames(people.filter((c) => c.track_id === tracks[0].id))) : r.title} ({TYPE_LABEL[r.release_type]}) <Badge status={r.released_at ? 'released' : r.status} /></h1>
        <div className="sub">Artist: {r.album_artist}</div>
        <div className="sub">Set to release: {r.release_date ? fmtDate(r.release_date) : '—'}</div>
        <div className="row actions">
          <button className="secondary" disabled={busy} onClick={exportMetadata}>Export metadata (JSON)</button>
          {r.status === 'draft' && <Link className="btn secondary" to={`/releases/${r.id}/edit`}>Edit draft</Link>}
          {r.status === 'draft' && <button disabled={busy} onClick={markReady}>Mark ready</button>}
          {r.status === 'ready' && !r.released_at && <button className="secondary" disabled={busy} onClick={revert}>Revert to draft</button>}
          {r.status === 'draft' && <button className="danger" disabled={busy} onClick={() => setAskDelete(true)}>Delete release</button>}
        </div>
      </Hero>
      {actionErr && <ErrorBox error={actionErr} details={problems} />}

      {r.status === 'draft' && checks && <ReadinessChecklist checks={checks} />}
      {r.status === 'ready' && <div id="released-panel"><ReleasedPanel release={r} links={links} onChanged={load} /></div>}

      <Collapsible title="General info">
       <div className="split">
        <div className="grid2">
        <div><span className="muted">Album artist</span><br />{r.album_artist}</div>
        <div><span className="muted">Genre</span><br />{r.genre || tracks.find((t) => t.genre)?.genre || '—'}</div>
        <div><span className="muted">Release date</span><br />{r.release_date ? fmtDate(r.release_date) : '—'}</div>
        <div><span className="muted">UPC</span><br />{r.upc || '—'}</div>
        <div><span className="muted">℗ line</span><br />{r.p_line || derivedLine('℗', tracks[0]?.recording_copyright_year, tracks[0]?.recording_copyright)}</div>
        <div><span className="muted">© line</span><br />{r.c_line || derivedLine('©', tracks[0]?.composition_copyright_year, tracks[0]?.composition_copyright)}</div>
        <div><span className="muted">Label</span><br />{r.label_name || '—'}</div>
        {r.sales_start_date && <div><span className="muted">Sales start</span><br />{fmtDate(r.sales_start_date)}</div>}
        {r.originally_released && <div><span className="muted">Originally released</span><br />{fmtDate(r.originally_released)}</div>}
        {r.preorder_date && <div><span className="muted">Pre-order date</span><br />{fmtDate(r.preorder_date)}</div>}
        {r.secondary_genre && <div><span className="muted">Second genre</span><br />{r.secondary_genre}</div>}
        {r.album_version && <div><span className="muted">Album version</span><br />{r.album_version}</div>}
        {r.is_compilation && <div><span className="muted">Compilation</span><br />Yes</div>}
        <div><span className="muted">Language</span><br />{languageName(r.language) || '—'}</div>
        <div><span className="muted">Created</span><br />{fmtDateTime(r.created_at)}</div>
        <div><span className="muted">Marked ready</span><br />{r.ready_at ? fmtDateTime(r.ready_at) : '—'}</div>
        </div>
       </div>
      </Collapsible>

      {(rows.length > 0 || removedLines.length > 0) && (
        <section className="card summary-line">
          <span>
            <strong>Splits</strong> <span className="muted">· {splitsSummary || 'no co-writers invited yet'}</span>
          </span>
          <Link className="btn secondary" to={`/releases/${r.id}/splits`}>Manage splits</Link>
        </section>
      )}

      <Collapsible title={r.release_type === 'single' ? 'Song' : 'Tracklist'} level="h2" className="">
      <table><thead><tr><th>#</th><th>Title</th><th>ISRC</th><th>Duration</th></tr></thead>
        <tbody>{tracks.map((t) => (
          <tr key={t.id}>
            <td>{t.track_number}</td>
            <td><Link className="track-title" to={`/releases/${r.id}/tracks/${t.id}`}>{featTitle(t.title, featuredNames(people.filter((c) => c.track_id === t.id)))}</Link></td>
            <td>{t.isrc || '—'}</td>
            <td>{fmtDuration(t.duration_seconds)}</td>
          </tr>
        ))}</tbody></table>
      {tracks.length === 0 && <p className="muted">No songs on this release yet.</p>}
      </Collapsible>
    </div>
  )
}
