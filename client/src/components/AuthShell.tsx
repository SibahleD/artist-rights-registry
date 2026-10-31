import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import panel from '../assets/login-panel.jpg'
import logo from '../assets/logo.png'

// Shared frame for every signed-out page: the form on the left, a picture on the right.
// `footer` sits at the bottom of the left panel (for example "Create account").
export default function AuthShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="auth-split">
      <main className="auth-main">
        <Link to="/login" className="auth-brand"><img src={logo} alt="Track Record" /></Link>
        <div className="auth-body">{children}</div>
        <div className="auth-foot">
          <span>{footer}</span>
        </div>
      </main>
      <aside className="auth-art" style={{ backgroundImage: `url(${panel})` }} aria-hidden="true">
        <p className="auth-tagline">Your music. Your rights. All in one place.</p>
      </aside>
    </div>
  )
}
