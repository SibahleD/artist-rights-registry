import type { ReactNode } from 'react'

// The shared shell for every "list of rows" editor (primary artists, featured artists, credits).
// It owns the fieldset, the legend and hint, the remove and move buttons and the add button, so each editor only says
// what one row looks like. `noun` is used for the buttons and their screen-reader labels ("Remove credit 2").
export default function RowListEditor<T>({ legend, hint, noun, value, onChange, newRow, renderRow, max, movable = false, dataField }: {
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
