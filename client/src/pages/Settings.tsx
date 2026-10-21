import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, fetchBlob, setToken } from '../api'
import { useAuth } from '../auth'
import { Collapsible, ErrorBox, Hint } from '../components/ui'
import { DirtyProvider, useReportDirty } from '../components/UnsavedGuard'
import TagPicker from '../components/TagPicker'
import { COLLABORATOR_ROLES, DEFAULT_PREFERENCES } from '../types'
import type { CollaboratorRole, Preferences, Theme, User } from '../types'
import { COUNTRIES as SOCIETY_COUNTRIES } from '../data/societies'

type Note = { ok: boolean; text: string } | null
const Msg = ({ n }: { n: Note }) => (n ? <span className="muted" style={n.ok ? undefined : { color: 'var(--danger)' }} role="status">{n.text}</span> : null)

function useSection() {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note>(null)
  async function run(fn: () => Promise<string | void>) {
    setBusy(true); setNote(null)
    try { const t = await fn(); setNote({ ok: true, text: t || 'Saved.' }) }
    catch (e) { setNote({ ok: false, text: (e as Error).message }) }
    finally { setBusy(false) }
  }
  return { busy, note, run }
}

function SignInCard() {
  const { user, setUser, refresh } = useAuth()
  const un = useSection(), em = useSection(), pw = useSection()
  const [username, setUsername] = useState(user?.username ?? '')
  const [newEmail, setNewEmail] = useState('')
  const [emailPw, setEmailPw] = useState('')
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  useReportDirty('username', username.trim() !== (user?.username ?? ''))

  const saveUsername = (e: FormEvent) => { e.preventDefault(); void un.run(async () => {
    const r = await api<{ user: User }>('/users/me', 'PATCH', { username: username.trim() })
    setUser({ ...user!, ...r.user })
  }) }

  const changeEmail = (e: FormEvent) => { e.preventDefault(); void em.run(async () => {
    await api('/users/me/email', 'POST', { email: newEmail, password: emailPw })
    setEmailPw(''); setNewEmail(''); await refresh()
    return 'Check the new address for a confirmation link. Your old email keeps working until you use it.'
  }) }

  const cancelEmail = () => void em.run(async () => { await api('/users/me/email', 'DELETE'); await refresh(); return 'Change cancelled.' })

  const changePw = (e: FormEvent) => { e.preventDefault(); void pw.run(async () => {
    if (next !== again) throw new Error('The two new passwords do not match.')
    const r = await api<{ token: string }>('/users/me/password', 'PATCH', { currentPassword: cur, newPassword: next })
    setToken(r.token)          // older sessions on other devices are signed out; this one continues
    setCur(''); setNext(''); setAgain('')
    return 'Password changed. Other devices have been signed out.'
  }) }

  return (
    <Collapsible title="Sign-in details" level="h2" className="">
      <div className="stack">
        <form className="card stack" onSubmit={saveUsername}>
          <h4>Username</h4>
          <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="letters, numbers, _ and ." /></label>
          <div className="row actions"><button disabled={un.busy}>Save</button><Msg n={un.note} /></div>
        </form>

        <form className="card stack" onSubmit={changeEmail}>
          <h4>Email</h4>
          <p>Signed in as <strong>{user?.email}</strong></p>
          {user?.pending_email && (
            <div className="banner">
              <span>Waiting for you to confirm <strong>{user.pending_email}</strong>. Your current email still works.</span>
              <button type="button" className="ghost" disabled={em.busy} onClick={cancelEmail}>Cancel change</button>
            </div>
          )}
          <label>New email<input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="email" /></label>
          <label>Current password<input type="password" value={emailPw} onChange={(e) => setEmailPw(e.target.value)} autoComplete="current-password" /></label>
          <Hint>We email a link to the new address. The change only applies once you open it.</Hint>
          <div className="row actions"><button disabled={em.busy || !newEmail || !emailPw}>Send confirmation</button><Msg n={em.note} /></div>
        </form>

        <form className="card stack" onSubmit={changePw}>
          <h4>Password</h4>
          <label>Current password<input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></label>
          <div className="grid2">
            <label>New password<input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></label>
            <label>Repeat new password<input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" /></label>
          </div>
          <Hint>At least 8 characters.</Hint>
          <div className="row actions"><button disabled={pw.busy || !cur || !next}>Change password</button><Msg n={pw.note} /></div>
        </form>
      </div>
    </Collapsible>
  )
}

