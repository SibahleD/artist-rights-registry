import { useEffect, useState } from 'react'
import Hero, { BackLink } from '../components/Hero'
import Chevron from '../components/Chevron'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { buildRows, SEND_TEXT, type SendResult } from '../lib/splitRows'
import { Badge, Collapsible, ErrorBox, fmtDate, Hint, Loading } from '../components/ui'
import SaveBar from '../components/SaveBar'
import SplitsEditor from '../components/SplitsEditor'
import { useUnsavedChanges } from '../components/UnsavedGuard'
import { sumPercent, toCollaboratorInput } from '../lib/collab'
import type { Collaborator, CollaboratorInput, Notice, Release, Track } from '../types'

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
  const [drafts, setDrafts] = useState<Record<string, CollaboratorInput[]>>({})   // what is on screen, per song
  const [saved, setSaved] = useState<Record<string, CollaboratorInput[]>>({})     // what the server has, per song
  const [saveMsg, setSaveMsg] = useState('')
  const firstSave = !!(useLocation().state as { first?: boolean } | null)?.first

  // keepDrafts: refresh what the server has without throwing away edits that are not saved yet.
  async function load(keepDrafts = false) {
    const x = await api<{ release: Release; tracks: Track[] }>(`/releases/${id}`)
    setR(x.release); setTracks(x.tracks)
    const [n, c] = await Promise.all([
      api<{ notices: Notice[] }>(`/releases/${id}/notices`),
      Promise.all(x.tracks.map((t) => api<{ collaborators: Collaborator[] }>(`/releases/${id}/tracks/${t.id}/collaborators`))),
    ])
    setNotices(n.notices); setPeople(c.flatMap((z) => z.collaborators))
    const byTrack = Object.fromEntries(x.tracks.map((t, i) => [t.id, c[i].collaborators.map(toCollaboratorInput)]))
    setSaved(byTrack)
    if (!keepDrafts) setDrafts(byTrack)
  }

  const dirty = JSON.stringify(drafts) !== JSON.stringify(saved)

  // One PUT per song that changed. A song that fails keeps what was typed so it can be fixed and saved again.
  async function saveSplits(): Promise<boolean> {
    setBusy(true); setSaveMsg('')
    try {
      for (const t of tracks) {
        if (JSON.stringify(drafts[t.id]) === JSON.stringify(saved[t.id])) continue
        try {
          await api(`/releases/${id}/tracks/${t.id}/collaborators`, 'PUT', { collaborators: drafts[t.id] })
        } catch (e) {
          setSaveMsg(`${t.title || 'Song'}: ${(e as Error).message}`)
          return false
        }
        setSaved((s) => ({ ...s, [t.id]: drafts[t.id] }))
      }
      await load()
      setSaveMsg('Saved.')
      return true
    } catch (e) { setSaveMsg((e as Error).message); return false } finally { setBusy(false) }
  }
  const { modal: guardModal } = useUnsavedChanges({ dirty, onSave: saveSplits })

  useEffect(() => { load().catch((e) => setErr(e.message)) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <ErrorBox error={err} />
  if (!r) return <Loading />

  async function act(fn: () => Promise<void>) {
    setBusy(true); setActionErr('')
    try { await fn(); await load(dirty) } catch (e) { setActionErr((e as Error).message) } finally { setBusy(false) }
  }
  const sendInvitations = () => act(async () => {
    setSent(null)
    const res = await api<{ results: SendResult[] }>(`/releases/${r.id}/notices/send`, 'POST')
    setSent(res.results)
  })
  const remind = (noticeId: string) => act(async () => { await api(`/releases/${r.id}/notices/${noticeId}/remind`, 'POST') })

  const locked = r.status !== 'draft'
  // Invitations go out from what is saved, to credits that have an email other than the owner's own.
  const myEmail = user?.email?.trim().toLowerCase()
  const canInvite = Object.values(saved).flat().some((c) => {
    const email = (c.invitedEmail ?? '').trim().toLowerCase()
    return !c.discard && !c.removedByWriter && !!email && email !== myEmail
  })
  const trackTitle = (tid: string) => tracks.find((t) => t.id === tid)?.title ?? 'Song'
  const rows = buildRows(notices, people, tracks, user?.email)
  const removedLines = people.filter((c) => c.removed_by_writer)

  return (
    <div className="stack">
      <Hero back={<BackLink to={`/releases/${r.id}`}>Back to {r.title}</BackLink>}>
        <h1>Splits <Badge status={r.released_at ? 'released' : r.status} /></h1>
        <div className="sub">{r.title} · {r.album_artist}</div>
        {firstSave && <Link to={`/releases/${r.id}`} className="hero-back">Skip for now<Chevron dir="right" /></Link>}
      </Hero>
      {guardModal}
      {locked
        ? <p className="muted">This release is locked, so the splits can't be edited. Revert it to draft on the release page to change them.</p>
        : <SaveBar dirty={dirty} busy={busy} onSave={() => void saveSplits()} message={saveMsg} />}
      {actionErr && <ErrorBox error={actionErr} />}

      <Collapsible title={<>Royalty splits <small className="muted">(legal names)</small></>}>
        <Hint>Ownership must total exactly 100% for each song, with at most 2 decimals. Add emails for co-writers you want to ask to confirm, then send the invitations below. Once the release is marked ready, splits are locked. Revert it to draft to edit them (not possible after a dispute is raised).</Hint>
        {tracks.map((t) => {
          const total = sumPercent(drafts[t.id] ?? [])
          return (
            <Collapsible key={t.id} level="h4" className="track-splits"
              title={<><strong>{t.track_number}. {t.title || 'Untitled'}</strong> <span className={`total-pill ${total === 100 ? 'ok' : 'bad'}`}>{total}%</span></>}>
              <SplitsEditor collaborators={drafts[t.id] ?? []} disabled={locked}
                onChange={(c) => setDrafts((d) => ({ ...d, [t.id]: c }))} />
            </Collapsible>
          )
        })}
      </Collapsible>

      <Collapsible title="Splits and Credits" actions={canInvite ? (
        <button className="secondary" disabled={busy || dirty} title={dirty ? 'Save your changes first' : undefined} onClick={sendInvitations}>
          {notices.length ? 'Send / update invitations' : 'Send invitations'}
        </button>
      ) : undefined}>
        {canInvite && dirty && <small className="warn">You have unsaved changes. Save them first: invitations go out from what is saved, and sending never saves for you.</small>}
        {r.status === 'draft' && <small className="hint">Co-writers confirm their share from an emailed link, no account needed. A song with more than one credit can't be marked ready until each co-writer with a share has confirmed.</small>}
        {sent && <ul>{sent.map((s, i) => <li key={i}>{s.name || s.email}: {SEND_TEXT[s.action] ?? s.action}</li>)}</ul>}
        {removedLines.length > 0 && (
          <p className="warn">{removedLines.map((c) => `${Number(c.ownership_percent)}%`).join(', ')} {removedLines.length === 1 ? 'is' : 'are'} held by a co-writer who removed themselves.
            {r.status === 'draft' ? ' Discard that line in the splits above before marking ready.' : ''}</p>
        )}
        {rows.length === 0 && <p className="muted">No co-writers with an email on this release yet. Add their emails in the splits above to invite them.</p>}
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
