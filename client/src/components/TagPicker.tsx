// Pick any number of options shown as pill tags. Each tag is a toggle button, so it works with keyboard and screen readers.
export default function TagPicker<T extends string>({ options, value, onChange, label }: {
  options: readonly T[]; value: T[]; onChange: (next: T[]) => void; label: string
}) {
  const toggle = (o: T) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])
  return (
    <div role="group" aria-label={label} className="tags">
      {options.map((o) => (
        <button key={o} type="button" className={`tag-pill${value.includes(o) ? ' on' : ''}`} aria-pressed={value.includes(o)} onClick={() => toggle(o)}>
          {value.includes(o) && <span aria-hidden="true">✓ </span>}{o.charAt(0).toUpperCase() + o.slice(1)}
        </button>
      ))}
    </div>
  )
}
