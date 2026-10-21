import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { buildRows, SEND_TEXT, type SendResult } from '../lib/splitRows'
import { Badge, Collapsible, ErrorBox, fmtDate, Loading } from '../components/ui'
import type { Collaborator, Notice, Release, Track } from '../types'

// Everything about agreeing the splits for one release, so the track editor can stay about entering data.
export default function Splits() {
  const { id } = useParams()
  const { user } = useAuth()
  const [r, setR] = useState<Release | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [people, setPeople] = useState<Collaborator[]>([])
  const [sent, setSent] = useState<SendResult[] | null>(null)
  const [err, setErr] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const x = await api<{ release: Release; tracks: Track[] }>(`/releases/${id}`)
    setR(x.release); setTracks(x.tracks)
    const [n, c] = await Promise.all([
      api<{ notices: Notice[] }>(`/releases/${id}/notices`),
      Promise.all(x.tracks.map((t) => api<{ collaborators: Collaborator[] }>(`/releases/${id}/tracks/${t.id}/collaborators`))),
    ])
    setNotices(n.notices); setPeople(c.flatMap((z) => z.collaborators))
  }

  useEffect(() => { load().catch((e) => setErr(e.message)) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <ErrorBox error={err} />
  if (!r) return <Loading />

  async function act(fn: () => Promise<void>) {
    setBusy(true); setActionErr('')
    try { await fn(); await load() } catch (e) { setActionErr((e as Error).message) } finally { setBusy(false) }
  }
  const sendInvitations = () => act(async () => {
    setSent(null)
    const res = await api<{ results: SendResult[] }>(`/releases/${r.id}/notices/send`, 'POST')
    setSent(res.results)
  })
  const remind = (noticeId: string) => act(async () => { await api(`/releases/${r.id}/notices/${noticeId}/remind`, 'POST') })

  const trackTitle = (tid: string) => tracks.find((t) => t.id === tid)?.title ?? 'Song'
  const rows = buildRows(notices, people, tracks, user?.email)
  const removedLines = people.filter((c) => c.removed_by_writer)

  return (
    <div className="stack">
      <div className="hero">
        <Link to={`/releases/${r.id}`} className="back">← Back to {r.title}</Link>
        <h1>Splits <Badge status={r.released_at ? 'released' : r.status} /></h1>
        <div className="sub">{r.title} · {r.album_artist}</div>
      </div>
      {actionErr && <ErrorBox error={actionErr} />}

      <Collapsible title="Awaiting approval" actions={
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
        {rows.length === 0 && <p className="muted">No co-writers with an email on this release yet. Add their emails in the track editor to invite them.</p>}
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
    </div>
  )
}
