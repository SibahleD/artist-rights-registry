import { AuthImage } from './files'
import { Overlay } from './overlay'

// Full-size view of a picture on a darkened full-screen layer. Click anywhere, press Escape, or use the close button to leave.
// The page behind is locked, and the picture fills the screen's height.
export default function ImageViewer({ mediaId, file, alt, onClose }: { mediaId?: string | null; file?: File | null; alt: string; onClose: () => void }) {
  return (
    <Overlay variant="lightbox" label={alt} onClose={onClose}>
      <button type="button" className="lightbox-close" aria-label="Close" onClick={onClose}>✕</button>
      <AuthImage mediaId={mediaId} file={file} alt={alt} />
    </Overlay>
  )
}
