import { useRef, useState } from 'react'
import { AuthImage, checkImage, vinylFallback } from './files'
import ImageViewer from './ImageViewer'

// Chooses a JPEG or PNG and previews it. Nothing is uploaded here: the parent uploads on save.
export default function ImagePicker({ label, mediaId, file, maxBytes, shape = 'square', onPick, onClear }: {
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
          {has && <button type="button" className="ghost" onClick={() => { setErr(''); if (input.current) input.current.value = ''; onClear() }}>Remove</button>}
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
