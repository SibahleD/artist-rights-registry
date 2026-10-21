import { useEffect, useState, type FormEvent } from 'react'
import { api, upload } from '../api'
import ImagePicker from '../components/ImagePicker'
import { useUsage } from '../components/files'
import { Collapsible } from '../components/ui'
import { useBackGuard } from '../components/UnsavedGuard'
import { useAuth } from '../auth'
import type { ArtistLink, User } from '../types'
import LinkRows from '../components/LinkRows'
import { isBlankRow, OTHER, rowName, withScheme, type LinkRow } from '../data/services'
import { Hint } from '../components/ui'
import { COUNTRIES, NATIONALITIES } from '../data/options'
import SaveBar from '../components/SaveBar'
import SelectOrOther from '../components/SelectOrOther'

const savedToRow = (l: ArtistLink): LinkRow => ({ id: l.id, service: l.service, label: l.service === OTHER ? l.label : '', kind: l.kind, url: l.url })
// What counts as "changed": blank rows are ignored, and a typed address without https:// is compared as typed.
const linkSnapshot = (rows: LinkRow[]) => JSON.stringify(rows.filter((r) => !isBlankRow(r)).map((r) => [r.id ?? null, r.service, r.service === OTHER ? r.label.trim() : '', r.kind, r.url.trim()]))

