import { useEffect } from 'react'

// Used when someone follows an "Open" link from the readiness checklist: the page gets ?focus=<field>, and the matching
// part of the form (an element marked data-field="<field>") scrolls into view and glows until they touch it.
export function useGlowField(field: string | null, ready: boolean, deps: unknown[] = []) {
  useEffect(() => {
    if (!field || !ready) return
    let el: HTMLElement | null = null
    const events = ['input', 'change', 'click']
    const clear = () => {
      el?.classList.remove('glow')
      events.forEach((e) => el?.removeEventListener(e, clear))
    }
    const frame = requestAnimationFrame(() => {
      el = document.querySelector<HTMLElement>(`[data-field="${field.replace(/[^a-z0-9-]/gi, '')}"]`)
      if (!el) return
      el.classList.add('glow')
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.querySelector<HTMLElement>('input, select, textarea')?.focus({ preventScroll: true })
      events.forEach((e) => el?.addEventListener(e, clear))
    })
    return () => { cancelAnimationFrame(frame); clear() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field, ready, ...deps])
}
