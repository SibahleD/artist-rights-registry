import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

import homeIco from '../assets/ico/home.svg'
import discogIco from '../assets/ico/discog.svg'
import cmoIco from '../assets/ico/home.svg'
import disputeIco from '../assets/ico/home.svg'
import profileIco from '../assets/ico/user.svg'
import infoIco from '../assets/ico/info.svg'
import expandIco from '../assets/ico/reduce.svg'

const links = [
  ['/', 'Home', homeIco], ['/discography', 'Discography', discogIco], ['/cmo', 'CMO', cmoIco], ['/disputes', 'Split Disputes', disputeIco], ['/info', 'Info', infoIco], ['/profile', 'Artist Profile', profileIco],
]

export default function Layout() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-header" >
        <div className="brand">Royalty Registry<small>{user?.artistName}</small></div>
        <button className="expand" onClick={() => document.body.classList.toggle('sidebar-collapsed')}><img className='nav-icon' src={expandIco}/></button>
        </div>
        <nav>
          {links.map(([to, label, icon]) => <NavLink key={to} to={to} end={to === '/'}><img className="nav-icon" src={icon}/>{label}</NavLink>)}
          <button className="linklike" onClick={() => { logout(); nav('/login') }}>Log Off</button>
        </nav>
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  )
}
