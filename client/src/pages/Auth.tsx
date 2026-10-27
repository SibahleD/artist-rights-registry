import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { ErrorBox } from '../components/ui'
import PasswordInput from '../components/PasswordInput'
import AuthShell from '../components/AuthShell'

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [f, setF] = useState({ email: params.get('email') ?? '', password: '', artistName: '', legalName: '', acceptedTerms: false })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr('')
    if (mode === 'register' && !f.acceptedTerms) { setErr('Please accept the Terms and Conditions to create your account.'); return }
    setBusy(true)
    try {
      if (mode === 'login') await login(f.email, f.password); else await register(f)
      nav('/')
    } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  const footer = mode === 'login'
    ? <>Don't have an account? <Link to="/register">Create account</Link></>
    : <>Already registered? <Link to="/login">Log in</Link></>

  return (
    <AuthShell footer={footer}>
      <form onSubmit={submit}>
        <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        {err && <ErrorBox error={err} />}
        {mode === 'register' && <>
          <label>Artist name<input required value={f.artistName} onChange={(e) => setF({ ...f, artistName: e.target.value })} /></label>
          <label>Legal name<input value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} placeholder="Used for royalty splits" /></label>
          <label>Email<input type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <label>Password<PasswordInput required minLength={8} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
          <label className="consent">
            <input type="checkbox" required checked={f.acceptedTerms} onChange={(e) => setF({ ...f, acceptedTerms: e.target.checked })} />
            <span>I accept the <Link to="/terms" target="_blank" rel="noopener">Terms and Conditions</Link> and have read the <Link to="/privacy" target="_blank" rel="noopener">Privacy statement</Link>.</span>
          </label>
        </>}
        {mode === 'login' && <>
          <label>Email<input type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <label>Password<PasswordInput required autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
          <p className="muted"><Link to="/forgot-password" className="muted">Forgot password?</Link></p>
        </>}
        <button disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Register'}</button>
      </form>
    </AuthShell>
  )
}
