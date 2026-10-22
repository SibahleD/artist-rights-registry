import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

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
