// Featured artists on one song, as rows (like the primary artists and the credits), one name per row.
// The saved shape is unchanged: a list of names, kept as 0% performer credits by the form.
export default function FeaturedArtistsEditor({ value, onChange, max = 10 }: {
  value: string[]; onChange: (next: string[]) => void; max?: number
}) {
  const set = (i: number, v: string) => onChange(value.map((x, j) => (j === i ? v : x)))
  return (
    <fieldset className="editor-list" data-field="featured-artists">
      <legend>Featured artists (optional)</legend>
      <small className="hint">Artists who appear on this song but are not main artists. They are credited as performers. Give them a share on the Splits page if they will earn one.</small>
      {value.map((name, i) => (
        <div className="row editor-row" key={i}>
          <input value={name} maxLength={200} aria-label={`Featured artist ${i + 1}`} placeholder="Artist name" onChange={(e) => set(i, e.target.value)} />
          <button type="button" className="ghost" aria-label={`Remove featured artist ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="row">
        <button type="button" className="secondary" disabled={value.length >= max} onClick={() => onChange([...value, ''])}>+ Add featured artist</button>
      </div>
    </fieldset>
  )
}
