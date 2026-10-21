import { useEffect } from 'react'
import type { Theme } from './types'

// Resolves 'system' to light or dark and keeps it in step with the OS. index.css styles :root[data-theme].
export function useTheme(theme: Theme) {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const apply = () => { document.documentElement.dataset.theme = theme === 'system' ? (mq.matches ? 'light' : 'dark') : theme }
    apply()
    if (theme !== 'system') return
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}
