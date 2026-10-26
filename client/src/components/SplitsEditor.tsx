import { useState } from 'react'
import { COLLABORATOR_ROLES } from '../types'
import type { CollaboratorInput } from '../types'
import { WRITER_STATUSES, WRITER_STATUS_LABELS } from '../data/options'
import type { WriterStatus } from '../data/options'
import { sumPercent } from '../lib/collab'
import { Hint } from './ui'

// The credit rows for one song: legal name, role, share, email, and optional details. The total must reach 100%.
// `disabled` shows the rows read-only, for a release that is locked.
export default function SplitsEditor({ collaborators, onChange, disabled }: {
  collaborators: CollaboratorInput[]; onChange: (c: CollaboratorInput[]) => void; disabled?: boolean
}) {
  const [open, setOpen] = useState<Record<number, boolean>>({})
  const setCollab = (i: number, patch: Partial<CollaboratorInput>) => onChange(collaborators.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const total = sumPercent(collaborators)

  return (
    <fieldset className="plain-fieldset" disabled={disabled}>
      <div className="stack">
        {collaborators.map((c, i) => c.removedByWriter ? (
          <div className="row" key={i}>
            <span className="muted">Removed by writer: {c.ownershipPercent}% {c.discard ? 'will be freed on save' : 'is held until you discard this line'}</span>
            <button type="button" className="ghost" onClick={() => setCollab(i, { discard: !c.discard })}>{c.discard ? 'Keep' : 'Discard'}</button>
          </div>
        ) : (
          <div className="stack" key={i}>
            <div className="row">
              <input placeholder="Legal name" value={c.legalName} onChange={(e) => setCollab(i, { legalName: e.target.value })} />
              {c.isFeatured && <span className="badge">Featured</span>}
              <select value={c.role ?? 'songwriter'} disabled={!!c.isFeatured} title={c.isFeatured ? 'Featured artists are performers' : undefined} onChange={(e) => setCollab(i, { role: e.target.value as CollaboratorInput['role'] })}>
                {COLLABORATOR_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <input type="number" min={0} max={100} step="0.01" className="pct" placeholder="%" value={c.ownershipPercent || ''} onChange={(e) => setCollab(i, { ownershipPercent: Number(e.target.value) })} />
              <input type="email" placeholder="Email" value={c.invitedEmail ?? ''} onChange={(e) => setCollab(i, { invitedEmail: e.target.value })} />
              <button type="button" className="ghost" onClick={() => setOpen({ ...open, [i]: !open[i] })}>{open[i] ? 'Hide details' : 'Details'}</button>
              <button type="button" className="ghost" onClick={() => onChange(collaborators.filter((_, j) => j !== i))}>Remove</button>
            </div>
            {c.isFeatured && !(Number(c.ownershipPercent) > 0) && <Hint>Add their legal name if they will earn a share.</Hint>}
            {open[i] && (
              <div className="grid2">
                <label>IPI number (optional)<input inputMode="numeric" value={c.ipi ?? ''} onChange={(e) => setCollab(i, { ipi: e.target.value })} placeholder="9 to 11 digits" />
                  <Hint>Identifies a writer or publisher at rights societies. Only enter it if you have it.</Hint></label>
                <label>Rights society status
                  <select value={c.writerStatus ?? ''} onChange={(e) => setCollab(i, { writerStatus: (e.target.value || null) as WriterStatus | null })}>
                    <option value="">Not specified</option>
                    {WRITER_STATUSES.map((w) => <option key={w} value={w}>{WRITER_STATUS_LABELS[w]}</option>)}
                  </select>
                </label>
                <label>Publisher (optional)<input value={c.publisherName ?? ''} disabled={!!c.isSelfPublished} onChange={(e) => setCollab(i, { publisherName: e.target.value })} placeholder="Publishing company name" /></label>
                <label className="check-inline"><input type="checkbox" checked={!!c.isSelfPublished} onChange={(e) => setCollab(i, { isSelfPublished: e.target.checked, ...(e.target.checked ? { publisherName: '' } : {}) })} /> Self-published</label>
              </div>
            )}
          </div>
        ))}
        <div className="row between">
          <button type="button" className="ghost" onClick={() => onChange([...collaborators, { legalName: '', role: 'songwriter', ownershipPercent: 0 }])}>+ Add split holder</button>
          <strong className={total === 100 ? 'ok' : 'warn'}>Total: {total}%</strong>
        </div>
      </div>
    </fieldset>
  )
}
