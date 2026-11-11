import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { byId } from '../data/glossary'
import { CHECKED, MONEY_TYPES, type MoneySide } from '../data/societies'
import { loadProgress, setGlossaryStatus, useGlossaryProgress } from '../lib/glossaryProgress'
import { MoneyFlowDiagram, RightsDiagram } from './RoyaltyDiagrams'
import './royaltyInfo.css'

// ---- RoyaltyInfo -----------------------------------------------------------
// The Info tab on the Royalties page: a plain-language explainer of where music money comes from and who collects it.
// The royalty types come from MONEY_TYPES (data/societies.ts) and every term links to, and takes its short definition
// from, the glossary, so the wording is defined once and cannot drift.

const SIDE_LABEL: Record<MoneySide, string> = {
  recording: 'Recording side',
  composition: 'Song side',
  either: 'Both sides',
}

type Filter = 'all' | MoneySide

const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['recording', SIDE_LABEL.recording],
  ['composition', SIDE_LABEL.composition],
  ['either', SIDE_LABEL.either],
]

const ofSide = (side: MoneySide) => MONEY_TYPES.filter((m) => m.side === side)

function TermList({ side }: { side: MoneySide }) {
  return (
    <ul>
      {ofSide(side).map((m) => <li key={m.term}><Term id={m.term}>{m.name}</Term></li>)}
    </ul>
  )
}

export function RoyaltyInfo({ onFindSociety }: { onFindSociety: () => void }) {
  const [filter, setFilter] = useState<Filter>('all')
  const shown = filter === 'all' ? MONEY_TYPES : ofSide(filter)

  return (
    <>
      <section className="card stack">
        <h3>One song, two sets of rights</h3>
        <RightsDiagram />
        <div className="info-sides">
          <div className="option">
            <h5>The <Term id="sound-recording">recording</Term></h5>
            <TermList side="recording" />
          </div>
          <div className="option">
            <h5>The <Term id="composition">song itself</Term></h5>
            <TermList side="composition" />
          </div>
        </div>
        <p className="muted">
          {ofSide('either').map((m, i) => <span key={m.term}>{i > 0 && ', '}<Term id={m.term}>{m.name}</Term></span>)}{' '}
          involve both sides, because a deal needs both owners to agree.
        </p>
      </section>

      <section className="card stack">
        <h4>What happens when someone streams your song</h4>
        <MoneyFlowDiagram />
        <p className="muted">
          Your <Term id="distributor">distributor</Term> handles the recording side. A <Term id="cmo">collecting society</Term> handles the song side,
          and only after <Term id="work-registration">work registration</Term>. Who pays whom, and how much, varies by platform and country.
        </p>
      </section>

      <section className="card stack">
        <h4>At a glance</h4>
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Royalty</th><th>Side</th><th>Collected by</th><th>Paid to</th></tr>
            </thead>
            <tbody>
              {MONEY_TYPES.map((m) => (
                <tr key={m.term}>
                  <td><Term id={m.term}>{m.name}</Term></td>
                  <td>{SIDE_LABEL[m.side]}</td>
                  <td>{m.who}</td>
                  <td>{m.paidTo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack">
        <h4>What gets collected, and by whom</h4>
        <div className="info-filter" role="group" aria-label="Show royalty types for">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`tab${filter === key ? ' on' : ''}`}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {label}{key === 'all' ? ` (${MONEY_TYPES.length})` : ` (${ofSide(key).length})`}
            </button>
          ))}
        </div>
        {shown.map((m) => (
          <div key={m.term} className="info-money">
            <div className="info-money-head">
              <h5><Term id={m.term}>{m.name}</Term></h5>
              <span className={`badge side-${m.side}`}>{SIDE_LABEL[m.side]}</span>
            </div>
            <p>{m.detail}</p>
            <details className="info-more">
              <summary>Example and what you do</summary>
              <p className="muted"><strong>For example:</strong> {m.example}</p>
              <p className="info-action"><strong>What you do:</strong> {m.action}</p>
            </details>
          </div>
        ))}
      </section>

      <section className="card stack">
        <h4>Common mix-ups</h4>
        <ul className="info-mixups">
          <li>Your distributor does not register your songs with a society. Those are two separate jobs.</li>
          <li>An <Term id="isrc">ISRC</Term> identifies the recording. An <Term id="iswc">ISWC</Term> identifies the song.</li>
          <li>Agree each writer's share in writing first, on a <Term id="split-sheet">split sheet</Term>. A wrong <Term id="ownership-split">split</Term> is hard to fix later.</li>
          <li>A cover is someone else's song, so get the <Term id="cover-license">licence</Term> before you release it.</li>
          <li>Titles, writer names and codes must match everywhere a song is registered, or payments get held up.</li>
        </ul>
        <p className="muted">Society details last checked {CHECKED}. This changes quickly, so confirm with the body before paying or signing.</p>
        <div className="row actions">
          <button type="button" onClick={onFindSociety}>Find my society</button>
          <Link className="btn secondary" to="/glossary">Open the glossary</Link>
        </div>
      </section>
    </>
  )
}

// ---- Term ------------------------------------------------------------------
// A glossary word inside running text: a plain coloured link (no underline) that opens a small card on hover or focus
// with the short meaning and a button to mark it as understood. The card is fixed-position so a table or a scrolling
// box around the word can never clip it.
const POP_W = 300

export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const entry = byId(id)
  const progress = useGlossaryProgress()
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null)
  const wrap = useRef<HTMLSpanElement>(null)
  const timer = useRef<number>(0)
  useEffect(() => { void loadProgress() }, [])
  useEffect(() => {
    if (!pos) return
    const close = () => setPos(null)
    window.addEventListener('scroll', close, true)
    return () => window.removeEventListener('scroll', close, true)
  }, [pos])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  if (!entry) return <>{children}</>

  const understood = progress[id] === 'understood'
  const open = () => {
    window.clearTimeout(timer.current)
    const r = wrap.current?.getBoundingClientRect()
    if (!r) return
    const left = Math.max(8, Math.min(r.left, window.innerWidth - POP_W - 8))
    setPos(r.bottom > window.innerHeight - 190 ? { left, bottom: window.innerHeight - r.top + 6 } : { left, top: r.bottom + 6 })
  }
  const closeSoon = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setPos(null), 150) }

  return (
    <span ref={wrap} className={`term-wrap${understood ? ' understood' : ''}`} onMouseEnter={open} onMouseLeave={closeSoon} onFocus={open} onBlur={closeSoon}>
      <Link className="term" to={`/glossary#${id}`} onClick={(e) => e.stopPropagation()}>{children ?? entry.term}</Link>
      {pos && (
        <span className="term-pop" role="tooltip" style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: POP_W }}>
          <strong>{entry.term}</strong>
          <span>{entry.short}</span>
          <span className="term-pop-actions">
            <button type="button" className={`mark understood${understood ? ' on' : ''}`} aria-pressed={understood}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); void setGlossaryStatus(id, understood ? null : 'understood').catch(() => {}) }}>
              {understood ? 'Understood ✓' : 'Mark as understood'}
            </button>
            <Link to={`/glossary#${id}`} onClick={(e) => e.stopPropagation()}>Read more</Link>
          </span>
        </span>
      )}
    </span>
  )
}
