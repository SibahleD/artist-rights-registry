import { useState } from 'react'

const CUSTOM_VALUE = '__other__'

// A dropdown of known choices with an "Other…" entry that reveals a text box. Any saved value that is not in the list
// opens straight into "Other", so nothing already stored is lost.
export default function SelectOrOther({ label, options, value, onChange, otherPlaceholder = 'Type it here', maxLength = 100 }: {
  label: string; options: readonly string[]; value: string; onChange: (v: string) => void; otherPlaceholder?: string; maxLength?: number
}) {
  const [custom, setCustom] = useState(!!value && !options.includes(value))
  return (
    <label>{label}
      <select value={custom ? CUSTOM_VALUE : value} onChange={(e) => {
        if (e.target.value === CUSTOM_VALUE) { setCustom(true); if (options.includes(value)) onChange('') }
        else { setCustom(false); onChange(e.target.value) }
      }}>
        <option value="">Not specified</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value={CUSTOM_VALUE}>Other…</option>
      </select>
      {custom && <input value={value} maxLength={maxLength} placeholder={otherPlaceholder} onChange={(e) => onChange(e.target.value)} />}
    </label>
  )
}
