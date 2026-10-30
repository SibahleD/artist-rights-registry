import RowListEditor from './RowListEditor'

// The ordered list of primary artists on a release. Order matters (the first is the lead), so each row can move up or down.
// Left empty, the main artist name is used.
export default function PrimaryArtistsEditor({ value, onChange, max = 20 }: {
  value: string[]; onChange: (next: string[]) => void; max?: number
}) {
  return (
    <RowListEditor
      legend="Primary artists"
      hint="Everyone who appears as a main artist on the release, lead first. Leave this empty to use the main artist name. Featured artists are added on each song."
      noun="artist" value={value} onChange={onChange} max={max} movable newRow={() => ''}
      renderRow={(name, i, setRow) => (
        <input value={name} maxLength={200} aria-label={`Primary artist ${i + 1}`} placeholder="Artist name" onChange={(e) => setRow(e.target.value)} />
      )}
    />
  )
}
