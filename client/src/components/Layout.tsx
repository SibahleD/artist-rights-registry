import { useState } from 'react'
import { api } from '../api'

import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

import homeIco from '../assets/ico/home.svg'
import discogIco from '../assets/ico/discog.svg'
import profileIco from '../assets/ico/user.svg'
import infoIco from '../assets/ico/info.svg'
import settingsIco from '../assets/ico/settings.svg'
import expandIco from '../assets/ico/reduce.svg'
import logoDark from '../assets/logo-dark.png'
import logoMark from '../assets/logo-mark.png'
import moneyIco from '../assets/ico/money.svg'
import chartIco from '../assets/ico/chart.svg'
import { ConfirmModal, Icon } from './ui'
import { AuthImage } from './files'

const links = [
  ['/', 'Home', homeIco], ['/discography', 'Discography', discogIco], ['/metrics', 'Metrics', chartIco], ['/glossary', 'Glossary', infoIco], ['/royalty-rights', 'Royalties', moneyIco],['/profile', 'Artist Profile', profileIco], ['/settings', 'Settings', settingsIco],
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

// Small screens swap the sidebar for a bottom bar: the first few pages as tabs, the rest (and log out) behind "More".
const BOTTOM_PATHS = ['/', '/discography', '/profile', '/royalty-rights']

export default function Layout() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const { pathname } = useLocation()
  // The sheet is open only on the page it was opened on, so it closes by itself after a link is followed.
  const [openAt, setOpenAt] = useState<string | null>(null)
  const sheetOpen = openAt === pathname
  const closeSheet = () => setOpenAt(null)
  const tabs = BOTTOM_PATHS.map((p) => links.find(([to]) => to === p)!)
  const rest = links.filter(([to]) => !BOTTOM_PATHS.includes(to))
  const [askLogout, setAskLogout] = useState(false)
  const signOut = () => { setAskLogout(false); logout(); nav('/login') }
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sb-brand">
            <Link to="/" className="sb-mark" aria-label="Track Record home" title="Track Record home"><img src={logoMark} alt="" /></Link>
            <Link to="/profile" className="sb-user" title="Artist Profile">
              <span className="sb-avatar"><AuthImage mediaId={user?.avatar_id} alt="" fallback={<img className="nav-icon" src={profileIco} alt="" />} /></span>
              <span className="sb-name">{user?.username || user?.artist_name}</span>
            </Link>
          </div>
          <button className="expand" aria-label="Collapse menu" onClick={() => document.body.classList.toggle('sidebar-collapsed')}><img className='nav-icon' src={expandIco} alt="" /></button>
        </div>
        <nav>
          {links.map(([to, label, icon]) => <NavLink key={to} to={to} end={to === '/'}><img className="nav-icon" src={icon} alt="" />{label}</NavLink>)}
          <button className="linklike" aria-label="Log out" title="Log out" onClick={() => setAskLogout(true)}><Icon name="logout" size={20} />Log out</button>
        </nav>
      </aside>

      <header className="mobile-top">
        <img className="brand-logo" src={logoDark} alt="Track Record" />
        <small>{user?.artist_name}</small>
      </header>

      <main className="content"><VerifyBanner /><Outlet /></main>

      <nav className="bottom-nav" aria-label="Main">
        {tabs.map(([to, label, icon]) => (
          <NavLink key={to} to={to} end={to === '/'}><img className="nav-icon" src={icon} alt="" /><span>{label}</span></NavLink>
        ))}
        <button type="button" className="bn-more" aria-expanded={sheetOpen} aria-haspopup="menu"
          onClick={() => setOpenAt(sheetOpen ? null : pathname)}>
          <Icon name="more" size={22} /><span>More</span>
        </button>
      </nav>

      {sheetOpen && (
        <>
          <div className="bn-backdrop" onClick={closeSheet} />
          <div className="bn-sheet" role="menu" aria-label="More pages">
            {rest.map(([to, label, icon]) => (
              <NavLink key={to} to={to} role="menuitem"><img className="nav-icon" src={icon} alt="" />{label}</NavLink>
            ))}
            <button type="button" className="linklike" role="menuitem" onClick={() => { closeSheet(); setAskLogout(true) }}><Icon name="logout" size={20} />Log out</button>
          </div>
        </>
      )}

      {askLogout && (
        <ConfirmModal title="Log out?" confirmLabel="Log out" onConfirm={signOut} onClose={() => setAskLogout(false)}>
          <p>You will need to sign in again to see your releases and streams.</p>
        </ConfirmModal>
      )}
    </div>
  )
}
