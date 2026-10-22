import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../api'
import { byId, CATEGORIES, GLOSSARY, type GlossaryCategory } from '../data/glossary.ts'

type Status = 'understood' | 'learning'
type Progress = Record<string, Status>

export default function Glossary() {
  const { hash } = useLocation()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<GlossaryCategory | 'All'>('All')
  const [progress, setProgress] = useState<Progress>({})
  const [err, setErr] = useState('')

  useEffect(() => {
    api<{ progress: Progress }>('/glossary/progress').then((r) => setProgress(r.progress)).catch(() => {})
  }, [])

  // Tapping the status a card already has clears it. The card updates first; if saving fails it goes back.
  async function mark(id: string, status: Status) {
    const before = progress[id]
    const next = before === status ? null : status
    setErr('')
    setProgress((p) => {
      const { [id]: _, ...rest } = p
      return next ? { ...rest, [id]: next } : rest
    })
    try {
      await api(`/glossary/progress/${id}`, 'PUT', { status: next })
    } catch (e) {
      setProgress((p) => {
        const { [id]: _, ...rest } = p
        return before ? { ...rest, [id]: before } : rest
      })
      setErr((e as Error).message)
    }
  }

  const items = useMemo(() => {
    const s = q.trim().toLowerCase()
    return GLOSSARY
      .filter((g) => cat === 'All' || g.category === cat)
      .filter((g) => !s || `${g.term} ${g.short} ${g.details}`.toLowerCase().includes(s))
      .sort((a, b) => a.term.localeCompare(b.term))
  }, [q, cat])

  const target = hash.slice(1)
  useEffect(() => {
    if (!target) return
    setQ(''); setCat('All')
    const t = setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    return () => clearTimeout(t)
  }, [target])

  const understood = GLOSSARY.filter((g) => progress[g.id] === 'understood').length
  const learning = GLOSSARY.filter((g) => progress[g.id] === 'learning').length

  return (
    <div className="stack">
      <h1>Glossary</h1>
      <p className="muted">Plain-language meanings for the terms you will meet when releasing music. This is general guidance: always check the rules of your distributor and your collecting society.</p>

      <input type="search" placeholder="Search terms…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="tabs">
        {(['All', ...CATEGORIES] as const).map((c) => (
          <button key={c} className={c === cat ? 'tab on' : 'tab'} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <p className="muted glossary-tally" role="status">
        <span className="tally-dot understood" /> {understood} understood
        <span className="tally-dot learning" /> {learning} still learning
        <span className="muted"> of {GLOSSARY.length} terms</span>
      </p>
      {err && <p className="error" role="alert">{err}</p>}

      {items.length === 0 && <p className="muted">No terms match “{q}”.</p>}
      <div className="glossary-grid">
        {items.map((g) => {
          const st = progress[g.id]
          return (
            <section key={g.id} id={g.id} className={`glass-card glossary-entry${st ? ` ${st}` : ''}${g.id === target ? ' on' : ''}`}>
              <div className="row between">
                <h3>{g.term}</h3>
                <span className="badge">{g.category}</span>
              </div>
              <p><strong>{g.short}</strong></p>
              <p>{g.details}</p>
              {g.example && <p className="muted">Example: {g.example}</p>}
              {g.why && <p><em>Why it matters:</em> {g.why}</p>}
              {g.related && g.related.length > 0 && (
                <p className="muted">See also: {g.related.map((r) => byId(r)).filter(Boolean).map((r, i) => (
                  <span key={r!.id}>{i > 0 && ', '}<Link to={`/glossary#${r!.id}`}>{r!.term}</Link></span>
                ))}</p>
              )}
              <div className="glass-actions" role="group" aria-label={`Mark “${g.term}”`}>
                <button type="button" className={`mark understood${st === 'understood' ? ' on' : ''}`} aria-pressed={st === 'understood'} onClick={() => void mark(g.id, 'understood')}>I understand this</button>
                <button type="button" className={`mark learning${st === 'learning' ? ' on' : ''}`} aria-pressed={st === 'learning'} onClick={() => void mark(g.id, 'learning')}>Still learning</button>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
