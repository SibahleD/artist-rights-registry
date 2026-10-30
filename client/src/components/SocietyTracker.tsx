import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { COUNTRIES, TRACKABLE, countryNameOf, dashboardOf, websiteOf } from '../data/societies'
import type { SocietyStatus, UserSociety } from '../types'
import { useUnsavedChanges } from './UnsavedGuard'
import { Badge, ConfirmModal, ErrorBox, Hint, Loading, fmtDate } from './ui'
import { safeHref } from '../lib/format'

const STATUS_LABEL: Record<SocietyStatus, string> = { planned: 'Planned', applied: 'Applied', registered: 'Registered' }
const BADGE: Record<SocietyStatus, string> = { planned: 'draft', applied: 'pending', registered: 'confirmed' }
const rank = (s: SocietyStatus) => ({ registered: 0, applied: 1, planned: 2 })[s]
const todayUtc = () => new Date().toISOString().slice(0, 10)
export interface NewSociety { body_name: string; country: string; status?: SocietyStatus }

export function useSocieties() {
  const [list, setList] = useState<UserSociety[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ societies: UserSociety[] }>('/users/me/societies').then((r) => setList(r.societies)).catch((e) => setError(e.message))
  }, [])

  const sort = (l: UserSociety[]) => [...l].sort((a, b) => rank(a.status) - rank(b.status) || a.body_name.localeCompare(b.body_name))

  async function add(input: NewSociety) {
    const r = await api<{ society: UserSociety }>('/users/me/societies', 'POST', input)
    setList((l) => sort([...(l ?? []), r.society]))
  }
  async function update(id: string, input: { status: SocietyStatus; registered_on: string | null; member_ref: string | null; dashboard_url: string | null }) {
    const r = await api<{ society: UserSociety }>(`/users/me/societies/${id}`, 'PATCH', input)
    setList((l) => sort((l ?? []).map((s) => (s.id === id ? r.society : s))))
  }
  async function remove(id: string) {
    await api(`/users/me/societies/${id}`, 'DELETE')
    setList((l) => (l ?? []).filter((s) => s.id !== id))
  }
  const tracked = (name: string, country: string) =>
    !!list?.some((s) => s.country === country && s.body_name.toLowerCase() === name.toLowerCase())

  return { list, error, add, update, remove, tracked }
}
export type Societies = ReturnType<typeof useSocieties>

interface Draft { status: SocietyStatus; registered_on: string; member_ref: string; dashboard_url: string }
const draftOf = (s: UserSociety): Draft => ({ status: s.status, registered_on: s.registered_on ?? '', member_ref: s.member_ref ?? '', dashboard_url: s.dashboard_url ?? '' })

