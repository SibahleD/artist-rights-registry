import type { ReactNode } from 'react'

// The one place a page saves from: pinned to the top so it is always in reach on a long form.
export default function SaveBar({ dirty, busy, onSave, onCancel, message, saveLabel = 'Save', children }: {
  dirty: boolean; busy: boolean; onSave: () => void; onCancel?: () => void; message?: string; saveLabel?: string; children?: ReactNode
}) {
  return (
    <div className="savebar" role="region" aria-label="Save">
      <button type="button" disabled={busy} onClick={onSave}>{busy ? 'Saving…' : saveLabel}</button>
      {children}
      {onCancel && <button type="button" className="ghost" disabled={busy} onClick={onCancel}>Cancel</button>}
      {dirty && <span className="savebar-note">Unsaved changes</span>}
      {message && <span className="muted" role="status">{message}</span>}
    </div>
  )
}
