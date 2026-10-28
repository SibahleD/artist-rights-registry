import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Term from './Term'
import type { Societies } from './SocietyTracker'
import {
  BODY_LABEL, CHECKED, COUNTRIES, INTERNATIONAL, NEXT_STEP, READY_LIST, STATUS_LABEL,
} from '../data/societies'

const KEY = 'rights-country'
const read = () => { try { return localStorage.getItem(KEY) ?? '' } catch { return '' } }
const write = (v: string) => { try { localStorage.setItem(KEY, v) } catch { /* storage unavailable */ } }
const safeHref = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : undefined)

// A guide for someone who has never registered with a society: pick a country, see where things stand,
// know what to prepare, then follow the steps. Everything here comes from the country guide in data/societies.ts.
export default function TrackSocieties({ societies, onViewRegistrations }: { societies: Societies; onViewRegistrations: () => void }) {
  const [code, setCode] = useState(read)
  useEffect(() => { write(code) }, [code])
  const [error, setError] = useState('')
  const [added, setAdded] = useState('')
  const country = COUNTRIES.find((c) => c.code === code)

  function track(name: string, cc: string) {
    setError(''); setAdded('')
    societies.add({ body_name: name, country: cc }).then(() => setAdded(name)).catch((e: Error) => setError(e.message))
  }
  const pick = (v: string) => { setCode(v); setError(''); setAdded('') }

  return (
    <>
      <section className="card stack">
        <h3>Step 1: where are you based?</h3>
        <p className="muted">Pick the country you live in or where your songs are mostly registered. We will show which body applies. Guidance last checked {CHECKED}.</p>
        <label>Country
          <select value={code} onChange={(e) => pick(e.target.value)}>
            <option value="">Choose your country…</option>
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            <option value="other">Another country</option>
          </select>
        </label>
      </section>

      {code === 'other' && (
        <section className="card stack">
          <p>We have not researched your country yet (Ethiopia, Somalia, Djibouti and Eritrea are not covered). Ask your country’s copyright office
            which society is licensed, then use the international options below in the meantime.</p>
        </section>
      )}

      {country && (
        <>
          <section className="card stack">
            <div className="row between">
              <h3>Step 2: where things stand in {country.name}</h3>
              <span className={`badge ${country.status === 'working' ? 'confirmed' : country.status === 'none' ? 'disputed' : 'pending'}`}>
                {STATUS_LABEL[country.status]}
              </span>
            </div>
            <p><strong>{country.headline}</strong></p>
            <div className="society-row">
              <strong>{NEXT_STEP[country.status].title}</strong>
              <p>{NEXT_STEP[country.status].text}</p>
            </div>
          </section>

          <section className="card stack">
            <h3>Step 3: who to deal with</h3>
            {error && <p className="error" role="alert">{error}</p>}
            {added && (
              <p role="status">
                Added {added} to your list. <button type="button" className="linklike" onClick={onViewRegistrations}>See my registrations</button>
              </p>
            )}
            {country.bodies.map((b) => {
              const site = safeHref(b.website)
              return (
                <div key={b.name} className="society-row">
                  <div className="row between">
                    <strong>{b.name}{b.abbr ? ` (${b.abbr})` : ''}</strong>
                    <span className={`badge ${b.status === 'active' ? 'confirmed' : b.status === 'pending' || b.status === 'unclear' ? 'pending' : 'removed'}`}>{BODY_LABEL[b.status]}</span>
                  </div>
                  <p>{b.does}</p>
                  {b.note && <p className="muted">{b.note}</p>}
                  {site && <p><a href={site} target="_blank" rel="noopener noreferrer">{site}</a></p>}
                  {b.status !== 'dissolved' && societies.list && (societies.tracked(b.name, country.code)
                    ? <p className="muted">On your list.</p>
                    : <p><button type="button" className="secondary" onClick={() => track(b.name, country.code)}>Track this body</button></p>)}
                </div>
              )
            })}
          </section>

          <section className="card stack">
            <h3>Step 4: get ready</h3>
            <p>Have these to hand before you apply anywhere:</p>
            <ul>{READY_LIST.map((r) => <li key={r}>{r}</li>)}</ul>
            <p className="muted">
              The release pages in this app hold the <Term id="legal-name">legal names</Term> and <Term id="ownership-split">ownership splits</Term>.
              Not confirmed yet? Start from your <Link to="/discography">discography</Link>.
            </p>
          </section>

          <section className="card stack">
            <h3>Step 5: how to register</h3>
            <ol>{country.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            <h4>Watch out for</h4>
            <ul>{country.watchOut.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </section>
        </>
      )}

      {code && (
        <section className="card stack">
          <h4>International options</h4>
          <p>{INTERNATIONAL.intro}</p>
          <ul>
            {INTERNATIONAL.options.map((o) => (
              <li key={o.name}><a href={o.url} target="_blank" rel="noopener noreferrer">{o.name}</a>: {o.note}</li>
            ))}
          </ul>
          <p className="muted">{INTERNATIONAL.note}</p>
        </section>
      )}
    </>
  )
}
