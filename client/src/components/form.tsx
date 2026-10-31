import { Hint, Icon } from './ui'
import { type ReactNode, useState, useEffect, type InputHTMLAttributes } from 'react'

// ---- Required --------------------------------------------------------------
// The asterisk that marks a detail the release needs before it can be marked ready.
export const Req = () => <span className="req" title="Needed before the release can be marked ready" aria-label="(needed)"> *</span>

export const RequiredNote = () => (
  <p className="hint required-note"><span className="req" aria-hidden="true">*</span> marks what a release needs before it can be marked ready. Everything else is optional, but distributors usually ask for it.</p>
)

// ---- SaveBar ---------------------------------------------------------------
// The one place a page saves from: pinned to the top so it is always in reach on a long form.
export function SaveBar({ dirty, busy, onSave, onCancel, message, saveLabel = 'Save', children }: {
  dirty: boolean; busy: boolean; onSave: () => void; onCancel?: () => void; message?: string; saveLabel?: string; children?: ReactNode
}) {
  return (
    <div className="savebar" role="region" aria-label="Save">
      <button type="button" disabled={busy} onClick={onSave}>{busy ? 'Saving…' : saveLabel}</button>
      {children}
      {onCancel && <button type="button" className="ghost" disabled={busy} onClick={onCancel}>Cancel</button>}
      {dirty && <span className="savebar-note">Unsaved changes</span>}
      {message && <span className="muted" role="status">{message}</span>}
    </div>
  )
}

// ---- SelectOrOther ---------------------------------------------------------
const CUSTOM_VALUE = '__other__'

// A dropdown of known choices with an "Other…" entry that reveals a text box. Any saved value that is not in the list
// opens straight into "Other", so nothing already stored is lost.
export function SelectOrOther({ label, options, value, onChange, otherPlaceholder = 'Type it here', maxLength = 100 }: {
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

// ---- TagPicker -------------------------------------------------------------
// Pick any number of options shown as pill tags. Each tag is a toggle button, so it works with keyboard and screen readers.
export function TagPicker<T extends string>({ options, value, onChange, label }: {
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

// ---- CopyrightInput --------------------------------------------------------
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

export function CopyrightInput({ symbol, label, year, line, hint, placeholder, onChange }: {
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
      {hint && <Hint>{hint}</Hint>}
    </label>
  )
}

// ---- PasswordInput ---------------------------------------------------------
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

// A password box with a show/hide button. Use it for every password field so they all behave the same.

export function PasswordInput(props: Props) {
  const [shown, setShown] = useState(false)
  return (
    <span className="pw-field">
      <input {...props} type={shown ? 'text' : 'password'} />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        title={shown ? 'Hide password' : 'Show password'}
      >
        <Icon name={shown ? 'eyeOff' : 'eye'} />
      </button>
    </span>
  )
}

// ---- useGlowField ----------------------------------------------------------
// Used when someone follows an "Open" link from the readiness checklist: the page gets ?focus=<field>, and the matching
// part of the form (an element marked data-field="<field>") scrolls into view and glows until they touch it.
export function useGlowField(field: string | null, ready: boolean, deps: unknown[] = []) {
  useEffect(() => {
    if (!field || !ready) return
    let el: HTMLElement | null = null
    const events = ['input', 'change', 'click']
    const clear = () => {
      el?.classList.remove('glow')
      events.forEach((e) => el?.removeEventListener(e, clear))
    }
    const frame = requestAnimationFrame(() => {
      el = document.querySelector<HTMLElement>(`[data-field="${field.replace(/[^a-z0-9-]/gi, '')}"]`)
      if (!el) return
      el.classList.add('glow')
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.querySelector<HTMLElement>('input, select, textarea')?.focus({ preventScroll: true })
      events.forEach((e) => el?.addEventListener(e, clear))
    })
    return () => { cancelAnimationFrame(frame); clear() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field, ready, ...deps])
}
