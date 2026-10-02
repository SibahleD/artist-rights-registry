import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import type { Discography, Dispute } from '../types'

export default function Home() {
  const { user } = useAuth()
  const [d, setD] = useState<Discography | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  useEffect(() => {
    api<Discography>('/discography').then(setD).catch(() => {})
    api<{ unresolved: Dispute[] }>('/disputes').then((r) => setOpen(r.unresolved.length)).catch(() => {})
  }, [])
  return (
    <div className="stack">
      <h1>Welcome, {user?.artistName}</h1>
      <div className="stats">
        <Link to="/discography" className="option stat"><b>{d?.direct.length ?? ''}</b>Registered releases</Link>
        <Link to="/discography" className="option stat"><b>{d?.collaborations.length ?? ''}</b>Collaborations</Link>
        <Link to="/discography" className="option stat"><b>{d?.drafts.length ?? ''}</b>Drafts</Link>
        <Link to="/disputes" className="option stat"><b>{open ?? ''}</b>Open disputes</Link>
      </div>
      <div className="row">
        <Link className="btn" to="/new/song">+ New Song Listing</Link>
        <Link className="btn secondary" to="/new/album">+ New Album / EP</Link>
      </div>
    </div>
  )
}
