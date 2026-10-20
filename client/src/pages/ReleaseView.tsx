import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { AuthImage, vinylFallback } from '../components/files'
import { useAuth } from '../auth'
import { AckModal, acknowledgeUnconfirmed, tryMarkReady } from '../components/ready'
import { Badge, Collapsible, ErrorBox, fmtDate, fmtDateTime, fmtDuration, Hint, Loading } from '../components/ui'
import type { Collaborator, Notice, ReadinessCheck, ReadinessReport, Release, ReleaseExport, ReleaseLink, Track } from '../types'

export function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click(); URL.revokeObjectURL(url)
}

const TYPE_LABEL = { single: 'Single', ep: 'EP', album: 'Album' } as const

type SendResult = { trackId: string; name: string; email: string; action: string }
const SEND_TEXT: Record<string, string> = {
  sent: 'invitation sent',
  updated: 'details changed, updated invitation sent',
  resent: 'invitation sent again',
  unchanged: 'already invited, nothing to send',
  blocked: 'removed themselves and cannot be invited again',
  limit: 'daily invitation limit reached, try again tomorrow',
  skipped_self: 'that is your own email, skipped',
}

// One line in the confirmations panel: a sent notice, or someone with an email who has not been invited yet.
interface Row { key: string; trackId: string; noticeId?: string; name: string; email: string | null; role: string; share: number
  status: string; note: string | null; expiresAt?: string; canRemind: boolean }

const STORES = ['Spotify', 'Apple Music', 'YouTube Music', 'Boomplay', 'Audiomack', 'Deezer', 'Tidal', 'Amazon Music', 'SoundCloud']

