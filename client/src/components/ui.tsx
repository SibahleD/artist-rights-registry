import { useEffect, useState, type ReactNode, useRef, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

// ---- ui --------------------------------------------------------------------
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

// ---- Icon ------------------------------------------------------------------
// Stroke icons drawn in currentColor, so they follow the text colour of whatever they sit in.
const ICONS = {
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  eye: <><path d="M2.062 12.348a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 19.876 0a1 1 0 0 1 0 .696a10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575a1 1 0 0 1 0 .696a10.8 10.8 0 0 1-1.444 2.49m-6.41-.679a3 3 0 0 1-4.242-4.242" /><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 4.446-5.143M2 2l20 20" /></>,
  info: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" /></>,
}
export type IconName = keyof typeof ICONS

export function Icon({ name, size = 18, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={`icon ${className}`.trim()} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {ICONS[name]}
    </svg>
  )
}

// Field help: an info icon that shows the text in a popup on hover, keyboard focus or tap.
// Put it inside a <label> and the icon sits at the label's top-right corner.
export function Hint({ children }: { children: ReactNode }) {
  return (
    <span className="hint-tip" tabIndex={0} role="note" aria-label="More information">
      <Icon name="info" size={16} />
      <span className="hint-pop" role="tooltip">{children}</span>
    </span>
  )
}

// Help text that must stay visible: validation messages and notes about what happens next.
export function Note({ children }: { children: ReactNode }) { return <small className="hint">{children}</small> }

// ---- Chevron ---------------------------------------------------------------
// The one arrow icon. Draws a down chevron and turns it for the other directions, in the colour of the surrounding text.
export type ChevronDir = 'down' | 'up' | 'left' | 'right'

export function Chevron({ dir = 'down', className = '' }: { dir?: ChevronDir; className?: string }) {
  return (
    <svg className={`chevron chevron-${dir} ${className}`.trim()} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

// ---- overlay ---------------------------------------------------------------
let locks = 0

// Stops the page behind from scrolling while something is open. Counts, so stacked overlays release it in turn.
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return
    const root = document.documentElement
    if (locks++ === 0) {
      root.style.setProperty('--scroll-gap', `${window.innerWidth - root.clientWidth}px`)
      root.classList.add('scroll-locked')
    }
    return () => {
      if (--locks === 0) {
        root.classList.remove('scroll-locked')
        root.style.removeProperty('--scroll-gap')
      }
    }
  }, [active])
}

// Only the newest overlay answers Escape.
const stack: object[] = []

// A full-screen layer rendered straight into <body>, so no sticky or blurred ancestor can trap it under the page.
// 'modal' centres a dialog on a dark backdrop; 'lightbox' is the picture viewer.
export function Overlay({ children, onClose, label, variant = 'modal' }: {
  children: ReactNode; onClose: () => void; label: string; variant?: 'modal' | 'lightbox'
}) {
  useScrollLock()
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const pressedBackdrop = useRef(false)

  useEffect(() => {
    const token = {}
    stack.push(token)
    const before = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && stack[stack.length - 1] === token) closeRef.current() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      stack.splice(stack.indexOf(token), 1)
      before?.focus?.()
    }
  }, [])

  return createPortal(
    <div
      ref={ref}
      tabIndex={-1}
      className={variant === 'lightbox' ? 'lightbox' : 'modal-backdrop'}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onMouseDown={(e) => { pressedBackdrop.current = e.target === e.currentTarget }}
      onClick={(e) => { if (variant === 'lightbox' || (pressedBackdrop.current && e.target === e.currentTarget)) onClose() }}
    >
      {children}
    </div>,
    document.body,
  )
}

// ---- Skeleton --------------------------------------------------------------
// Grey placeholder shapes that shimmer while a page loads, laid out like the page that is coming (as on YouTube).
// Where a shape makes no sense (a button, a tiny action, a sign-in check) use <Spinner /> instead.

export function Skeleton({ w = '100%', h = 14, round = false, style }: { w?: number | string; h?: number | string; round?: boolean; style?: CSSProperties }) {
  return <span className="skel" aria-hidden="true" style={{ width: w, height: h, borderRadius: round ? '50%' : undefined, ...style }} />
}

