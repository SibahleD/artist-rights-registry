import { useState } from 'react'
import { api } from '../api'

import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

import homeIco from '../assets/ico/home.svg'
import discogIco from '../assets/ico/discog.svg'
import profileIco from '../assets/ico/user.svg'
import infoIco from '../assets/ico/info.svg'
import settingsIco from '../assets/ico/settings.svg'
import expandIco from '../assets/ico/reduce.svg'
import logoDark from '../assets/logo-dark.png'
import moneyIco from '../assets/ico/money.svg'
import chartIco from '../assets/ico/chart.svg'
import walletIco from '../assets/ico/wallet.svg'
import logoutIco from '../assets/ico/logout.svg'
import moreIco from '../assets/ico/more.svg'

const links = [
  ['/', 'Home', homeIco], ['/discography', 'Discography', discogIco], ['/performance', 'Performance', chartIco], ['/earnings', 'Earnings', walletIco], ['/glossary', 'Glossary', infoIco], ['/royalty-rights', 'Royalties', moneyIco],['/profile', 'Artist Profile', profileIco], ['/settings', 'Settings', settingsIco],
]

// On phones the first four pages sit in a bottom bar; the rest open from "More"
const MAIN = 4

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
  const { pathname } = useLocation()
  const [more, setMore] = useState(false)
  const secondary = links.slice(MAIN)
  const inMore = secondary.some(([to]) => pathname === to || pathname.startsWith(to + '/'))
  const signOut = () => { setMore(false); logout(); nav('/login') }
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-header" >
          <div className="brand"><img className="brand-logo" src={logoDark} alt="Track Record" /><small>{user?.artist_name}</small></div>
          <button className="expand" onClick={() => document.body.classList.toggle('sidebar-collapsed')}><img className='nav-icon' src={expandIco} /></button>
        </div>
        <nav>
          {links.map(([to, label, icon], i) => <NavLink key={to} to={to} end={to === '/'} className={i >= MAIN ? 'nav-secondary' : undefined} onClick={() => setMore(false)}><img className="nav-icon" src={icon} />{label}</NavLink>)}
          <button type="button" className={`more-btn${inMore || more ? ' active' : ''}`} aria-expanded={more} aria-label="More pages" onClick={() => setMore((v) => !v)}><img className="nav-icon" src={moreIco} />More</button>
          <button className="linklike" onClick={signOut}><img className="nav-icon" src={logoutIco} />Log Off</button>
        </nav>
      </aside>
      {more && (
        <>
          <div className="more-scrim" onClick={() => setMore(false)} />
          <div className="more-sheet" role="menu">
            {secondary.map(([to, label, icon]) => <NavLink key={to} to={to} onClick={() => setMore(false)}><img className="nav-icon" src={icon} />{label}</NavLink>)}
            <button className="linklike" onClick={signOut}><img className="nav-icon" src={logoutIco} />Log Off</button>
          </div>
        </>
      )}
      <main className="content"><VerifyBanner /><Outlet /></main>
    </div>
  )
}
