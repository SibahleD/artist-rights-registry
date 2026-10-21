import { useEffect, useRef, useState } from 'react'
import { fetchBlob } from '../api'

// A player for a track's reference audio. A file just picked plays straight from the browser; a saved file is
// fetched only when Play is pressed, so a page of songs does not download them all.
export default function AudioPreview({ file, releaseId, trackId }: { file?: File | null; releaseId?: string; trackId?: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const wantPlay = useRef(false)
  const player = useRef<HTMLAudioElement>(null)

  // Whenever the source file changes, drop the old player.
  useEffect(() => {
    setErr(''); wantPlay.current = false
    if (!file) { setSrc(null); return }
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => () => { if (src && !file) URL.revokeObjectURL(src) }, [src, file])
  useEffect(() => { if (!file) setSrc(null) }, [trackId, file])

  async function loadSaved() {
    if (!releaseId || !trackId) return
    setLoading(true); setErr('')
    try {
      const blob = await fetchBlob(`/releases/${releaseId}/tracks/${trackId}/audio/file`)
      wantPlay.current = true
      setSrc(URL.createObjectURL(blob))
    } catch (e) { setErr((e as Error).message) } finally { setLoading(false) }
  }

  if (!src) {
    return (
      <div className="row">
        <button type="button" className="secondary" disabled={loading || !releaseId || !trackId} onClick={loadSaved}>{loading ? 'Loading…' : '▶ Play'}</button>
        {err && <small className="warn">{err}</small>}
      </div>
    )
  }
  return (
    <div className="stack">
      <audio ref={player} controls preload="metadata" src={src} style={{ width: '100%' }}
        onLoadedMetadata={() => { if (wantPlay.current) { wantPlay.current = false; void player.current?.play().catch(() => {}) } }}
        onError={() => setErr("This file can't be played in your browser. It is stored safely and will still upload and export.")} />
      {err && <small className="warn">{err}</small>}
    </div>
  )
}
