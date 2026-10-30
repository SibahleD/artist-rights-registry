import { useState } from 'react'
import { Link } from 'react-router-dom'
import Term from './Term'
import { byId } from '../data/glossary'
import { CHECKED, MONEY_TYPES, type MoneySide } from '../data/societies'
import './royaltyInfo.css'

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

// Terms defined at the bottom of the tab: the ones used above, plus every royalty type, without repeats.
const DEFINED = [
  ...new Set(['composition', 'sound-recording', 'publisher', 'cmo', 'work-registration', 'ownership-split', 'split-sheet', 'isrc', 'iswc', ...MONEY_TYPES.map((m) => m.term)]),
].filter((id) => byId(id))

function TermList({ side }: { side: MoneySide }) {
  return (
    <ul>
      {ofSide(side).map((m) => <li key={m.term}><Term id={m.term}>{m.name}</Term></li>)}
    </ul>
  )
}

export default function RoyaltyInfo({ onFindSociety }: { onFindSociety: () => void }) {
  const [filter, setFilter] = useState<Filter>('all')
  const shown = filter === 'all' ? MONEY_TYPES : ofSide(filter)

  return (
    <>
      <section className="card stack">
        <h3>One song, two sets of rights</h3>
        <p>
          Every released song is really two things, and each one earns its own money.
        </p>
        <div className="info-sides">
          <div className="option">
            <h5>The recording</h5>
            <p className="muted">
              The <Term id="sound-recording">sound recording</Term> is one particular performance of the song, captured and finished.
              It is owned by whoever paid for or made it, which is often you.
            </p>
            <strong>Money that belongs here</strong>
            <TermList side="recording" />
          </div>
          <div className="option">
            <h5>The song itself</h5>
            <p className="muted">
              The <Term id="composition">composition</Term> is the song as written: the melody and the words. It is owned by its writers
              and often a <Term id="publisher">publisher</Term>.
            </p>
            <strong>Money that belongs here</strong>
            <TermList side="composition" />
          </div>
        </div>
        <p className="muted">
          {ofSide('either').map((m, i) => <span key={m.term}>{i > 0 && ', '}<Term id={m.term}>{m.name}</Term></span>)}{' '}
          can involve both sides at once, because a deal needs the owner of the song and the owner of the recording to agree.
        </p>
      </section>

      <section className="card stack">
        <h4>What happens when someone streams your song</h4>
        <ol className="info-steps">
          <li>A listener streams your song on a music app.</li>
          <li>
            The app pays for the recording. That money goes to your <Term id="distributor">distributor</Term>, who passes it on to you
            after any fee they charge.
          </li>
          <li>
            The app also has to pay for the song itself. That money is meant for the writers and publishers, and it is normally collected
            by a <Term id="cmo">collecting society</Term>, not by your distributor.
          </li>
          <li>
            If the song was never registered, or the details do not match, the second payment can be hard to claim.
            Registering is called <Term id="work-registration">work registration</Term>.
          </li>
        </ol>
        <p className="muted">This is the shape of it, not the numbers. Who pays whom, and how much, varies by platform and by country.</p>
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
            <p><strong>Collected by:</strong> {m.who}. <strong>Paid to:</strong> {m.paidTo}.</p>
            <p className="muted"><strong>For example:</strong> {m.example}</p>
            <p className="info-action"><strong>What you do:</strong> {m.action}</p>
          </div>
        ))}
      </section>

      <section className="card stack">
        <h4>Common mix-ups</h4>
        <p>
          <strong>Your distributor does not register your songs with a society.</strong> Getting a song onto streaming services and registering it
          for composition royalties are two separate jobs.
        </p>
        <p>
          <strong>An <Term id="isrc">ISRC</Term> and an <Term id="iswc">ISWC</Term> are not the same.</strong> The first identifies the recording, the
          second identifies the song.
        </p>
        <p>
          <strong>Splits decide who gets paid.</strong> Agree each writer's share in writing before you register, using a
          {' '}<Term id="split-sheet">split sheet</Term>, because a wrong split is hard to fix once money is flowing. See also{' '}
          <Term id="ownership-split">ownership split</Term>.
        </p>
        <p>
          <strong>A cover song is someone else's composition.</strong> Make sure you have the right to use it before you release it
          (see <Term id="cover-license">cover and mechanical licence</Term>).
        </p>
        <p>
          <strong>Matching details matter.</strong> Titles, writer names and codes need to be the same everywhere a song is registered, or payments can
          be held up.
        </p>
      </section>

      <section className="card stack">
        <h4>Words used on this page</h4>
        <dl className="info-defs">
          {DEFINED.map((id) => {
            const e = byId(id)!
            return [<dt key={`${id}-t`}><Term id={id}>{e.term}</Term></dt>, <dd key={`${id}-d`}>{e.short}</dd>]
          })}
        </dl>
        <p className="muted">Society details last checked {CHECKED}. This changes quickly, so confirm with the body before paying or signing.</p>
        <div className="row actions">
          <button type="button" onClick={onFindSociety}>Find my society</button>
          <Link className="btn secondary" to="/glossary">Open the glossary</Link>
        </div>
      </section>
    </>
  )
}
