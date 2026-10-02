import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import type { Release, SharedTrack } from '../types'

export default function Home() {
  const { user } = useAuth()
  const [releases, setReleases] = useState<Release[] | null>(null)
  const [shared, setShared] = useState<SharedTrack[] | null>(null)

  useEffect(() => {
    api<{ releases: Release[] }>('/releases').then((r) => setReleases(r.releases)).catch(() => {})
    api<{ tracks: SharedTrack[] }>('/shared-tracks').then((r) => setShared(r.tracks)).catch(() => {})
  }, [])

  const ready = releases?.filter((r) => r.status === 'ready').length
  const drafts = releases?.filter((r) => r.status === 'draft').length

  return (
    <div className="stack">
      <h1>Welcome, {user?.artist_name}</h1>
      <div className="stats">
        <Link to="/discography" className="option stat"><b>{ready ?? ''}</b>Ready releases</Link>
        <Link to="/discography" className="option stat"><b>{shared?.length ?? ''}</b>Collaborations</Link>
        <Link to="/discography" className="option stat"><b>{drafts ?? ''}</b>Drafts</Link>
      </div>
      <div className="row">
        <Link className="btn" to="/new/song">+ New Song Listing</Link>
        <Link className="btn secondary" to="/new/album">+ New Album / EP</Link>
      </div>
    </div>
  )
}
