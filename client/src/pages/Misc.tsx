import { useEffect, useState, type FormEvent } from 'react'
import { api, upload } from '../api'
import ImagePicker from '../components/ImagePicker'
import { useUsage } from '../components/files'
import { useAuth } from '../auth'
import { COLLABORATOR_ROLES } from '../types'
import type { ArtistLink, CollaboratorRole, User } from '../types'
import { COUNTRIES } from '../data/options'
import { COUNTRIES as SOCIETY_COUNTRIES } from '../data/societies'
import backIco from '../assets/ico/chevron-down.svg'

type Platforms = readonly (readonly [string, string])[]

const STREAMING: Platforms = [['spotify', 'Spotify'], ['apple_music', 'Apple Music'], ['soundcloud', 'SoundCloud'], ['youtube', 'YouTube']]
const SOCIAL: Platforms = [['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['x', 'X (Twitter)']]

function LinksCard({ title, platforms, saved, onSaved }: {
  title: string
  platforms: Platforms
  saved: Record<string, string>
  onSaved: (next: Record<string, string>) => void
}) {
  const [vals, setVals] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setVals(Object.fromEntries(platforms.map(([p]) => [p, saved[p] ?? ''])))
  }, [saved, platforms])

  async function save() {
    setBusy(true); setMsg('')
    const next = { ...saved }
    try {
      for (const [p] of platforms) {
        const v = (vals[p] ?? '').trim()
        if (v === (saved[p] ?? '')) continue
        if (!v) {
          await api(`/users/me/links/${p}`, 'DELETE')
          delete next[p]
        } else {
          const url = /^https?:\/\//i.test(v) ? v : `https://${v}`
          const r = await api<{ link: ArtistLink }>(`/users/me/links/${p}`, 'PUT', { url })
          next[p] = r.link.url
        }
      }
      setMsg('Saved.')
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      onSaved(next)
      setBusy(false)
    }
  }

  return (
    <section className="card stack">
      <h4>{title}</h4>
      {platforms.map(([p, label]) => (
        <label key={p}>{label}
          <input value={vals[p] ?? ''} onChange={(e) => setVals({ ...vals, [p]: e.target.value })} placeholder="https://…" />
        </label>
      ))}
      <div className="row actions"><button disabled={busy} onClick={save}>Save</button><span className="muted">{msg}</span></div>
    </section>
  )
}

export function Profile() {
  const { user, setUser } = useAuth()
  const [f, setF] = useState({
    artistName: user?.artist_name ?? '',
    firstName: user?.first_name ?? '',
    lastName: user?.last_name ?? '',
    contactInfo: user?.contact_info ?? '',
    country: user?.country ?? '',
    nationality: user?.nationality ?? '',
    societyName: user?.society_name ?? '',
    ipi: user?.ipi ?? '',
    publisherName: user?.publisher_name ?? '',
    roles: (user?.roles ?? []) as CollaboratorRole[],
  })
  const [msg, setMsg] = useState('')
  const [links, setLinks] = useState<Record<string, string>>({})
  const [avatarFile, setAvatarFile] = useState<File | undefined>()
  const [avatarCleared, setAvatarCleared] = useState(false)
  const usage = useUsage()

  useEffect(() => {
    api<{ user: User; links: ArtistLink[] }>('/users/me')
      .then((r) => setLinks(Object.fromEntries(r.links.map((l) => [l.platform, l.url]))))
      .catch(() => {})
  }, [])

  async function save(e: FormEvent) {
    e.preventDefault()
    setMsg('')
    try {
      if (avatarFile) await upload('/users/me/avatar', avatarFile)
      else if (avatarCleared && user?.avatar_id) await api('/users/me/avatar', 'DELETE')
      await api<{ user: User }>('/users/me', 'PATCH', f)
      // PATCH does not return the picture id, so reload the profile to pick up the new one.
      const fresh = await api<{ user: User }>('/users/me')
      setUser(fresh.user)
      setAvatarFile(undefined); setAvatarCleared(false)
      setMsg('Saved.')
    } catch (x) { setMsg((x as Error).message) }
  }

  return (
    <div className="stack">
      <div className="hero">
        <h1>Artist Profile</h1>
        <div className="sub">Artist: {user?.artist_name}</div>
      </div>
      <div className="row section-title">
        <img className="collapse-icon" src={backIco}/>
        <h2>General Info</h2>
      </div>
      <form className="card stack" onSubmit={save}>
        <h4>Artist Profile</h4>
        <ImagePicker label="Profile picture" hint="Square JPEG or PNG." shape="round"
          mediaId={avatarCleared ? null : user?.avatar_id} file={avatarFile} maxBytes={usage?.limits.maxAvatarBytes ?? 300 * 1024}
          onPick={(f) => { setAvatarFile(f); setAvatarCleared(false) }}
          onClear={() => { setAvatarFile(undefined); setAvatarCleared(true) }} />
        <label>Artist name<input value={f.artistName} onChange={(e) => setF({ ...f, artistName: e.target.value })} /></label>
        <div className="grid2">
          <label>First name<input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></label>
          <label>Last name<input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></label>
        </div>
        <label>Email<input value={user?.email ?? ''} disabled /></label>
        <label>Contact info<input value={f.contactInfo} onChange={(e) => setF({ ...f, contactInfo: e.target.value })} /></label>
        <div className="grid2">
          <label>Country
            <select value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}>
              <option value="">Not specified</option>
              {COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              {f.country && !COUNTRIES.some(([c]) => c === f.country) && <option value={f.country}>{f.country}</option>}
            </select>
          </label>
          <label>Nationality<input value={f.nationality} onChange={(e) => setF({ ...f, nationality: e.target.value })} /></label>
          <label>Rights society (if you belong to one)
            <input list="society-names" value={f.societyName} onChange={(e) => setF({ ...f, societyName: e.target.value })} placeholder="Leave blank if none" />
            <datalist id="society-names">
              {[...new Set(SOCIETY_COUNTRIES.flatMap((c) => c.bodies.map((b) => b.name)))].map((n) => <option key={n} value={n} />)}
            </datalist>
          </label>
          <label>Your IPI number (optional)<input inputMode="numeric" value={f.ipi} onChange={(e) => setF({ ...f, ipi: e.target.value })} placeholder="9 to 11 digits" /></label>
          <label>Publisher (optional)<input value={f.publisherName} onChange={(e) => setF({ ...f, publisherName: e.target.value })} placeholder="Publishing company, if any" /></label>
        </div>
        <fieldset>
          <legend>What you do</legend>
          <div className="row">
            {COLLABORATOR_ROLES.filter((r) => r !== 'other').map((r) => (
              <label key={r} className="row">
                <input type="checkbox" checked={f.roles.includes(r)}
                  onChange={(e) => setF({ ...f, roles: e.target.checked ? [...f.roles, r] : f.roles.filter((x) => x !== r) })} /> {r}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="row actions"><button>Save</button><span className="muted">{msg}</span></div>
      </form>
      
      <div className="row section-title">
        <img className="collapse-icon" src={backIco}/>
        <h2>Links</h2>
      </div>
      <div className="grid2">
        <LinksCard title="Artist Streaming Links" platforms={STREAMING} saved={links} onSaved={setLinks} />
        <LinksCard title="Social Links" platforms={SOCIAL} saved={links} onSaved={setLinks} />
      </div>
    </div>
  )
}
