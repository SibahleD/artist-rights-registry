import { useSyncExternalStore } from 'react'
import { api, getToken } from '../api'

// One shared copy of the user's glossary marks, so the Glossary page and the hover cards on other pages stay in step
// and the list is fetched once, not once per term.

// Only understood terms are stored. A term that is not listed counts as still learning.
export type GlossaryStatus = 'understood'
export type GlossaryProgress = Record<string, GlossaryStatus>

let state: GlossaryProgress = {}
let loadedFor: string | null = null   // the sign-in the copy belongs to, so a different account never sees it
let loading: Promise<void> | null = null
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

export function loadProgress(): Promise<void> {
  const token = getToken()
  if (!token) return Promise.resolve()
  if (loadedFor !== token && !loading) { state = {}; loadedFor = null; emit() }
  if (loadedFor === token) return Promise.resolve()
  if (loading) return loading
  loading = api<{ progress: GlossaryProgress }>('/glossary/progress')
    .then((r) => { state = r.progress; loadedFor = token; emit() })
    .catch(() => {})
    .finally(() => { loading = null })
  return loading
}

// Optimistic: the mark changes at once and goes back if saving fails (the error is rethrown for the caller to show).
export async function setGlossaryStatus(id: string, status: GlossaryStatus | null): Promise<void> {
  const before = state[id]
  const put = (v: GlossaryStatus | undefined) => {
    const { [id]: _, ...rest } = state
    state = v ? { ...rest, [id]: v } : rest
    emit()
  }
  put(status ?? undefined)
  try {
    await api(`/glossary/progress/${id}`, 'PUT', { status })
  } catch (e) {
    put(before)
    throw e
  }
}

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const useGlossaryProgress = () => useSyncExternalStore(subscribe, () => state)
