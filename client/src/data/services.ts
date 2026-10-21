export type LinkKind = 'streaming' | 'social' | 'store' | 'other'

export interface Service {
  id: string
  label: string
  kind: LinkKind
  dashboardUrl?: string
  dashboardLabel?: string
}

// Keep the ids in step with server/src/lib/services.js.
export const SERVICES: readonly Service[] = [
  { id: 'spotify', label: 'Spotify', kind: 'streaming', dashboardUrl: 'https://artists.spotify.com', dashboardLabel: 'Spotify for Artists' },
  { id: 'apple_music', label: 'Apple Music', kind: 'streaming', dashboardUrl: 'https://artists.apple.com', dashboardLabel: 'Apple Music for Artists' },
  { id: 'youtube', label: 'YouTube', kind: 'streaming', dashboardUrl: 'https://studio.youtube.com', dashboardLabel: 'YouTube Studio' },
  { id: 'youtube_music', label: 'YouTube Music', kind: 'streaming', dashboardUrl: 'https://studio.youtube.com', dashboardLabel: 'YouTube Studio' },
  { id: 'soundcloud', label: 'SoundCloud', kind: 'streaming' },
  { id: 'deezer', label: 'Deezer', kind: 'streaming', dashboardUrl: 'https://creators.deezer.com', dashboardLabel: 'Deezer for Creators' },
  { id: 'tidal', label: 'Tidal', kind: 'streaming' },
  { id: 'amazon_music', label: 'Amazon Music', kind: 'streaming' },
  { id: 'boomplay', label: 'Boomplay', kind: 'streaming' },
  { id: 'audiomack', label: 'Audiomack', kind: 'streaming' },
  { id: 'instagram', label: 'Instagram', kind: 'social' },
  { id: 'tiktok', label: 'TikTok', kind: 'social' },
  { id: 'x', label: 'X (Twitter)', kind: 'social' },
  { id: 'facebook', label: 'Facebook', kind: 'social' },
  { id: 'bandcamp', label: 'Bandcamp', kind: 'store' },
  { id: 'beatport', label: 'Beatport', kind: 'store' },
  { id: 'itunes', label: 'iTunes Store', kind: 'store' },
]

export const OTHER = 'other'
export const serviceById = (id: string) => SERVICES.find((s) => s.id === id)

// One editable row: a service from the list (or 'other' plus a label) and a URL. `id` is set once the row is saved.
export interface LinkRow { id?: string; service: string; label: string; kind: LinkKind; url: string }

export const blankRow = (kind: LinkKind): LinkRow => ({ service: '', label: '', kind, url: '' })
export const isBlankRow = (r: LinkRow) => !r.service && !r.url.trim() && !r.label.trim()

// The name shown for a row: the list's label, or what the user typed for "Other".
export const rowName = (r: LinkRow) => (r.service === OTHER ? r.label.trim() : serviceById(r.service)?.label ?? '')

export const withScheme = (u: string) => {
  const v = u.trim()
  return !v || /^https?:\/\//i.test(v) ? v : `https://${v}`
}

// Release store links keep only a name and a URL. Match the name to the list when we can; anything else is "Other".
export function storeToRow(l: { store: string; url: string }): LinkRow {
  const name = l.store.trim().toLowerCase()
  const s = SERVICES.find((x) => x.label.toLowerCase() === name)
  return s ? { service: s.id, label: '', kind: s.kind, url: l.url } : { service: OTHER, label: l.store, kind: 'other', url: l.url }
}
export const rowToStore = (r: LinkRow) => ({ store: rowName(r), url: withScheme(r.url) })
