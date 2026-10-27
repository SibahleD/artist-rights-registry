import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import panel from '../assets/login-panel.jpg'

// Set VITE_EXTENSION_URL (e.g. a Chrome Web Store listing) to send "Get the extension" there.
// Without it the link opens the built-in install page at /extension.
const EXTENSION_URL = import.meta.env.VITE_EXTENSION_URL as string | undefined

// Shared frame for every signed-out page: the form on the left, a picture on the right.
// `footer` sits at the bottom of the left panel (for example "Create account").
export default function AuthShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="auth-split">
      <main className="auth-main">
        <Link to="/login" className="auth-brand">Royalty Registry</Link>
        <div className="auth-body">{children}</div>
        <div className="auth-foot">
          <span>{footer}</span>
          {EXTENSION_URL
            ? <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer">Get the extension</a>
            : <Link to="/extension">Get the extension</Link>}
        </div>
      </main>
      <aside className="auth-art" style={{ backgroundImage: `url(${panel})` }} aria-hidden="true">
        <p className="auth-tagline">Your music. Your rights. All in one place.</p>
      </aside>
    </div>
  )
}