function SocietyRow({ s, api: soc, editing, draft, setEditing, setDraft }: {
  s: UserSociety; api: Societies; editing: boolean; draft: Draft | null
  setEditing: (id: string | null) => void; setDraft: (d: Draft | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const site = safeHref(websiteOf(s.body_name, s.country))
  const dashboard = safeHref(s.dashboard_url) ?? safeHref(dashboardOf(s.body_name, s.country))

  async function save() {
    if (!draft) return
    setBusy(true); setErr('')
    try {
      await soc.update(s.id, {
        status: draft.status,
        registered_on: draft.status === 'registered' && draft.registered_on ? draft.registered_on : null,
        member_ref: draft.member_ref.trim() || null,
        dashboard_url: draft.dashboard_url.trim() || null,
      })
      setEditing(null); setDraft(null)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  async function remove() {
    setBusy(true); setErr('')
    try { await soc.remove(s.id) } catch (e) { setErr((e as Error).message); setConfirmRemove(false) } finally { setBusy(false) }
  }

  return (
    <div className="society-row">
      <div className="row between">
        <div>
          <strong>{s.body_name}</strong> <span className="muted">· {countryNameOf(s.country)}</span>
          {site && <> <a href={site} target="_blank" rel="noopener noreferrer">Website</a></>}
        </div>
        <Badge status={BADGE[s.status]} label={STATUS_LABEL[s.status]} />
      </div>

      {!editing && (
        <>
          <p className="muted society-meta">
            {s.status === 'registered' && s.registered_on ? `Registered ${fmtDate(s.registered_on)}. ` : ''}
            {s.member_ref ? <>Member number: <strong>{s.member_ref}</strong></> : 'No member number saved.'}
          </p>
          <div className="row actions">
            {dashboard && <a className="btn" href={dashboard} target="_blank" rel="noopener noreferrer">Open dashboard</a>}
            <button type="button" className="secondary" onClick={() => { setEditing(s.id); setDraft(draftOf(s)) }}>Update</button>
            <button type="button" className="ghost danger" disabled={busy} onClick={() => setConfirmRemove(true)}>Remove</button>
          </div>
        </>
      )}

      {editing && draft && (
        <div className="stack society-edit">
          <label>Status
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as SocietyStatus })}>
              {(Object.keys(STATUS_LABEL) as SocietyStatus[]).map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
            </select>
          </label>
          {draft.status === 'registered' && (
            <label>Registered on (optional)
              <input type="date" max={todayUtc()} value={draft.registered_on} onChange={(e) => setDraft({ ...draft, registered_on: e.target.value })} />
            </label>
          )}
          <label>Your member number (optional)
            <input value={draft.member_ref} maxLength={100} onChange={(e) => setDraft({ ...draft, member_ref: e.target.value })} />
            <Hint>Only you can see this.</Hint>
          </label>
          <label>Link to your dashboard (optional)
            <input type="text" inputMode="url" autoComplete="off" spellCheck={false} value={draft.dashboard_url} maxLength={500}
              placeholder="https://" onChange={(e) => setDraft({ ...draft, dashboard_url: e.target.value })} />
            <Hint>The page where you log in or see your statements. Only you can see this. We never ask for your password to it.</Hint>
          </label>
          <div className="row actions">
            <button type="button" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" className="ghost" disabled={busy} onClick={() => { setEditing(null); setDraft(null); setErr('') }}>Cancel</button>
          </div>
        </div>
      )}

      {err && <ErrorBox error={err} />}
      {confirmRemove && (
        <ConfirmModal title="Stop tracking this society?" confirmLabel="Remove" danger busy={busy} onConfirm={remove} onClose={() => setConfirmRemove(false)}>
          <p>This only removes it from your list here. It does not change anything with {s.body_name}.</p>
        </ConfirmModal>
      )}
    </div>
  )
}

function AddForm({ api: soc, onDirty }: { api: Societies; onDirty: (dirty: boolean) => void }) {
  const [pick, setPick] = useState('')
  const [otherName, setOtherName] = useState('')
  const [otherCountry, setOtherCountry] = useState('')
  const [status, setStatus] = useState<SocietyStatus>('planned')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { onDirty(!!pick) }, [pick, onDirty])
  useEffect(() => () => onDirty(false), [onDirty])

  const options = useMemo(() => TRACKABLE.filter((t) => !soc.tracked(t.name, t.country)), [soc])
  const groups = useMemo(() => {
    const m = new Map<string, typeof options>()
    for (const t of options) m.set(t.countryName, [...(m.get(t.countryName) ?? []), t])
    return [...m.entries()]
  }, [options])

  async function submit() {
    setBusy(true); setErr('')
    try {
      if (pick === 'other') await soc.add({ body_name: otherName, country: otherCountry, status })
      else {
        const [country, ...rest] = pick.split('|')
        await soc.add({ body_name: rest.join('|'), country, status })
      }
      setPick(''); setOtherName(''); setOtherCountry(''); setStatus('planned')
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const ready = pick && (pick !== 'other' || (otherName.trim() && otherCountry))
  return (
    <div className="stack society-add">
      <h4>Track a society</h4>
      <label>Society
        <select value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Choose a society…</option>
          {groups.map(([name, items]) => (
            <optgroup key={name} label={name}>
              {items.map((t) => <option key={`${t.country}|${t.name}`} value={`${t.country}|${t.name}`}>{t.name}</option>)}
            </optgroup>
          ))}
          <option value="other">Another society…</option>
        </select>
      </label>
      {pick === 'other' && (
        <>
          <label>Name of the society<input value={otherName} maxLength={120} onChange={(e) => setOtherName(e.target.value)} /></label>
          <label>Country
            <select value={otherCountry} onChange={(e) => setOtherCountry(e.target.value)}>
              <option value="">Choose a country…</option>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              <option value="INT">International</option>
            </select>
          </label>
        </>
      )}
      {pick && (
        <label>Where are you with it?
          <select value={status} onChange={(e) => setStatus(e.target.value as SocietyStatus)}>
            {(Object.keys(STATUS_LABEL) as SocietyStatus[]).map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
          </select>
        </label>
      )}
      {err && <ErrorBox error={err} />}
      <div className="row actions"><button type="button" disabled={!ready || busy} onClick={submit}>{busy ? 'Adding…' : 'Add to my list'}</button></div>
    </div>
  )
}

export default function SocietyTracker({ societies: soc, onBrowse }: { societies: Societies; onBrowse?: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [addDirty, setAddDirty] = useState(false)

  const editingRow = soc.list?.find((s) => s.id === editingId)
  const editDirty = !!(editingRow && draft && JSON.stringify(draft) !== JSON.stringify(draftOf(editingRow)))
  const { modal } = useUnsavedChanges({ dirty: editDirty || addDirty })

  if (soc.error && !soc.list) return <ErrorBox error={soc.error} />
  if (!soc.list) return <Loading what="Loading your registrations" variant="list" />

  return (
    <section className="card stack">
      <h3>My registrations</h3>
      <p className="muted">Keep track of the societies you plan to join, have applied to, or are registered with. This list is private to you, and it is not sent to any society.</p>
      {soc.list.length === 0 && (
        <div className="society-empty stack">
          <p>You are not tracking any society yet. Add one below{onBrowse ? ', or see which societies apply in your country.' : ', or use “Track this body” in the guide.'}</p>
          {onBrowse && <p><button type="button" className="secondary" onClick={onBrowse}>Find my society</button></p>}
        </div>
      )}
      {soc.list.map((s) => (
        <SocietyRow key={s.id} s={s} api={soc} editing={editingId === s.id} draft={editingId === s.id ? draft : null}
          setEditing={setEditingId} setDraft={setDraft} />
      ))}
      <AddForm api={soc} onDirty={setAddDirty} />
      {modal}
    </section>
  )
}
