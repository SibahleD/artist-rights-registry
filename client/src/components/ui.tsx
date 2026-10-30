import { useEffect, useState, type ReactNode } from 'react'
import Chevron from './Chevron'
import { Overlay } from './overlay'
import { PageSkeleton, Spinner, type SkeletonVariant } from './Skeleton'

// Shows a skeleton shaped like the page that is loading (variant), or a centred loading circle (variant="spinner").
// After 3 seconds it adds a note, because a free host can take up to a minute to wake the server.
export function Loading({ what = 'Loading', variant = 'text' }: { what?: string; variant?: SkeletonVariant | 'spinner' }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setSlow(true), 3000); return () => clearTimeout(t) }, [])
  return (
    <div className={variant === 'spinner' ? 'loading-center' : 'stack'} role="status" aria-busy="true" aria-label={what}>
      {variant === 'spinner' ? <Spinner size={32} label={what} /> : <PageSkeleton variant={variant} />}
      <p className="muted loading-note">{what}…{slow && ' The server is waking up, this can take up to a minute.'}</p>
    </div>
  )
}

export const ErrorBox = ({ error, details }: { error: string; details?: string[] }) => (
  <div className="error" role="alert">
    <strong>{error}</strong>
    {details && <ul>{details.map((d) => <li key={d}>{d}</li>)}</ul>}
  </div>
)

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <Overlay label={title} onClose={onClose}>
      <div className="modal">
        <h3>{title}</h3>{children}
      </div>
    </Overlay>
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
export function Collapsible({ title, children, defaultOpen = true, actions, level = 'h4', className = 'card', field }: {
  title: ReactNode; children: ReactNode; defaultOpen?: boolean; actions?: ReactNode; level?: 'h2' | 'h4'; className?: string; field?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const Heading = level
  return (
    <section className={className} data-field={field}>
      <div className="section-head">
        <button type="button" className="section-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <Chevron className={`collapse-icon${open ? '' : ' closed'}`} />
          <Heading>{title}</Heading>
        </button>
        {actions}
      </div>
      <div className="collapse-body" hidden={!open}>{children}</div>
    </section>
  )
}

// A card with a heading that does not collapse: for content that already sits under a tab.
export function Panel({ title, children, field, className = 'card' }: { title?: ReactNode; children: ReactNode; field?: string; className?: string }) {
  return (
    <section className={className} data-field={field}>
      {title && <div className="section-head"><h4>{title}</h4></div>}
      <div className="stack">{children}</div>
    </section>
  )
}

export const Badge = ({ status, label }: { status: string; label?: string }) => <span className={`badge ${status}`}>{label ?? status}</span>

export const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—')
export const fmtDateTime = (s?: string | null) => (s ? new Date(s).toLocaleString() : '—')
export const fmtDuration = (secs?: number | null) => (secs ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : '—')

export function Hint({ children }: { children: ReactNode }) { return <small className="hint">{children}</small> }
