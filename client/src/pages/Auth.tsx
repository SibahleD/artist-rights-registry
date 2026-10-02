import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { ErrorBox } from '../components/ui'

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [f, setF] = useState({ email: params.get('email') ?? '', password: '', artistName: '', legalName: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      if (mode === 'login') await login(f.email, f.password); else await register(f)
      nav('/')
    } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="auth">
      <form className="card" onSubmit={submit}>
        <h1>{mode === 'login' ? 'Welcome Back' : 'Create your account'}</h1>
        {err && <ErrorBox error={err} />}
        {mode === 'register' && <>
          <label>Artist name<input required value={f.artistName} onChange={(e) => setF({ ...f, artistName: e.target.value })} /></label>
          <label>Legal name<input value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} placeholder="Used for royalty splits" /></label>
          <label>Email<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label>Password<input type="password" required minLength={mode === 'register' ? 8 : undefined} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </label>
        </>}
        {mode ==='login' && <>
        <label>Email<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label>Password<input type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        <p className='muted'><Link to="/register" className='muted'>Forgot password </Link></p>
        </>}
        <button disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Login' : 'Register'}</button>
        <p className="muted">{mode === 'login' ? <>Don't have an account? <Link to="/register">Create one</Link></> : <>Already registered? <Link to="/login">Log in</Link></>}</p>
      </form>
    </div>
  )
}