export function Profile() {
  const { user, setUser } = useAuth()
  const [f, setF] = useState({
    artistName: user?.artist_name ?? '',
    firstName: user?.first_name ?? '',
    lastName: user?.last_name ?? '',
    contactInfo: user?.contact_info ?? '',
    country: user?.country ?? '',
    nationality: user?.nationality ?? '',
  })
  const [msg, setMsg] = useState('')
  const [baseline, setBaseline] = useState(() => JSON.stringify(f))
  const [linkRows, setLinkRows] = useState<LinkRow[]>([])
  const [savedLinks, setSavedLinks] = useState<ArtistLink[]>([])
  const [linkBase, setLinkBase] = useState(() => linkSnapshot([]))
  const [avatarFile, setAvatarFile] = useState<File | undefined>()
  const [avatarCleared, setAvatarCleared] = useState(false)
  const usage = useUsage()

  function applyLinks(list: ArtistLink[]) {
    const rows = list.map(savedToRow)
    setSavedLinks(list); setLinkRows(rows); setLinkBase(linkSnapshot(rows))
  }

  useEffect(() => {
    api<{ user: User; links: ArtistLink[] }>('/users/me').then((r) => applyLinks(r.links)).catch(() => {})
  }, [])

  const dirty = JSON.stringify(f) !== baseline || !!avatarFile || avatarCleared || linkSnapshot(linkRows) !== linkBase
  const { modal: backModal, backButton, goBack } = useBackGuard({ dirty, onSave: () => doSave(), fallback: '/' })

  function save(e: FormEvent) { e.preventDefault(); void doSave() }

  // Brings the server's links in line with the rows on screen: removals first (frees the cap and the address), then edits, then additions.
  async function syncLinks() {
    const rows = linkRows.filter((r) => !isBlankRow(r))
    const keep = new Set(rows.map((r) => r.id).filter(Boolean))
    try {
      for (const l of savedLinks) if (!keep.has(l.id)) await api(`/users/me/links/${l.id}`, 'DELETE')
      for (const r of rows) {
        const body = { service: r.service, label: r.service === OTHER ? r.label.trim() : undefined, kind: r.kind, url: withScheme(r.url) }
        const old = savedLinks.find((l) => l.id === r.id)
        if (!old) await api('/users/me/links', 'POST', body)
        else if (linkSnapshot([savedToRow(old)]) !== linkSnapshot([r])) await api(`/users/me/links/${r.id}`, 'PATCH', body)
      }
    } finally {
      const fresh = await api<{ links: ArtistLink[] }>('/users/me/links').catch(() => null)
      if (fresh) applyLinks(fresh.links)
    }
  }

  async function doSave(): Promise<boolean> {
    setMsg('')
    const bad = linkRows.filter((r) => !isBlankRow(r)).find((r) => !r.service || !r.url.trim() || (r.service === OTHER && !rowName(r)))
    if (bad) {
      setMsg(!bad.service ? 'Choose a service for each link.' : !bad.url.trim() ? 'Add the web address for each link.' : 'Give each "Other" link a name.')
      return false
    }
    try {
      if (avatarFile) await upload('/users/me/avatar', avatarFile)
      else if (avatarCleared && user?.avatar_id) await api('/users/me/avatar', 'DELETE')
      await api<{ user: User }>('/users/me', 'PATCH', f)
      // PATCH does not return the picture id, so reload the profile to pick up the new one.
      const fresh = await api<{ user: User }>('/users/me')
      setUser(fresh.user)
      setAvatarFile(undefined); setAvatarCleared(false)
      setBaseline(JSON.stringify(f))   // what was just saved is the new starting point
      await syncLinks()
      setMsg('Saved.')
      return true
    } catch (x) { setMsg((x as Error).message); return false }
  }

  return (
    <div className="stack">
      {backModal}
      <div className="hero">
        {backButton}
        <h1>Artist Profile</h1>
        <div className="sub">Artist: {user?.artist_name}</div>
      </div>
      <SaveBar dirty={dirty} busy={false} onSave={() => void doSave()} onCancel={goBack} message={msg} />
      <Collapsible title="General Info" level="h2" className="">
      <form className="card stack" onSubmit={save}>
        <h4>Artist Profile</h4>
        <div className="split">
        <div className="stack">
        <label>Artist name<input value={f.artistName} onChange={(e) => setF({ ...f, artistName: e.target.value })} /></label>
        <div className="grid2">
          <label>First name<input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></label>
          <label>Last name<input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></label>
        </div>
        <label>Email<input value={user?.email ?? ''} disabled /></label>
        <label>Contact info
          <input value={f.contactInfo} onChange={(e) => setF({ ...f, contactInfo: e.target.value })} placeholder="name@example.com or +250 7XX XXX XXX" />
          <small className="hint">How people you work with can reach you: an email address or a phone number with country code. One is enough.</small>
        </label>
        <div className="grid2">
          <label>Country
            <select value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}>
              <option value="">Not specified</option>
              {COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              {f.country && !COUNTRIES.some(([c]) => c === f.country) && <option value={f.country}>{f.country}</option>}
            </select>
          </label>
          <SelectOrOther label="Nationality" options={NATIONALITIES} value={f.nationality} onChange={(v) => setF({ ...f, nationality: v })} otherPlaceholder="Type your nationality" />
        </div>
        <small className="hint">Your roles, rights society, IPI and publisher are in Settings → Account → Credit details.</small>
        </div>
        <ImagePicker label="Profile picture" hint="Square JPEG or PNG." shape="round"
          mediaId={avatarCleared ? null : user?.avatar_id} file={avatarFile} maxBytes={usage?.limits.maxAvatarBytes ?? 300 * 1024}
          onPick={(f) => { setAvatarFile(f); setAvatarCleared(false) }}
          onClear={() => { setAvatarFile(undefined); setAvatarCleared(true) }} />
        </div>
      </form>
      </Collapsible>

      <Collapsible title="Links" level="h2" className="">
      <div className="grid2">
        <section className="card stack">
          <h4>Artist Streaming Links</h4>
          <LinkRows rows={linkRows} onChange={setLinkRows} kinds={['streaming']} addLabel="Add streaming link" max={12} />
        </section>
        <section className="card stack">
          <h4>Social Links</h4>
          <LinkRows rows={linkRows} onChange={setLinkRows} kinds={['social']} addLabel="Add social link" max={12} />
        </section>
      </div>
      <Hint>Links are saved with the Save button at the top.</Hint>
      </Collapsible>
    </div>
  )
}
