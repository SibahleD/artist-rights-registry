import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { ErrorBox } from '../components/ui'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const { user, refresh } = useAuth()
  const ran = useRef(false)
  const [state, setState] = useState<'working' | 'done' | 'error'>('working')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const token = params.get('token')
    if (!token) { setState('error'); setMsg('This link is missing its token.'); return }
    api('/auth/verify-email', 'POST', { token })
      .then(() => { setState('done'); if (user) refresh().catch(() => {}) })
      .catch((e) => { setState('error'); setMsg((e as Error).message) })
  }, [])

  return (
    <div className="auth">
      <div className="card">
        <h1>Confirm your email</h1>
        {state === 'working' && <p className="muted">Checking your link…</p>}
        {state === 'done' && <><p>Your email is confirmed.</p><Link to="/">Continue</Link></>}
        {state === 'error' && <>
          <ErrorBox error={msg} />
          <p className="muted">If the link expired, log in and use "Resend email" in the banner.</p>
          <Link to="/login">Log in</Link>
        </>}
      </div>
    </div>
  )
}