import type { ReactNode } from 'react'
import type { CreditRow } from '../types'
import { CREDIT_TITLES, INSTRUMENT_TITLES } from '../data/contributorTitles'
import { knownTitle, newCredit } from '../lib/release'

// ---- RowListEditor ---------------------------------------------------------
// The shared shell for every "list of rows" editor (primary artists, featured artists, credits).
// It owns the fieldset, the legend and hint, the remove and move buttons and the add button, so each editor only says
// what one row looks like. `noun` is used for the buttons and their screen-reader labels ("Remove credit 2").
export function RowListEditor<T>({ legend, hint, noun, value, onChange, newRow, renderRow, max, movable = false, dataField }: {
  legend: string
  hint?: ReactNode
  noun: string
  value: T[]
  onChange: (next: T[]) => void
  newRow: () => T
  renderRow: (row: T, index: number, setRow: (next: T) => void) => ReactNode
  max: number
  movable?: boolean
  dataField?: string
}) {
  const setAt = (i: number, next: T) => onChange(value.map((x, j) => (j === i ? next : x)))
  const move = (i: number, by: -1 | 1) => {
    const next = [...value]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    onChange(next)
  }
  return (
    <fieldset className="editor-list" data-field={dataField}>
      <legend>{legend}</legend>
      {hint && <small className="hint">{hint}</small>}
      {value.map((row, i) => (
        <div className="row editor-row" key={i}>
          {renderRow(row, i, (next) => setAt(i, next))}
          {movable && (
            <>
              <button type="button" className="ghost" aria-label={`Move ${noun} ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="ghost" aria-label={`Move ${noun} ${i + 1} down`} disabled={i === value.length - 1} onClick={() => move(i, 1)}>↓</button>
            </>
          )}
          <button type="button" className="ghost" aria-label={`Remove ${noun} ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="row">
        <button type="button" className="secondary" disabled={value.length >= max} onClick={() => onChange([...value, newRow()])}>+ Add {noun}</button>
      </div>
    </fieldset>
  )
}

// ---- PrimaryArtistsEditor --------------------------------------------------
// The ordered list of primary artists on a release. Order matters (the first is the lead), so each row can move up or down.
// Left empty, the main artist name is used.
export function PrimaryArtistsEditor({ value, onChange, max = 20 }: {
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

// ---- FeaturedArtistsEditor -------------------------------------------------
// Featured artists on one song, as rows (like the primary artists and the credits), one name per row.
// The saved shape is unchanged: a list of names, kept as 0% performer credits by the form.
export function FeaturedArtistsEditor({ value, onChange, max = 10 }: {
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

// ---- CreditsEditor ---------------------------------------------------------
// Producer-style credits: a name and what they did (Producer, Mixing Engineer, Vocals…). Producer is the default title.
export function CreditsEditor({ legend, hint, value, onChange, max = 30 }: {
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
