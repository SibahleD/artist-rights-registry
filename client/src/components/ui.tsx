import { useEffect, useState, type ReactNode } from 'react'
import chevron from '../assets/ico/chevron-down.svg'

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

// A question that needs a yes or no, in place of the browser's own confirm box.
export function ConfirmModal({ title, children, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, busy, onConfirm, onClose }: {
  title: string; children: ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean; busy?: boolean
  onConfirm: () => void; onClose: () => void
}) {
  return (
    <Modal title={title} onClose={() => !busy && onClose()}>
      {children}
      <div className="row actions">
        <button type="button" className={danger ? 'danger' : undefined} disabled={busy} onClick={onConfirm}>{busy ? 'Working…' : confirmLabel}</button>
        <button type="button" className="ghost" disabled={busy} onClick={onClose}>{cancelLabel}</button>
      </div>
    </Modal>
  )
}

// A section whose body can be minimised by clicking its title. The body stays mounted while hidden so form state survives.
export function Collapsible({ title, children, defaultOpen = true, actions, level = 'h4', className = 'card' }: {
  title: ReactNode; children: ReactNode; defaultOpen?: boolean; actions?: ReactNode; level?: 'h2' | 'h4'; className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const Heading = level
  return (
    <section className={className}>
      <div className="section-head">
        <button type="button" className="section-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <img className={`collapse-icon${open ? '' : ' closed'}`} src={chevron} alt="" />
          <Heading>{title}</Heading>
        </button>
        {actions}
      </div>
      <div className="collapse-body" hidden={!open}>{children}</div>
    </section>
  )
}

export const Badge = ({ status, label }: { status: string; label?: string }) => <span className={`badge ${status}`}>{label ?? status}</span>

export const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—')
export const fmtDateTime = (s?: string | null) => (s ? new Date(s).toLocaleString() : '—')
export const fmtDuration = (secs?: number | null) => (secs ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : '—')

export function Hint({ children }: { children: ReactNode }) { return <small className="hint">{children}</small> }
