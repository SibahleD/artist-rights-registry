import { api, ApiError } from '../api'
import { Modal } from './ui'

export type ReadyResult =
  | { ok: true }
  | { ok: false; error: string; problems?: string[]; unconfirmed?: string[] }

export async function tryMarkReady(rid: string): Promise<ReadyResult> {
  try {
    await api(`/releases/${rid}/ready`, 'POST')
    return { ok: true }
  } catch (e) {
    const ae = e as ApiError
    if (ae.data?.needsAcknowledgement) return { ok: false, error: ae.message, unconfirmed: ae.data.unconfirmed as string[] }
    if (ae.details) return { ok: false, error: ae.message, problems: ae.details }
    throw e
  }
}

export const acknowledgeUnconfirmed = (rid: string) => api(`/releases/${rid}/acknowledge-unconfirmed`, 'POST')

export function AckModal({ list, busy, onConfirm, onClose }: {
  list: string[]; busy: boolean; onConfirm: () => void; onClose: () => void
}) {
  return (
    <Modal title="Some co-writers haven't confirmed" onClose={onClose}>
      <p>These co-writers haven't confirmed their share. You can still mark the release ready, but the splits will be locked on your word alone.</p>
      <ul>{list.map((l) => <li key={l}>{l}</li>)}</ul>
      <div className="row actions">
        <button disabled={busy} onClick={onConfirm}>{busy ? 'Saving…' : 'Mark ready anyway'}</button>
        <button className="ghost" onClick={onClose}>Back</button>
      </div>
    </Modal>
  )
}
