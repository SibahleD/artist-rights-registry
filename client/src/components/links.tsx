import { blankRow, OTHER, SERVICES, serviceById, type LinkKind, type LinkRow } from '../data/services'
import { Note } from './ui'
import type { ReleaseLink } from '../types'

// ---- LinkRows --------------------------------------------------------------
// The one editor for artist links and release store links: [service dropdown] [URL] [Remove], an Add button, and a
// button that opens the service's own artist dashboard when it has one. `rows` is the whole list; only rows whose kind
// is in `kinds` are shown, so one list can feed several sections (Streaming and Social on the profile).
export function LinkRows({ rows, onChange, kinds, addLabel = 'Add link', minRows = 0, max, showDashboards = true }: {
  rows: LinkRow[]
  onChange: (rows: LinkRow[]) => void
  kinds: readonly LinkKind[]
  addLabel?: string
  minRows?: number
  max?: number
  showDashboards?: boolean   // the service dashboard buttons belong on the Artist Profile, not on a release
}) {
  const shown = rows.map((row, i) => ({ row, i })).filter(({ row }) => kinds.includes(row.kind))
  const options = SERVICES.filter((s) => kinds.includes(s.kind))
  const set = (i: number, patch: Partial<LinkRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const pick = (i: number, id: string) => {
    const s = serviceById(id)
    set(i, { service: id, kind: s ? s.kind : rows[i].kind, label: id === OTHER ? rows[i].label : '' })
  }
  const dashboards = !showDashboards ? [] : [...new Map(shown.flatMap(({ row }) => {
    const s = serviceById(row.service)
    return s?.dashboardUrl ? [[s.dashboardUrl, s] as const] : []
  })).values()]

  return (
    <div className="stack">
      {shown.map(({ row, i }) => (
        <div className="link-row" key={row.id ?? `new-${i}`}>
          <div className="stack">
            <select aria-label="Service" value={row.service} onChange={(e) => pick(i, e.target.value)}>
              <option value="">Choose a service</option>
              {options.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              <option value={OTHER}>Other…</option>
            </select>
            {row.service === OTHER && (
              <input aria-label="Name" value={row.label} maxLength={60} placeholder="Name, for example My website" onChange={(e) => set(i, { label: e.target.value })} />
            )}
          </div>
          <input aria-label="Web address" value={row.url} placeholder="https://…" onChange={(e) => set(i, { url: e.target.value })} />
          <button type="button" className="ghost" aria-label="Remove link" title="Remove link" disabled={shown.length <= minRows} onClick={() => onChange(rows.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="row">
        <button type="button" className="ghost" disabled={max !== undefined && rows.length >= max} onClick={() => onChange([...rows, blankRow(kinds[0])])}>+ {addLabel}</button>
        {dashboards.map((s) => (
          <a key={s.dashboardUrl} className="btn secondary" href={s.dashboardUrl} target="_blank" rel="noopener noreferrer">Open {s.dashboardLabel}</a>
        ))}
      </div>
      {dashboards.length > 0 && (
        <Note>The dashboard buttons open each service's own sign-in in a new tab. Claim your artist profile there to see your stats. We never ask for or store your password for these services.</Note>
      )}
    </div>
  )
}

// ---- StoreButtons ----------------------------------------------------------
// Logos live in src/assets/streaming/<service id>.svg (see the README there). A missing file is fine: the button shows the name alone.
const logos = import.meta.glob('../assets/streaming/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const logoFor = (id: string) => logos[`../assets/streaming/${id}.svg`]

function describe(store: string) {
  const name = store.trim()
  const service = SERVICES.find((s) => s.label.toLowerCase() === name.toLowerCase())
  return { label: service?.label ?? name, logo: service ? logoFor(service.id) : logoFor('other') }
}

// One button per store the release is live on: the store's logo with its name beside it.
export function StoreButtons({ links }: { links: ReleaseLink[] }) {
  return (
    <div className="store-buttons">
      {links.map((l) => {
        const { label, logo } = describe(l.store)
        return (
          <a key={l.url} className="store-btn" href={l.url} target="_blank" rel="noopener noreferrer" aria-label={`Open on ${label}`} title={`Open on ${label}`}>
            {logo && <img src={logo} alt="" />}
            <span className="store-name">{label}</span>
          </a>
        )
      })}
    </div>
  )
}
