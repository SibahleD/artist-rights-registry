import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Modal } from './ui'

// Back button behaviour for edit pages. With unsaved changes it asks whether to save or discard first.
// (The app uses a plain BrowserRouter, so links elsewhere on the page, like the sidebar, are not intercepted.
// Closing or reloading the tab is covered by the browser's own prompt.)
export function useBackGuard({ dirty, onSave, fallback = '/discography', saveLabel = 'Save changes', leaveAfterSave = true }: {
  dirty: boolean
  onSave: () => Promise<boolean | void> | boolean | void   // return false (or throw) when saving failed, so we stay on the page
  fallback?: string
  saveLabel?: string
  leaveAfterSave?: boolean   // false when onSave already moves to another page itself
}) {
  const nav = useNavigate()
  const hasHistory = useLocation().key !== 'default'
  const [asking, setAsking] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const leave = () => (hasHistory ? nav(-1) : nav(fallback))
  const goBack = () => (dirty ? setAsking(true) : leave())

  async function save() {
    setSaving(true)
    try {
      const ok = await onSave()
      setAsking(false)
      if (ok !== false && leaveAfterSave) leave()
    } catch { setAsking(false) } finally { setSaving(false) }
  }

  const modal: ReactNode = asking && (
    <Modal title="Unsaved changes" onClose={() => !saving && setAsking(false)}>
      <p>You have changes that haven't been saved. Do you want to save them before you leave?</p>
      <div className="row actions">
        <button disabled={saving} onClick={save}>{saving ? 'Saving…' : saveLabel}</button>
        <button className="danger" disabled={saving} onClick={() => { setAsking(false); leave() }}>Discard changes</button>
        <button className="ghost" disabled={saving} onClick={() => setAsking(false)}>Keep editing</button>
      </div>
    </Modal>
  )

  const backButton = <button type="button" className="ghost back-btn" onClick={goBack}>← Back</button>
  return { goBack, modal, backButton }
}
