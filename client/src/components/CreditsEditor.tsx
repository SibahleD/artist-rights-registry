import type { CreditRow } from '../types'
import { CREDIT_TITLES, INSTRUMENT_TITLES } from '../data/contributorTitles'
import { knownTitle, newCredit } from '../lib/distribution'

// Producer-style credits: a name and what they did (Producer, Mixing Engineer, Vocals…). Producer is the default title.
export default function CreditsEditor({ legend, hint, value, onChange, max = 30 }: {
  legend: string; hint?: string; value: CreditRow[]; onChange: (next: CreditRow[]) => void; max?: number
}) {
  const set = (i: number, patch: Partial<CreditRow>) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  return (
    <fieldset className="editor-list">
      <legend>{legend}</legend>
      {hint && <small className="hint">{hint}</small>}
      {value.map((c, i) => (
        <div className="row editor-row" key={i}>
          <input value={c.name} maxLength={200} aria-label={`${legend}: name ${i + 1}`} placeholder="Full name" onChange={(e) => set(i, { name: e.target.value })} />
          <select value={c.title} aria-label={`${legend}: role ${i + 1}`} onChange={(e) => set(i, { title: e.target.value })}>
            {!knownTitle(c.title) && <option value={c.title}>{c.title}</option>}
            <optgroup label="Roles">{CREDIT_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>
            <optgroup label="Instruments and performance">{INSTRUMENT_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>
          </select>
          <button type="button" className="ghost" aria-label={`Remove credit ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="row">
        <button type="button" className="secondary" disabled={value.length >= max} onClick={() => onChange([...value, newCredit()])}>+ Add credit</button>
      </div>
    </fieldset>
  )
}