export function SkeletonLines({ lines = 3, last = '60%' }: { lines?: number; last?: string }) {
  return (
    <div className="stack tight" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} w={i === lines - 1 ? last : '100%'} />)}
    </div>
  )
}

const Card = ({ children }: { children: ReactNode }) => <div className="card stack skel-card" aria-hidden="true">{children}</div>

const Field = () => <div className="stack tight"><Skeleton w="40%" h={12} /><Skeleton h={38} style={{ borderRadius: 10 }} /></div>

const ReleaseRow = () => (
  <div className="card release skel-release" aria-hidden="true">
    <Skeleton w={72} h={72} style={{ borderRadius: 10, flex: 'none' }} />
    <div className="stack tight" style={{ flex: 1 }}><Skeleton w="70%" h={16} /><Skeleton w="45%" h={12} /></div>
  </div>
)

export type SkeletonVariant = 'list' | 'detail' | 'form' | 'dashboard' | 'text'

export function PageSkeleton({ variant = 'text' }: { variant?: SkeletonVariant }) {
  switch (variant) {
    case 'list':
      return (
        <div className="stack" aria-hidden="true">
          <Skeleton w="35%" h={28} />
          <div className="cards">{Array.from({ length: 6 }, (_, i) => <ReleaseRow key={i} />)}</div>
        </div>
      )
    case 'detail':
      return (
        <div className="stack" aria-hidden="true">
          <Card>
            <div className="row" style={{ gap: 20, alignItems: 'center' }}>
              <Skeleton w={140} h={140} style={{ borderRadius: 14, flex: 'none' }} />
              <div className="stack tight" style={{ flex: 1 }}><Skeleton w="55%" h={28} /><Skeleton w="35%" h={14} /><Skeleton w="25%" h={14} /></div>
            </div>
          </Card>
          <Card><Skeleton w="30%" h={18} /><SkeletonLines lines={4} /></Card>
          <Card><Skeleton w="30%" h={18} /><SkeletonLines lines={3} /></Card>
        </div>
      )
    case 'form':
      return (
        <div className="stack" aria-hidden="true">
          <Skeleton w="30%" h={28} />
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <Skeleton w="25%" h={18} />
              <div className="grid2"><Field /><Field /><Field /><Field /></div>
            </Card>
          ))}
        </div>
      )
    case 'dashboard':
      return (
        <div className="stack" aria-hidden="true">
          <Skeleton w="30%" h={28} />
          <div className="grid2">{[0, 1, 2, 3].map((i) => <Card key={i}><Skeleton w="40%" h={12} /><Skeleton w="55%" h={26} /></Card>)}</div>
          <Card><Skeleton w="30%" h={18} /><Skeleton h={180} style={{ borderRadius: 12 }} /></Card>
          <Card><SkeletonLines lines={5} /></Card>
        </div>
      )
    default:
      return <SkeletonLines lines={3} last="45%" />
  }
}

// A small turning circle: for places where a skeleton does not fit (inside buttons, short waits, the sign-in check).
export function Spinner({ size = 18, label = 'Loading' }: { size?: number; label?: string }) {
  return <span className="spinner" role="status" aria-label={label} style={{ width: size, height: size }} />
}

// ---- Hero ------------------------------------------------------------------
// Back link for the top-left corner of a hero (or of any page that has none).
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="hero-back"><Chevron dir="left" />{children}</Link>
}

// Page header: the back link sits in the top-left corner, the rest of the content below it.
// Pass `art` (a cover picture) to lay the content out beside it.
export function Hero({ back, art, style, centered, children }: { back?: ReactNode; art?: ReactNode; style?: CSSProperties; centered?: boolean; children: ReactNode }) {
  return (
    <div className={`hero${art ? ' hero-art' : ''}${centered ? ' hero-center' : ''}`} style={style}>
      {back}
      <div className="hero-main">
        {art}
        {art ? <div className="hero-text">{children}</div> : children}
      </div>
    </div>
  )
}
