import { useEffect, useState } from 'react'
import Term from '../components/Term'
import {
  BODY_LABEL, CHECKED, COUNTRIES, INTERNATIONAL, MONEY_TYPES, STATUS_LABEL,
} from '../data/societies'

const KEY = 'rights-country'

const read = () => { try { return localStorage.getItem(KEY) ?? '' } catch { return '' } }
const write = (v: string) => { try { localStorage.setItem(KEY, v) } catch { /* storage unavailable */ } }

export default function RegisterRights() {
  const [code, setCode] = useState(read)
  useEffect(() => { write(code) }, [code])
  const country = COUNTRIES.find((c) => c.code === code)

  return (
    <div className="stack">
      <h1>Register your rights</h1>
      <p className="muted">
        Streaming platforms pay the recording, but the <Term id="composition">composition</Term> is collected through a
        <Term id="cmo"> collecting society (PRO / CMO)</Term> in your country. Tell us where you are from and we will show which body applies
        and how to register. Guidance last checked {CHECKED}. This changes quickly, so confirm with the body before paying or signing.
      </p>

      <section className="card stack">
        <h4>What gets collected, and by whom</h4>
        {MONEY_TYPES.map((m) => (
          <p key={m.name}><strong>{m.name}</strong> — <em>{m.who}.</em> {m.detail}</p>
        ))}
      </section>

      <label>Where are you from?
        <select value={code} onChange={(e) => setCode(e.target.value)}>
          <option value="">Choose your country…</option>
          {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          <option value="other">Another country</option>
        </select>
      </label>

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
              <h3>{country.name}</h3>
              <span className={`badge ${country.status === 'working' ? 'confirmed' : country.status === 'none' ? 'disputed' : 'pending'}`}>
                {STATUS_LABEL[country.status]}
              </span>
            </div>
            <p><strong>{country.headline}</strong></p>
          </section>

          <section className="card stack">
            <h4>Who to deal with</h4>
            {country.bodies.map((b) => (
              <div key={b.name}>
                <div className="row between">
                  <strong>{b.name}{b.abbr ? ` (${b.abbr})` : ''}</strong>
                  <span className={`badge ${b.status === 'active' ? 'confirmed' : b.status === 'pending' || b.status === 'unclear' ? 'pending' : 'removed'}`}>{BODY_LABEL[b.status]}</span>
                </div>
                <p>{b.does}</p>
                {b.note && <p className="muted">{b.note}</p>}
                {b.website && <p><a href={b.website} target="_blank" rel="noreferrer">{b.website}</a></p>}
              </div>
            ))}
          </section>

          <section className="card stack">
            <h4>How to register, step by step</h4>
            <ol>{country.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            <p className="muted">
              Have these ready: each writer’s <Term id="legal-name">legal name</Term>, your confirmed <Term id="ownership-split">ownership splits</Term>,
              the song titles, and the recording. The release pages in this app hold all of this.
            </p>
          </section>

          <section className="card stack">
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
              <li key={o.name}><a href={o.url} target="_blank" rel="noreferrer">{o.name}</a>: {o.note}</li>
            ))}
          </ul>
          <p className="muted">{INTERNATIONAL.note}</p>
        </section>
      )}
    </div>
  )
}
