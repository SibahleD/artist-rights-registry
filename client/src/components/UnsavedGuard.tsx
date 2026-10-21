import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useBlocker, useLocation, useNavigate } from 'react-router-dom'
import { Modal } from './ui'

type Save = () => Promise<boolean | void> | boolean | void   // return false (or throw) when saving failed, so we stay on the page

// The one guard for every page that can lose edits. With unsaved changes:
//  - any move to another page inside the app (sidebar, links, the browser's back button) opens a save / discard / keep-editing modal;
//  - closing or reloading the tab gets the browser's own prompt, which is the only thing a page is allowed to show there.
// When a page saves and then navigates itself, call allowLeave() just before navigating so the guard stays out of the way.
export function useUnsavedChanges({ dirty, onSave, saveLabel = 'Save changes' }: { dirty: boolean; onSave?: Save; saveLabel?: string }) {
  const location = useLocation()
  const dirtyRef = useRef(dirty)
  const bypass = useRef(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { dirtyRef.current = dirty })
  useEffect(() => { bypass.current = false }, [location.key])

  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirtyRef.current && !bypass.current && currentLocation.pathname !== nextLocation.pathname)

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const allowLeave = useCallback(() => { bypass.current = true }, [])

  async function save() {
    if (!onSave) return
    setSaving(true)
    try {
      const ok = await onSave()
      if (ok === false) blocker.reset?.()
      else { bypass.current = true; blocker.proceed?.() }
    } catch { blocker.reset?.() } finally { setSaving(false) }
  }
  const discard = () => { bypass.current = true; blocker.proceed?.() }
  const stay = () => { if (!saving) blocker.reset?.() }

  const modal: ReactNode = blocker.state === 'blocked' && (
    <Modal title="Unsaved changes" onClose={stay}>
      <p>{onSave
        ? "You have changes that haven't been saved. Do you want to save them before you leave?"
        : "You have changes that haven't been saved. Use the Save button in the section you edited, or discard them."}</p>
      <div className="row actions">
        {onSave && <button type="button" disabled={saving} onClick={save}>{saving ? 'Saving…' : saveLabel}</button>}
        <button type="button" className="danger" disabled={saving} onClick={discard}>Discard changes</button>
        <button type="button" className="ghost" disabled={saving} onClick={stay}>Keep editing</button>
      </div>
    </Modal>
  )
  return { modal, allowLeave }
}

// Back button for edit pages, on top of the guard: going back is a navigation like any other, so the modal appears by itself.
export function useBackGuard({ dirty, onSave, fallback = '/discography', saveLabel }: {
  dirty: boolean; onSave: Save; fallback?: string; saveLabel?: string
}) {
  const nav = useNavigate()
  const hasHistory = useLocation().key !== 'default'
  const { modal, allowLeave } = useUnsavedChanges({ dirty, onSave, saveLabel })
  const goBack = () => (hasHistory ? nav(-1) : nav(fallback))
  const backButton = <button type="button" className="ghost back-btn" onClick={goBack}>← Back</button>
  return { goBack, modal, backButton, allowLeave }
}

// For a page made of several independent cards (Settings): each card reports whether it has unsaved edits,
// and the page is guarded while any of them does.
const DirtyContext = createContext<((key: string, dirty: boolean) => void) | null>(null)

function DirtyGuard({ dirty }: { dirty: boolean }) {
  return <>{useUnsavedChanges({ dirty }).modal}</>
}

export function DirtyProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const report = useCallback((key: string, dirty: boolean) => setFlags((f) => (f[key] === dirty ? f : { ...f, [key]: dirty })), [])
  return (
    <DirtyContext.Provider value={report}>
      <DirtyGuard dirty={Object.values(flags).some(Boolean)} />
      {children}
    </DirtyContext.Provider>
  )
}

export function useReportDirty(key: string, dirty: boolean) {
  const report = useContext(DirtyContext)
  useEffect(() => {
    report?.(key, dirty)
    return () => report?.(key, false)
  }, [key, dirty, report])
}