function CreditDetailsCard() {
  const { user, setUser } = useAuth()
  const s = useSection()
  const [f, setF] = useState({
    societyName: user?.society_name ?? '',
    ipi: user?.ipi ?? '',
    publisherName: user?.publisher_name ?? '',
    roles: (user?.roles ?? []) as CollaboratorRole[],
  })
  const saved = {
    societyName: user?.society_name ?? '', ipi: user?.ipi ?? '', publisherName: user?.publisher_name ?? '',
    roles: (user?.roles ?? []) as CollaboratorRole[],
  }
  useReportDirty('credit-details', JSON.stringify(f) !== JSON.stringify(saved))
  const submit = (e: FormEvent) => { e.preventDefault(); void s.run(async () => {
    const r = await api<{ user: User }>('/users/me', 'PATCH', f)
    setUser({ ...user!, ...r.user })
  }) }
  return (
    <Collapsible title="Credit details" level="h2" className="">
      <form className="card stack" onSubmit={submit}>
        <Hint>Used to pre-fill your credits on new songs. Your public artist details stay on the Artist Profile page.</Hint>
        <div className="stack">
          <strong>What you do</strong>
          <TagPicker label="What you do" options={COLLABORATOR_ROLES.filter((r) => r !== 'other')} value={f.roles}
            onChange={(roles) => setF({ ...f, roles })} />
        </div>
        <div className="grid2">
          <label>Rights society (if you belong to one)
            <input list="society-names" value={f.societyName} onChange={(e) => setF({ ...f, societyName: e.target.value })} placeholder="Leave blank if none" />
            <datalist id="society-names">
              {[...new Set(SOCIETY_COUNTRIES.flatMap((c) => c.bodies.map((b) => b.name)))].map((n) => <option key={n} value={n} />)}
            </datalist>
          </label>
          <label>Your IPI number (optional)<input inputMode="numeric" value={f.ipi} onChange={(e) => setF({ ...f, ipi: e.target.value })} placeholder="9 to 11 digits" /></label>
          <label>Publisher (optional)<input value={f.publisherName} onChange={(e) => setF({ ...f, publisherName: e.target.value })} placeholder="Publishing company, if any" /></label>
        </div>
        <div className="row actions"><button disabled={s.busy}>Save</button><Msg n={s.note} /></div>
      </form>
    </Collapsible>
  )
}

function PrivacyCard() {
  const s = useSection()
  const download = () => void s.run(async () => {
    const blob = await fetchBlob('/users/me/export')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'my-registry-data.json'; a.click()
    URL.revokeObjectURL(url)
    return 'Downloaded.'
  })
  return (
    <Collapsible title="Security and privacy" level="h2" className="">
      <section className="card stack">
        <h4>What is stored</h4>
        <ul>
          <li>Your account: email, a scrambled (hashed) password, artist name, and the profile details you fill in.</li>
          <li>Your releases, songs, credits and splits, plus the audio and cover files you upload.</li>
          <li>Co-writer notices you send, and their status.</li>
        </ul>
        <h4>What others can see</h4>
        <ul>
          <li>Co-writers you credit see the song title, their own credit and the split you entered, through their notice link or their account.</li>
          <li>Nobody else can see your releases or files. Nothing is submitted to any society, store or distributor.</li>
        </ul>
        <div className="row actions">
          <button type="button" className="ghost" disabled={s.busy} onClick={download}>Download my data (JSON)</button>
          <Msg n={s.note} />
        </div>
        <Hint>The file has your profile, links, releases with credits, and notices. Audio, images and co-writer email addresses are not included.</Hint>
      </section>
    </Collapsible>
  )
}

