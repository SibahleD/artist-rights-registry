import { useEffect, useState } from 'react'
import { api, fetchBlob } from '../api'
import type { Usage } from '../types'

export const MB = 1024 * 1024
export const fmtBytes = (n: number) => (n >= MB ? `${Math.round((n / MB) * 10) / 10} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

export function useUsage(refreshKey?: unknown) {
  const [usage, setUsage] = useState<Usage | null>(null)
  useEffect(() => { api<Usage>('/users/me/usage').then(setUsage).catch(() => {}) }, [refreshKey])
  return usage
}

export function AuthImage({ mediaId, file, alt, fallback }: {
  mediaId?: string | null; file?: File | null; alt: string; fallback?: React.ReactNode
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
  return src ? <img src={src} alt={alt} /> : <>{fallback ?? null}</>
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
