import { useEffect } from 'react'
import { AuthImage } from './files'

// Full-size view of a picture. Click anywhere, press Escape, or use the close button to leave.
export default function ImageViewer({ mediaId, file, alt, onClose }: { mediaId?: string | null; file?: File | null; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      <button type="button" className="lightbox-close ghost" aria-label="Close" onClick={onClose}>✕</button>
      <AuthImage mediaId={mediaId} file={file} alt={alt} />
    </div>
  )
}
