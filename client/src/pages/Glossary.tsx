import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { byId, CATEGORIES, GLOSSARY, type GlossaryCategory } from '../data/glossary.ts'

export default function Glossary() {
  const { hash } = useLocation()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<GlossaryCategory | 'All'>('All')

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

      {items.length === 0 && <p className="muted">No terms match “{q}”.</p>}
      {items.map((g) => (
        <section key={g.id} id={g.id} className={`card glossary-entry${g.id === target ? ' on' : ''}`}>
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
        </section>
      ))}
    </div>
  )
}