// Ready releases only: record where the release is live. Marking it released locks it until it is un-marked.
function ReleasedPanel({ release, links, onChanged }: { release: Release; links: ReleaseLink[]; onChanged: () => Promise<void> }) {
  const live = !!release.released_at
  const blank = () => [{ store: '', url: '' }]
  const [rows, setRows] = useState<ReleaseLink[]>(links.length ? links : blank())
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const setRow = (i: number, patch: Partial<ReleaseLink>) => setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const open = () => { setRows(links.length ? links : blank()); setErr(''); setEditing(true) }

  async function save() {
    setBusy(true); setErr('')
    try {
      await api(`/releases/${release.id}/released`, 'PUT', { links: rows.filter((l) => l.store.trim() || l.url.trim()) })
      setEditing(false)
      await onChanged()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  async function unmark() {
    if (!window.confirm('Mark this release as not released? Your store links are kept.')) return
    setBusy(true); setErr('')
    try { await api(`/releases/${release.id}/released`, 'DELETE'); await onChanged() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const form = (
    <div className="stack">
      <Hint>Once the release is live, paste its link from each store's share menu. At least one is needed.</Hint>
      <datalist id="store-names">{STORES.map((s) => <option key={s} value={s} />)}</datalist>
      {rows.map((l, i) => (
        <div className="store-row" key={i}>
          <input list="store-names" placeholder="Store" value={l.store} onChange={(e) => setRow(i, { store: e.target.value })} />
          <input type="url" placeholder="https://…" value={l.url} onChange={(e) => setRow(i, { url: e.target.value })} />
          <button type="button" className="ghost" disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <div className="row">
        <button type="button" className="ghost" onClick={() => setRows([...rows, { store: '', url: '' }])}>+ Add another store</button>
      </div>
      {err && <ErrorBox error={err} />}
      <div className="row actions">
        <button disabled={busy} onClick={save}>{busy ? 'Saving…' : live ? 'Save links' : 'Mark as released'}</button>
        {live && <button className="ghost" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>}
      </div>
    </div>
  )

  return (
    <Collapsible title={live ? 'Released' : 'Mark as released'}>
      {live && !editing ? (
        <div className="stack">
          <span className="muted">Marked released {fmtDate(release.released_at)}. This release is locked.</span>
          <ul className="store-links">
            {links.map((l) => <li key={l.url}>{l.store}: <a href={l.url} target="_blank" rel="noopener noreferrer">{l.url}</a></li>)}
          </ul>
          {err && <ErrorBox error={err} />}
          <div className="row actions">
            <button className="secondary" disabled={busy} onClick={open}>Edit links</button>
            <button className="ghost" disabled={busy} onClick={unmark}>Mark as not released</button>
          </div>
        </div>
      ) : form}
    </Collapsible>
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
            <span>{c.message}{c.acknowledged && <small className="muted"> (acknowledged)</small>}</span>
            {c.level !== 'info' && !c.acknowledged && <Link to={c.fix}>Open</Link>}
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
  const [tracks, setTracks] = useState<Track[]>([])
  const [err, setErr] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [busy, setBusy] = useState(false)
  const { user } = useAuth()
  const [notices, setNotices] = useState<Notice[]>([])
  const [people, setPeople] = useState<Collaborator[]>([])
  const [sent, setSent] = useState<SendResult[] | null>(null)
  const [problems, setProblems] = useState<string[] | undefined>()
  const [ack, setAck] = useState<string[] | null>(null)
  const [checks, setChecks] = useState<ReadinessCheck[] | null>(null)
  const [links, setLinks] = useState<ReleaseLink[]>([])

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
  if (!r) return <Loading />

  // One endpoint returns the whole release as clean metadata (no internal ids, no co-writer emails).
  async function exportMetadata() {
    if (!r) return
    setBusy(true); setActionErr('')
    try {
      downloadJson(`${r.title}.json`, await api<ReleaseExport>(`/releases/${r.id}/export`))
    } catch (e) { setActionErr((e as Error).message) } finally { setBusy(false) }
  }

  async function sendInvitations() {
    if (!r) return
    setBusy(true); setActionErr(''); setSent(null)
    try {
      const res = await api<{ results: SendResult[] }>(`/releases/${r.id}/notices/send`, 'POST')
      setSent(res.results)
      await load()
    } catch (e) { setActionErr((e as Error).message) } finally { setBusy(false) }
  }

  async function remind(noticeId: string) {
    if (!r) return
    setBusy(true); setActionErr('')
    try {
      await api(`/releases/${r.id}/notices/${noticeId}/remind`, 'POST')
      await load()
    } catch (e) { setActionErr((e as Error).message) } finally { setBusy(false) }
  }

  async function markReady() {
    if (!r) return
    setBusy(true); setActionErr(''); setProblems(undefined)
    try {
      const res = await tryMarkReady(r.id)
      if (res.ok) await load()
      else if (res.unconfirmed) setAck(res.unconfirmed)
      else { setActionErr(res.error); setProblems(res.problems) }
    } catch (e) { setActionErr((e as Error).message) } finally { setBusy(false) }
  }

  async function confirmAck() {
    if (!r) return
    setBusy(true)
    try {
      await acknowledgeUnconfirmed(r.id)
      const res = await tryMarkReady(r.id)
      setAck(null)
      if (res.ok) await load()
      else { setActionErr(res.error); setProblems(res.problems) }
    } catch (e) { setAck(null); setActionErr((e as Error).message) } finally { setBusy(false) }
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

  const trackTitle = (tid: string) => tracks.find((t) => t.id === tid)?.title ?? 'Song'
  const rows: Row[] = [
    ...notices.map((n): Row => ({
      key: n.id, trackId: n.track_id, noticeId: n.id,
      name: n.co_writer_name ?? (n.status === 'removed' ? 'Removed by writer' : 'Email removed'),
      email: n.email, role: n.role, share: Number(n.share_percent), status: n.status, note: n.note,
      expiresAt: n.expires_at,
      canRemind: n.status === 'pending' && !n.reminder_sent_at && !!n.email && new Date(n.expires_at) > new Date(),
    })),
    // People with an email but no notice yet (the owner's own email never gets one)
    ...people.filter((c) => c.invited_email && !c.removed_by_writer && c.invited_email !== user?.email
      && !notices.some((n) => n.track_id === c.track_id && n.email?.toLowerCase() === c.invited_email!.toLowerCase()))
      .map((c): Row => ({
        key: c.id, trackId: c.track_id, name: c.legal_name, email: c.invited_email, role: c.role,
        share: Number(c.ownership_percent), status: 'not_sent', note: null, canRemind: false,
      })),
  ].sort((a, b) => trackTitle(a.trackId).localeCompare(trackTitle(b.trackId)))
  const removedLines = people.filter((c) => c.removed_by_writer)

  return (
    <div className="stack">
      {ack && <AckModal list={ack} busy={busy} onConfirm={confirmAck} onClose={() => setAck(null)} />}
      <div className="hero">
        <Link to="/discography" className="back">← Back to Discography</Link>
        <h1>{r.title} ({TYPE_LABEL[r.release_type]}) <Badge status={r.released_at ? 'released' : r.status} /></h1>
        <div className="sub">Artist: {r.album_artist}</div>
        <div className="sub">Set to release: {r.release_date ? fmtDate(r.release_date) : '—'}</div>
        <div className="row actions">
          <button className="secondary" disabled={busy} onClick={exportMetadata}>Export metadata (JSON)</button>
          {r.status === 'draft' && <Link className="btn secondary" to={`/releases/${r.id}/edit`}>Edit draft</Link>}
          {r.status === 'draft' && <button disabled={busy} onClick={markReady}>Mark ready</button>}
          {r.status === 'ready' && !r.released_at && <button className="secondary" disabled={busy} onClick={revert}>Revert to draft</button>}
          {r.status === 'draft' && <button className="danger" disabled={busy} onClick={remove}>Delete release</button>}
        </div>
      </div>
      {actionErr && <ErrorBox error={actionErr} details={problems} />}

      {r.status === 'draft' && checks && <ReadinessChecklist checks={checks} />}
      {r.status === 'ready' && <ReleasedPanel release={r} links={links} onChanged={load} />}

      <Collapsible title="General info">
       <div className="split">
        <div className="grid2">
        <div><span className="muted">Album artist</span><br />{r.album_artist}</div>
        <div><span className="muted">Genre</span><br />{r.genre || '—'}</div>
        <div><span className="muted">Release date</span><br />{r.release_date ? fmtDate(r.release_date) : '—'}</div>
        <div><span className="muted">UPC</span><br />{r.upc || '—'}</div>
        <div><span className="muted">℗ line</span><br />{r.p_line || '—'}</div>
        <div><span className="muted">© line</span><br />{r.c_line || '—'}</div>
        <div><span className="muted">Label</span><br />{r.label_name || '—'}</div>
        <div><span className="muted">Language</span><br />{r.language || '—'}</div>
        <div><span className="muted">Created</span><br />{fmtDateTime(r.created_at)}</div>
        <div><span className="muted">Marked ready</span><br />{r.ready_at ? fmtDateTime(r.ready_at) : '—'}</div>
        </div>
        <div className="cover-side"><div className="cover"><AuthImage mediaId={r.artwork_id} alt="Cover art" fallback={vinylFallback} /></div></div>
       </div>
      </Collapsible>

      {(rows.length > 0 || removedLines.length > 0) && (
        <Collapsible title="Co-writer confirmations" actions={
          <button className="secondary" disabled={busy} onClick={sendInvitations}>
            {notices.length ? 'Send / update invitations' : 'Send invitations'}
          </button>
        }>
          {r.status === 'draft' && <small className="hint">Co-writers confirm their share from an emailed link, no account needed. You can mark the release ready without them, but you'll be asked to acknowledge it.</small>}
          {sent && <ul>{sent.map((s, i) => <li key={i}>{s.name || s.email}: {SEND_TEXT[s.action] ?? s.action}</li>)}</ul>}
          {removedLines.length > 0 && (
            <p className="warn">{removedLines.map((c) => `${Number(c.ownership_percent)}%`).join(', ')} {removedLines.length === 1 ? 'is' : 'are'} held by a co-writer who removed themselves.
              {r.status === 'draft' ? ' Edit the draft to reassign that share or discard the line before marking ready.' : ''}</p>
          )}
          {rows.map((n) => (
            <div className="notice-row" key={n.key}>
              <div>
                <strong>{n.name}</strong> <span className="muted">· {trackTitle(n.trackId)}</span><br />
                <span className="muted">{n.email ?? 'email deleted'}</span>
                {n.note && n.status === 'disputed' && <><br /><span className="muted">“{n.note}”</span></>}
                {n.status === 'disputed' && <><br /><small className="warn">Agree the correct split with them, change it, then send an updated invitation.</small></>}
              </div>
              <span className="muted">{n.role} · {n.share}%</span>
              <span className="muted">{n.status === 'pending' && n.expiresAt ? `expires ${fmtDate(n.expiresAt)}` : ''}</span>
              <Badge status={n.status} />
              {n.canRemind && n.noticeId
                ? <button className="ghost" disabled={busy} onClick={() => remind(n.noticeId!)}>Remind</button>
                : <span />}
            </div>
          ))}
        </Collapsible>
      )}

      <Collapsible title={r.release_type === 'single' ? 'Song' : 'Tracklist'} level="h2" className="">
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
      </Collapsible>
    </div>
  )
}