function DeleteCard() {
  const { logout } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [sure, setSure] = useState(false)
  const [err, setErr] = useState<{ message: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null)
    try {
      await api('/users/me/delete', 'POST', { password: pw })
      logout(); nav('/login')
    } catch (x) { setErr({ message: (x as Error).message }) }
    finally { setBusy(false) }
  }

  return (
    <Collapsible title="Delete account" level="h2" className="" defaultOpen={false}>
      <section className="card stack">
        <p>This permanently removes your profile, links, draft releases and uploaded files, and signs you out everywhere. It cannot be undone.</p>
        <ul>
          <li>Releases marked ready or released must be moved back to draft and deleted first.</li>
          <li>Where you are credited on someone else's song, the name they typed stays, but it is no longer linked to you.</li>
          <li>Download your data first if you want a copy.</li>
        </ul>
        {!open ? (
          <div className="row actions"><button type="button" className="ghost danger" onClick={() => setOpen(true)}>I want to delete my account</button></div>
        ) : (
          <form className="stack" onSubmit={submit}>
            {err && <ErrorBox error={err.message} />}
            <label>Your password<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></label>
            <label className="check"><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} /> I understand this cannot be undone</label>
            <div className="row actions">
              <button className="danger" disabled={busy || !pw || !sure}>Delete my account</button>
              <button type="button" className="ghost" onClick={() => { setOpen(false); setPw(''); setSure(false); setErr(null) }}>Keep my account</button>
            </div>
          </form>
        )}
      </section>
    </Collapsible>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check stack">
      <span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}</span>
      {hint && <Hint>{hint}</Hint>}
    </label>
  )
}

function PreferencesTab() {
  const { user, setUser } = useAuth()
  const s = useSection()
  const prefs: Preferences = { ...DEFAULT_PREFERENCES, ...(user?.preferences ?? {}) }

  // Each change saves straight away; the screen updates first so the theme switches at once.
  const set = (patch: Partial<Preferences>) => {
    const before = user!
    setUser({ ...before, preferences: { ...prefs, ...patch } })
    void s.run(async () => {
      try { await api('/users/me/preferences', 'PATCH', patch) }
      catch (e) { setUser(before); throw e }
    })
  }

  return (
    <div className="stack">
      <section className="card stack">
        <h4>Appearance</h4>
        <label>Theme
          <select value={prefs.theme} onChange={(e) => set({ theme: e.target.value as Theme })}>
            <option value="system">Match my device</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
      </section>

      <section className="card stack">
        <h4>Sharing</h4>
        <Toggle label="Include me in play counts" checked={prefs.play_counts_opt_in} onChange={(v) => set({ play_counts_opt_in: v })}
          hint="Off by default. Takes effect when play counts are added." />
        <Toggle label="Include my activity in platform analytics" checked={prefs.analytics_opt_in} onChange={(v) => set({ analytics_opt_in: v })}
          hint="Off by default. Takes effect when analytics are added." />
      </section>

      <section className="card stack">
        <h4>Email notifications</h4>
        <Toggle label="Split disputes" checked={prefs.notify_disputes} onChange={(v) => set({ notify_disputes: v })} />
        <Toggle label="Approvals from co-writers" checked={prefs.notify_approvals} onChange={(v) => set({ notify_approvals: v })} />
        <Hint>Your choice is saved now and applies once these emails are switched on. Browser notifications are not available yet.</Hint>
      </section>
      <div className="row actions"><Msg n={s.note} /></div>
    </div>
  )
}

export default function Settings() {
  const [tab, setTab] = useState<'account' | 'preferences'>('account')
  return (
    <div className="stack">
      <div className="hero"><h1>Settings</h1></div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'account'} className={`tab${tab === 'account' ? ' on' : ''}`} onClick={() => setTab('account')}>Account</button>
        <button role="tab" aria-selected={tab === 'preferences'} className={`tab${tab === 'preferences' ? ' on' : ''}`} onClick={() => setTab('preferences')}>Preferences</button>
      </div>
      <DirtyProvider>
        {tab === 'account' ? (
          <div className="stack"><SignInCard /><CreditDetailsCard /><PrivacyCard /><DeleteCard /></div>
        ) : <PreferencesTab />}
      </DirtyProvider>
    </div>
  )
}
