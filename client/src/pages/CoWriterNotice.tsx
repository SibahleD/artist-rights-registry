import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import { ErrorBox, Loading } from '../components/ui'
import AuthShell from '../components/AuthShell'
import type { PublicNotice } from '../types'

type Choice = 'confirm' | 'dispute' | 'remove' | 'unrecognized'

const DONE: Record<string, string> = {
  confirmed: 'Thanks, your share is confirmed.',
  disputed: 'Thanks, we have recorded that you disagree. The writer has been told to agree the correct split with you.',
  removed: 'Done. You have been removed from this song and your details are deleted.',
  expired: 'This invitation has expired.',
  cancelled: 'This invitation was cancelled.',
}

export default function CoWriterNotice() {
  const { token } = useParams()
  const [notice, setNotice] = useState<PublicNotice | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState<'dispute' | 'remove' | null>(null)

  useEffect(() => {
    api<{ notice: PublicNotice }>(`/notices/${token}`)
      .then((r) => setNotice(r.notice))
      .catch((e) => setErr((e as Error).message))
  }, [token])

  async function submit(choice: Choice) {
    setBusy(true); setErr(null)
    try {
      const r = await api<{ status: string }>(`/notices/${token}/respond`, 'POST', { choice, message: message || undefined })
      setResult(r.status)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <AuthShell>
      <div className="stack">
        <h1>Confirm your share</h1>
        {err && <ErrorBox error={err} />}
        {!notice && !err && <Loading />}
        {result && <p>{DONE[result] ?? 'Thanks.'}</p>}
        {notice && !result && !notice.track_title && <p>{DONE[notice.status] ?? 'This link is no longer active.'}</p>}
        {notice && !result && notice.track_title && (
          <>
            <p>
              <strong>{notice.artist_name}</strong> listed {notice.co_writer_name ? <strong>{notice.co_writer_name}</strong> : 'you'} as
              {' '}<strong>{notice.role}</strong> on <strong>{notice.track_title}</strong> ({notice.release_title}) with a
              {' '}<strong>{Number(notice.share_percent)}%</strong> ownership share.
            </p>
            {notice.status !== 'pending' && <p className="muted">Your current answer: {notice.status}. You can change it below.</p>}
            {mode && (
              <label>{mode === 'dispute' ? 'What is wrong? (optional)' : 'Why are you removing yourself? (optional)'}
                <textarea value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} />
              </label>
            )}
            <div className="row actions">
              {!mode && <button disabled={busy} onClick={() => submit('confirm')}>This is correct</button>}
              {mode ? (
                <>
                  <button disabled={busy} onClick={() => submit(mode)}>{mode === 'dispute' ? 'Send dispute' : 'Remove me'}</button>
                  <button className="ghost" onClick={() => setMode(null)}>Back</button>
                </>
              ) : (
                <>
                  <button className="secondary" disabled={busy} onClick={() => setMode('dispute')}>The details are wrong</button>
                  <button className="ghost danger" disabled={busy} onClick={() => setMode('remove')}>Remove me</button>
                  <button className="ghost" disabled={busy} onClick={() => submit('unrecognized')}>I don't know this person</button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </AuthShell>
  )
}
