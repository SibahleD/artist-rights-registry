import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { ErrorBox } from '../components/ui'
import AuthShell from '../components/AuthShell'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await api('/auth/forgot-password', 'POST', { email })
      setSent(true)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      <div className="stack">
        <h1>Reset your password</h1>
        {sent ? (
          <>
            <p>If an account exists for <strong>{email}</strong>, we have sent a link to reset the password. It expires in 1 hour.</p>
            <p className="muted">Nothing arrived? Check your spam folder, or try again in a minute.</p>
            <Link to="/login">Back to log in</Link>
          </>
        ) : (
          <form onSubmit={submit} className="stack">
            <p className="muted">Enter the email you signed up with and we will send you a reset link.</p>
            <ErrorBox error={err} />
            <label>Email<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <button disabled={busy || !email}>{busy ? 'Sending…' : 'Send reset link'}</button>
            <p className="muted"><Link to="/login" className="muted">Back to log in</Link></p>
          </form>
        )}
      </div>
    </AuthShell>
  )
}
