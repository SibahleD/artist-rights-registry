import { useState } from 'react'
import { api } from '../api'

import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

import homeIco from '../assets/ico/home.svg'
import discogIco from '../assets/ico/discog.svg'
import profileIco from '../assets/ico/user.svg'
import infoIco from '../assets/ico/info.svg'
import settingsIco from '../assets/ico/settings.svg'
import expandIco from '../assets/ico/reduce.svg'

const links = [
  ['/', 'Home', homeIco], ['/discography', 'Discography', discogIco], ['/info', 'Info', infoIco], ['/profile', 'Artist Profile', profileIco], ['/settings', 'Settings', settingsIco],
]

function VerifyBanner() {
  const { user, refresh } = useAuth()
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  if (!user || user.email_verified_at) return null

  async function resend() {
    setBusy(true); setMsg('')
    try { await api('/auth/resend-verification', 'POST'); setMsg('Verification email sent. Check your inbox.') }
    catch (e) { setMsg((e as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <div className="banner">
      <span>Confirm your email ({user.email}) so songs you're credited on can be linked to your account.</span>
      <button className="ghost" disabled={busy} onClick={resend}>Resend email</button>
      <button className="ghost" onClick={() => refresh()}>I've confirmed</button>
      {msg && <small>{msg}</small>}
    </div>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-header" >
          <div className="brand">Royalty Registry<small>{user?.artist_name}</small></div>
          <button className="expand" onClick={() => document.body.classList.toggle('sidebar-collapsed')}><img className='nav-icon' src={expandIco} /></button>
        </div>
        <nav>
          {links.map(([to, label, icon]) => <NavLink key={to} to={to} end={to === '/'}><img className="nav-icon" src={icon} />{label}</NavLink>)}
          <button className="linklike" onClick={() => { logout(); nav('/login') }}>Log Off</button>
        </nav>
      </aside>
      <main className="content"><VerifyBanner /><Outlet /></main>
    </div>
  )
}
