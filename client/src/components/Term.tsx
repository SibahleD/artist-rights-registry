import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { byId } from '../data/glossary'

export default function Term({ id, children }: { id: string; children?: ReactNode }) {
  const entry = byId(id)
  if (!entry) return <>{children}</>
  return (
    <Link className="term" to={`/glossary#${id}`} title={entry.short} onClick={(e) => e.stopPropagation()}>
      {children ?? entry.term}
    </Link>
  )
}
