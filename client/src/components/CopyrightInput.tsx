import { useEffect, useState } from 'react'

// One field for "year + owner", with the © or ℗ symbol added for the user. The year and the name are still stored separately.
// Anything the user types or pastes in front (©, ℗, (c), (p)) is stripped so the symbol is never doubled.
const LEAD = /^\s*(?:©|℗|\(c\)|\(p\))\s*/i

export function parseCopyright(text: string): { year: number | null; line: string } {
  const t = text.replace(LEAD, '').trim()
  const m = /^(\d{4})(?:\s+(.*))?$/.exec(t)
  if (m) return { year: parseInt(m[1], 10), line: (m[2] ?? '').trim() }
  return { year: null, line: t }
}

export const formatCopyright = (year: number | null | undefined, line: string | null | undefined) =>
  [year, (line ?? '').replace(LEAD, '').trim()].filter(Boolean).join(' ')

export default function CopyrightInput({ symbol, label, year, line, hint, placeholder, onChange }: {
  symbol: '©' | '℗'; label: string; year: number | null; line: string; hint?: string; placeholder?: string
  onChange: (year: number | null, line: string) => void
}) {
  const [text, setText] = useState(formatCopyright(year, line))

  // Pick up changes from outside (a saved release loading), without fighting what the user is typing.
  useEffect(() => {
    const p = parseCopyright(text)
    if (p.year !== year || p.line !== line.replace(LEAD, '').trim()) setText(formatCopyright(year, line))
  }, [year, line])   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <label>{label}
      <span className="adorned">
        <span className="adorn" aria-hidden="true">{symbol}</span>
        <input value={text} placeholder={placeholder} aria-label={`${label} (${symbol} is added for you)`}
          onChange={(e) => { setText(e.target.value); const p = parseCopyright(e.target.value); onChange(p.year, p.line) }} />
      </span>
      {hint && <small className="hint">{hint}</small>}
    </label>
  )
}
