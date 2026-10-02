import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import type { ArtistLink, User } from '../types'

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
  })
  const [msg, setMsg] = useState('')
  const [links, setLinks] = useState<Record<string, string>>({})

  useEffect(() => {
    api<{ user: User; links: ArtistLink[] }>('/users/me')
      .then((r) => setLinks(Object.fromEntries(r.links.map((l) => [l.platform, l.url]))))
      .catch(() => {})
  }, [])

  async function save(e: FormEvent) {
    e.preventDefault()
    setMsg('')
    try {
      const r = await api<{ user: User }>('/users/me', 'PATCH', f)
      setUser(r.user)
      setMsg('Saved.')
    } catch (x) { setMsg((x as Error).message) }
  }

  return (
    <div className="stack">
      <div className="hero">
        <h1>Artist Profile</h1>
        <div className="sub">Artist: {user?.artist_name}</div>
      </div>

      <h2>General Info</h2>
      <form className="card stack" onSubmit={save}>
        <h4>Artist Profile</h4>
        <label>Artist name<input value={f.artistName} onChange={(e) => setF({ ...f, artistName: e.target.value })} /></label>
        <div className="grid2">
          <label>First name<input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></label>
          <label>Last name<input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></label>
        </div>
        <label>Email<input value={user?.email ?? ''} disabled /></label>
        <label>Contact info<input value={f.contactInfo} onChange={(e) => setF({ ...f, contactInfo: e.target.value })} /></label>
        <div className="row actions"><button>Save</button><span className="muted">{msg}</span></div>
      </form>

      <h2>Links</h2>
      <div className="grid2">
        <LinksCard title="Artist Streaming Links" platforms={STREAMING} saved={links} onSaved={setLinks} />
        <LinksCard title="Social Links" platforms={SOCIAL} saved={links} onSaved={setLinks} />
      </div>
    </div>
  )
}
