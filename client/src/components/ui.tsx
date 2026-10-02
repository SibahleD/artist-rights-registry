import { useEffect, useState, type ReactNode } from 'react'

export function Loading({ what = 'Loading' }: { what?: string }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setSlow(true), 3000); return () => clearTimeout(t) }, [])
  return <p className="muted">{what}…{slow && ' The server is waking up, this can take up to a minute.'}</p>
}

export const ErrorBox = ({ error, details }: { error: string; details?: string[] }) => (
  <div className="error" role="alert">
    <strong>{error}</strong>
    {details && <ul>{details.map((d) => <li key={d}>{d}</li>)}</ul>}
  </div>
)

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>{children}
      </div>
    </div>
  )
}

export const Badge = ({ status }: { status: string }) => <span className={`badge ${status}`}>{status}</span>

export const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—')
export const fmtDateTime = (s?: string | null) => (s ? new Date(s).toLocaleString() : '—')
export const fmtDuration = (secs?: number | null) => (secs ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : '—')

export function Hint({ children }: { children: ReactNode }) { return <small className="hint">{children}</small> }
