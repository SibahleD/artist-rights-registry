import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

// The theme lives on <html data-theme>, set before first paint by an inline script in index.html.
// The landing page uses the same localStorage key, so the choice carries across.
const KEY = 'theme'
const listeners = new Set<() => void>()

export function getTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

export function setTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t)
  try { localStorage.setItem(KEY, t) } catch { /* storage unavailable */ }
  listeners.forEach((l) => l())
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark')
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => 'dark' as Theme)
}
