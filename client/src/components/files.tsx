import { useEffect, useState } from 'react'
import { api, fetchBlob } from '../api'
import type { Usage } from '../types'
import vinyl from '../assets/vinyl-placeholder.png'

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

export function AuthImage({ mediaId, file, alt, fallback, onColor }: {
  mediaId?: string | null; file?: File | null; alt: string; fallback?: React.ReactNode; onColor?: (c: RGB | null) => void
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
  return src ? <img src={src} alt={alt} onLoad={(e) => onColor?.(dominantColor(e.currentTarget))} /> : <>{fallback ?? null}</>
}

export function UsageLine({ usage }: { usage: Usage | null }) {
  if (!usage || !usage.enabled) return null
  const { releases, bytes } = usage
  return (
    <p className="muted usage">
      Test limits: {releases.used} of {releases.max} releases · {fmtBytes(bytes.used)} of {fmtBytes(bytes.max ?? 0)} used.
    </p>
  )
}

export function checkImage(file: File, maxBytes: number): string | null {
  if (!['image/jpeg', 'image/png'].includes(file.type)) return 'Images must be JPEG or PNG files.'
  if (file.size > maxBytes) return `That image is ${fmtBytes(file.size)}. The limit for the test is ${fmtBytes(maxBytes)}.`
  return null
}
export function checkAudio(file: File, maxBytes: number): string | null {
  if (!/\.(mp3|aac|m4a|wav|flac)$/i.test(file.name)) return 'Please choose an mp3, aac, m4a, wav or flac file.'
  if (file.size > maxBytes) return `That file is ${fmtBytes(file.size)}. The limit for the test is ${fmtBytes(maxBytes)}.`
  return null
}
