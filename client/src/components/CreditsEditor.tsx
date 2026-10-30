import type { CreditRow } from '../types'
import { CREDIT_TITLES, INSTRUMENT_TITLES } from '../data/contributorTitles'
import { knownTitle, newCredit } from '../lib/distribution'
import RowListEditor from './RowListEditor'

// Producer-style credits: a name and what they did (Producer, Mixing Engineer, Vocals…). Producer is the default title.
export default function CreditsEditor({ legend, hint, value, onChange, max = 30 }: {
  legend: string; hint?: string; value: CreditRow[]; onChange: (next: CreditRow[]) => void; max?: number
}) {
  return (
    <RowListEditor
      legend={legend} hint={hint} noun="credit" value={value} onChange={onChange} max={max} newRow={newCredit}
      renderRow={(c, i, setRow) => (
        <>
          <input value={c.name} maxLength={200} aria-label={`${legend}: name ${i + 1}`} placeholder="Full name" onChange={(e) => setRow({ ...c, name: e.target.value })} />
          <select value={c.title} aria-label={`${legend}: role ${i + 1}`} onChange={(e) => setRow({ ...c, title: e.target.value })}>
            {!knownTitle(c.title) && <option value={c.title}>{c.title}</option>}
            <optgroup label="Roles">{CREDIT_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>
            <optgroup label="Instruments and performance">{INSTRUMENT_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>
          </select>
        </>
      )}
    />
  )
}
