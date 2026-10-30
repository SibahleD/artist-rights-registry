import RowListEditor from './RowListEditor'

// Featured artists on one song, as rows (like the primary artists and the credits), one name per row.
// The saved shape is unchanged: a list of names, kept as 0% performer credits by the form.
export default function FeaturedArtistsEditor({ value, onChange, max = 10 }: {
  value: string[]; onChange: (next: string[]) => void; max?: number
}) {
  return (
    <RowListEditor
      legend="Featured artists (optional)"
      hint="Artists who appear on this song but are not main artists. They are credited as performers. Give them a share on the Splits page if they will earn one."
      noun="featured artist" dataField="featured-artists" value={value} onChange={onChange} max={max} newRow={() => ''}
      renderRow={(name, i, setRow) => (
        <input value={name} maxLength={200} aria-label={`Featured artist ${i + 1}`} placeholder="Artist name" onChange={(e) => setRow(e.target.value)} />
      )}
    />
  )
}
