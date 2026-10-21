import { useState } from 'react'

// Free-text names as removable pills. Type a name and press Enter or comma to add it.
export default function NameTags({ label, value, onChange, placeholder, maxLength = 200, max = 10 }: {
  label: string; value: string[]; onChange: (next: string[]) => void; placeholder?: string; maxLength?: number; max?: number
}) {
  const [text, setText] = useState('')
  const add = (raw: string) => {
    const names = raw.split(',').map((n) => n.trim()).filter(Boolean)
    const next = [...value]
    for (const n of names) if (next.length < max && !next.some((x) => x.toLowerCase() === n.toLowerCase())) next.push(n.slice(0, maxLength))
    if (next.length !== value.length) onChange(next)
    setText('')
  }
  return (
    <label>{label}
      <div className="tags">
        {value.map((n) => (
          <span key={n} className="tag-pill on">{n}
            <button type="button" className="ghost" aria-label={`Remove ${n}`} onClick={() => onChange(value.filter((x) => x !== n))}>✕</button>
          </span>
        ))}
      </div>
      <input value={text} placeholder={placeholder} disabled={value.length >= max}
        onChange={(e) => (e.target.value.includes(',') ? add(e.target.value) : setText(e.target.value))}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(text) } }}
        onBlur={() => text.trim() && add(text)} />
    </label>
  )
}
