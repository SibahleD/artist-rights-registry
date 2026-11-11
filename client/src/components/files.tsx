import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { api, fetchBlob } from '../api'
import type { Usage } from '../types'
import vinyl from '../assets/vinyl-placeholder.png'
import { Overlay } from './ui'
import { ART_NOT_ALLOWED, ART_TARGET } from '../lib/release'

// ---- files -----------------------------------------------------------------
export const MB = 1024 * 1024
export const fmtBytes = (n: number) => (n >= MB ? `${Math.round((n / MB) * 10) / 10} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

export function useUsage(refreshKey?: unknown) {
  const [usage, setUsage] = useState<Usage | null>(null)
  useEffect(() => { api<Usage>('/users/me/usage').then(setUsage).catch(() => {}) }, [refreshKey])
  return usage
}

// Shown wherever a release has no cover art of its own.
export const vinylFallback = <img className="vinyl" src={vinyl} alt="" />

export type RGB = [number, number, number]

// Average colour of an image, leaning towards its more saturated pixels so the tint is not just grey.
function dominantColor(img: HTMLImageElement): RGB | null {
  try {
    const size = 24
    const c = document.createElement('canvas'); c.width = c.height = size
    const g = c.getContext('2d', { willReadFrequently: true }); if (!g) return null
    g.drawImage(img, 0, 0, size, size)
    const d = g.getImageData(0, 0, size, size).data
    let r = 0, gr = 0, b = 0, w = 0
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue
      const max = Math.max(d[i], d[i + 1], d[i + 2]), min = Math.min(d[i], d[i + 1], d[i + 2])
      const wt = 0.15 + (max ? (max - min) / max : 0)
      r += d[i] * wt; gr += d[i + 1] * wt; b += d[i + 2] * wt; w += wt
    }
    return w ? [Math.round(r / w), Math.round(gr / w), Math.round(b / w)] : null
  } catch { return null }
}

// The artwork's two accent colours: the strongest saturated hue, and the strongest hue clearly different from it.
// When the art really has only one hue, the second is a darker shade of the first.
function accentColors(img: HTMLImageElement): [RGB, RGB] | null {
  try {
    const size = 32
    const c = document.createElement('canvas'); c.width = c.height = size
    const g = c.getContext('2d', { willReadFrequently: true }); if (!g) return null
    g.drawImage(img, 0, 0, size, size)
    const d = g.getImageData(0, 0, size, size).data
    const BINS = 12
    const bins = Array.from({ length: BINS }, () => ({ w: 0, r: 0, g: 0, b: 0 }))
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue
      const r = d[i], gr = d[i + 1], b = d[i + 2]
      const max = Math.max(r, gr, b), min = Math.min(r, gr, b), sat = max ? (max - min) / max : 0
      if (sat < 0.18 || max < 40) continue                      // skip greys, near-black and washed-out pixels
      const dl = max - min
      let h = max === r ? ((gr - b) / dl) % 6 : max === gr ? (b - r) / dl + 2 : (r - gr) / dl + 4
      h = (h * 60 + 360) % 360
      const bin = bins[Math.floor(h / (360 / BINS)) % BINS]
      const wt = sat * (max / 255)
      bin.w += wt; bin.r += r * wt; bin.g += gr * wt; bin.b += b * wt
    }
    const ranked = bins.map((b, i) => ({ ...b, i })).filter((b) => b.w > 0).sort((a, b) => b.w - a.w)
    if (!ranked.length) return null
    const rgb = (b: typeof ranked[number]): RGB => [Math.round(b.r / b.w), Math.round(b.g / b.w), Math.round(b.b / b.w)]
    const first = ranked[0]
    const apart = (b: typeof first) => { const x = Math.abs(b.i - first.i); return Math.min(x, BINS - x) >= 2 }   // at least ~60 degrees of hue away
    const second = ranked.find((b) => b !== first && apart(b) && b.w > first.w * 0.15)
    const a = rgb(first)
    return [a, second ? rgb(second) : (a.map((v) => Math.round(v * 0.55)) as RGB)]
  } catch { return null }
}

export function AuthImage({ mediaId, file, alt, fallback, onColor, onColors }: {
  mediaId?: string | null; file?: File | null; alt: string; fallback?: React.ReactNode
  onColor?: (c: RGB | null) => void; onColors?: (c: [RGB, RGB] | null) => void
}) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let url: string | null = null
    let live = true
    if (file) { url = URL.createObjectURL(file); setSrc(url) }
    else if (mediaId) {
      fetchBlob(`/media/${mediaId}`).then((b) => { if (!live) return; url = URL.createObjectURL(b); setSrc(url) }).catch(() => live && setSrc(null))
    } else setSrc(null)
    return () => { live = false; if (url) URL.revokeObjectURL(url) }
  }, [mediaId, file])
  return src ? <img src={src} alt={alt} onLoad={(e) => { onColor?.(dominantColor(e.currentTarget)); onColors?.(accentColors(e.currentTarget)) }} /> : <>{fallback ?? null}</>
}

// A release card link: cover on the left, `children` beside it. With artwork, the card's gradient and rim use the art's two accent colours.
export function ArtCard({ to, artworkId, children }: { to: string; artworkId?: string | null; children: React.ReactNode }) {
  const [tints, setTints] = useState<[RGB, RGB] | null>(null)
  const style = tints ? ({ '--tint': tints[0].join(', '), '--tint-2': tints[1].join(', ') } as React.CSSProperties) : undefined
  return (
    <Link to={to} className={`card release${tints ? ' art' : ''}`} style={style}>
      <div className="cover"><AuthImage mediaId={artworkId} alt="" fallback={vinylFallback} onColors={setTints} /></div>
      {children}
    </Link>
  )
}

export function UsageLine({ usage }: { usage: Usage | null }) {
  if (!usage || !usage.enabled) return null
  const { releases, bytes } = usage
  return (
    <p className="muted usage">
      Storage: {fmtBytes(bytes.used)}{bytes.max ? ` of ${fmtBytes(bytes.max)}` : ''} used{releases.max ? ` · ${releases.used} of ${releases.max} releases` : ''}.
    </p>
  )
}

export function checkImage(file: File, maxBytes: number): string | null {
  if (!['image/jpeg', 'image/png'].includes(file.type)) return 'Images must be JPEG or PNG files.'
  if (file.size > maxBytes) return `That image is ${fmtBytes(file.size)}. The limit is ${fmtBytes(maxBytes)}.`
  return null
}
export function checkAudio(file: File, maxBytes: number): string | null {
  if (!/\.(mp3|flac)$/i.test(file.name)) return 'Please choose an MP3 or FLAC file.'
  if (file.size > maxBytes) return `That file is ${fmtBytes(file.size)}. The limit is ${fmtBytes(maxBytes)}.`
  return null
}

// A two-stop gradient from the artwork's colour. Bright colours are scaled down so the white hero text always stays readable.
export function tintGradient([r, g, b]: RGB): string {
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  const k = lum > 0.4 ? 0.4 / lum : 1
  const c = (m: number) => [r, g, b].map((v) => Math.round(v * k * m)).join(' ')
  return `linear-gradient(135deg, rgb(${c(1)}), rgb(${c(0.5)}))`
}

// ---- ImagePicker -----------------------------------------------------------
// Chooses a JPEG or PNG and previews it. Nothing is uploaded here: the parent uploads on save.
export function ImagePicker({ label, mediaId, file, maxBytes, shape = 'square', onPick, onClear }: {
  label: string; hint?: string; mediaId?: string | null; file?: File | null; maxBytes: number
  shape?: 'square' | 'round'; onPick: (f: File) => void; onClear: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [err, setErr] = useState('')
  const [viewing, setViewing] = useState(false)
  const has = !!file || !!mediaId
  return (
    <div className="image-picker">
      {has ? (
        <button type="button" className={`cover viewable${shape === 'round' ? ' round' : ''}`} aria-label={`View ${label.toLowerCase()} full size`} title="Click to view" onClick={() => setViewing(true)}>
          <AuthImage mediaId={mediaId} file={file} alt={label} />
        </button>
      ) : (
        <div className={`cover${shape === 'round' ? ' round' : ''}`}>
          <AuthImage mediaId={mediaId} file={file} alt={label} fallback={shape === 'round' ? <span>+</span> : vinylFallback} />
        </div>
      )}
      {viewing && <ImageViewer mediaId={mediaId} file={file} alt={label} onClose={() => setViewing(false)} />}
      <div className="stack">
        <div className="row">
          <button type="button" className="secondary" onClick={() => input.current?.click()}>{has ? 'Change' : 'Choose image'}</button>
          {has && <button type="button" className="ghost" aria-label="Remove image" title="Remove image" onClick={() => { setErr(''); if (input.current) input.current.value = ''; onClear() }}>✕</button>}
        </div>
        {err && <small className="warn">{err}</small>}
        <input ref={input} type="file" accept="image/jpeg,image/png" hidden onChange={(e) => {
          const f = e.target.files?.[0]; if (!f) return
          const problem = checkImage(f, maxBytes)
          if (problem) { setErr(problem); e.target.value = ''; return }
          setErr(''); onPick(f)
        }} />
      </div>
    </div>
  )
}

// ---- ImageViewer -----------------------------------------------------------
// Full-size view of a picture on a darkened full-screen layer. Click anywhere, press Escape, or use the close button to leave.
// The page behind is locked, and the picture fills the screen's height.
export function ImageViewer({ mediaId, file, alt, onClose }: { mediaId?: string | null; file?: File | null; alt: string; onClose: () => void }) {
  return (
    <Overlay variant="lightbox" label={alt} onClose={onClose}>
      <button type="button" className="lightbox-close" aria-label="Close" onClick={onClose}>✕</button>
      <AuthImage mediaId={mediaId} file={file} alt={alt} />
    </Overlay>
  )
}

// ---- CoverArtGuide ---------------------------------------------------------
// Cover art rules that no program can check, shown as a list with a confirmation. The size and weight are checked on the
// server and shown as warnings on the release page. The confirmation is a reminder for this visit and is not saved.
export function CoverArtGuide({ confirmed, onConfirm }: { confirmed: boolean; onConfirm: (v: boolean) => void }) {
  return (
    <div className="art-guide">
      <p className="art-guide-title">Cover art checklist</p>
      <p className="hint">Aim for: {ART_TARGET}</p>
      <p className="hint">Stores can reject cover art that contains or shows:</p>
      <ul>{ART_NOT_ALLOWED.map((x) => <li key={x}>{x}</li>)}</ul>
      <label className="consent">
        <input type="checkbox" checked={confirmed} onChange={(e) => onConfirm(e.target.checked)} />
        <span>I have checked my cover art against this list.</span>
      </label>
    </div>
  )
}
