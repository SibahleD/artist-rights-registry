import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { ErrorBox } from '../components/ui'
import AuthShell from '../components/AuthShell'
import PasswordInput from '../components/PasswordInput'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState(token ? '' : 'This link is missing its token.')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    if (next.length < 8) return setErr('Password must be at least eight (8) characters.')
    if (next !== again) return setErr('The two passwords do not match.')
    setBusy(true)
    try {
      await api('/auth/reset-password', 'POST', { token, newPassword: next })
      setDone(true)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      <div className="stack">
        <h1>Choose a new password</h1>
        {done ? (
          <>
            <p>Your password has been changed. You were signed out on all devices.</p>
            <Link to="/login">Log in</Link>
          </>
        ) : (
          <form onSubmit={submit} className="stack">
            <ErrorBox error={err} />
            {!token ? (
              <p className="muted"><Link to="/forgot-password">Request a new link</Link></p>
            ) : (
              <>
                <label>New password<PasswordInput required minLength={8} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></label>
                <label>Repeat new password<PasswordInput required minLength={8} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} /></label>
                <small className="hint">At least 8 characters.</small>
                <button disabled={busy || !next || !again}>{busy ? 'Saving…' : 'Change password'}</button>
                <p className="muted">Link expired? <Link to="/forgot-password" className="muted">Request a new one</Link></p>
              </>
            )}
          </form>
        )}
      </div>
    </AuthShell>
  )
}
