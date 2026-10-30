import { useEffect, useRef, useState } from 'react'
import { fetchBlob } from '../api'
import { formatStartTime } from '../lib/distribution'
import { Spinner } from './Skeleton'

const PREVIEW_SECONDS = 30   // how long a store preview plays

// A player for a track's reference audio. A file just picked plays straight from the browser; a saved file is
// fetched only when Play is pressed, so a page of songs does not download them all.
// With onPreviewStart the player also lets the artist choose where the store preview begins, by ear: drag the slider
// (the song jumps there), use the current position, or play the preview as a store would. The slider stops at the end of the song.
export default function AudioPreview({ file, releaseId, trackId, previewStart, onPreviewStart }: {
  file?: File | null; releaseId?: string; trackId?: string
  previewStart?: number | null; onPreviewStart?: (seconds: number) => void
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [length, setLength] = useState(0)
  const [now, setNow] = useState(0)
  const wantPlay = useRef(false)
  const demoEnd = useRef<number | null>(null)
  const player = useRef<HTMLAudioElement>(null)

  // Whenever the source file changes, drop the old player.
  useEffect(() => {
    setErr(''); wantPlay.current = false; demoEnd.current = null; setLength(0); setNow(0)
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
      <div className="stack tight">
        <div className="row">
          <button type="button" className="secondary" disabled={loading || !releaseId || !trackId} onClick={loadSaved}>{loading ? <><Spinner size={14} label="Loading the audio" /> Loading</> : '▶ Play'}</button>
          {err && <small className="warn">{err}</small>}
        </div>
        {onPreviewStart && !file && <small className="muted">Press Play to load the song, then you can pick the preview start by ear.</small>}
      </div>
    )
  }

  const maxStart = Math.max(0, Math.floor(length) - 1)   // the preview has to start inside the song
  const start = Math.min(previewStart ?? 0, maxStart)
  const choose = (seconds: number) => {
    const s = Math.max(0, Math.min(Math.floor(seconds), maxStart))
    onPreviewStart?.(s)
    if (player.current) player.current.currentTime = s
  }
  const demo = () => {
    const p = player.current
    if (!p) return
    p.currentTime = start
    demoEnd.current = start + PREVIEW_SECONDS
    void p.play().catch(() => {})
  }

  return (
    <div className="stack">
      <audio ref={player} controls preload="metadata" src={src} style={{ width: '100%' }}
        onLoadedMetadata={() => {
          setLength(Number.isFinite(player.current?.duration) ? player.current!.duration : 0)
          if (wantPlay.current) { wantPlay.current = false; void player.current?.play().catch(() => {}) }
        }}
        onTimeUpdate={() => {
          const p = player.current
          if (!p) return
          setNow(p.currentTime)
          if (demoEnd.current !== null && p.currentTime >= demoEnd.current) { demoEnd.current = null; p.pause() }
        }}
        onPause={() => { demoEnd.current = null }}
        onError={() => setErr("This file can't be played in your browser. It is stored safely and will still upload and export.")} />
      {onPreviewStart && length > 1 && (
        <div className="stack tight preview-picker">
          <label>Preview start: {formatStartTime(start)} of {formatStartTime(Math.floor(length))}
            <input type="range" min={0} max={maxStart} step={1} value={start} onChange={(e) => choose(Number(e.target.value))} />
          </label>
          <div className="row">
            <button type="button" className="secondary" onClick={() => choose(now)}>Use current position ({formatStartTime(Math.floor(now))})</button>
            <button type="button" className="secondary" onClick={demo}>▶ Play preview from {formatStartTime(start)}</button>
          </div>
          <small className="muted">The preview plays {PREVIEW_SECONDS} seconds from the chosen start, the way a store would play it.</small>
        </div>
      )}
      {err && <small className="warn">{err}</small>}
    </div>
  )
}
