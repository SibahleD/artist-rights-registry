// The ordered list of primary artists on a release. Order matters (the first is the lead), so each row can move up or down.
// Left empty, the main artist name is used.
export default function PrimaryArtistsEditor({ value, onChange, max = 20 }: {
  value: string[]; onChange: (next: string[]) => void; max?: number
}) {
  const set = (i: number, v: string) => onChange(value.map((x, j) => (j === i ? v : x)))
  const move = (i: number, by: -1 | 1) => {
    const next = [...value]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    onChange(next)
  }
  return (
    <fieldset className="editor-list">
      <legend>Primary artists</legend>
      <small className="hint">Everyone who appears as a main artist on the release, lead first. Leave this empty to use the main artist name. Featured artists are added on each song.</small>
      {value.map((name, i) => (
        <div className="row editor-row" key={i}>
          <input value={name} maxLength={200} aria-label={`Primary artist ${i + 1}`} placeholder="Artist name" onChange={(e) => set(i, e.target.value)} />
          <button type="button" className="ghost" aria-label={`Move artist ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
          <button type="button" className="ghost" aria-label={`Move artist ${i + 1} down`} disabled={i === value.length - 1} onClick={() => move(i, 1)}>↓</button>
          <button type="button" className="ghost" aria-label={`Remove artist ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="row">
        <button type="button" className="secondary" disabled={value.length >= max} onClick={() => onChange([...value, ''])}>+ Add artist</button>
      </div>
    </fieldset>
  )
}
