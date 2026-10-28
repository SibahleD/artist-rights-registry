import { useSearchParams } from 'react-router-dom'
import Term from '../components/Term'
import SocietyTracker, { useSocieties } from '../components/SocietyTracker'
import TrackSocieties from '../components/TrackSocieties'
import RoyaltyInfo from '../components/RoyaltyInfo'
import { CHECKED } from '../data/societies'

const TABS = [['registrations', 'My registrations'], ['track', 'Track societies'], ['info', 'Info']] as const
type Tab = typeof TABS[number][0]
const isTab = (v: string | null): v is Tab => TABS.some(([k]) => k === v)

export default function RegisterRights() {
  const societies = useSocieties()
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: Tab = isTab(raw) ? raw : 'registrations'
  const setTab = (t: Tab) => setParams(t === 'registrations' ? {} : { tab: t }, { replace: true })

  return (
    <div className="stack">
      <h1>Register your rights</h1>
      <p className="muted">
        Streaming platforms pay the recording, but the <Term id="composition">composition</Term> is collected through a
        <Term id="cmo"> collecting society (PRO / CMO)</Term> in your country. Pick your country under Track societies and we will show which body applies
        and how to register. Guidance last checked {CHECKED}. This changes quickly, so confirm with the body before paying or signing.
      </p>

      <div className="tabs tabs-fill" role="tablist">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={`tab${tab === key ? ' on' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {/* All three stay mounted, so an edit in progress survives a tab switch. */}
      <div className="stack" hidden={tab !== 'registrations'}>
        <SocietyTracker societies={societies} onBrowse={() => setTab('track')} />
      </div>

      <div className="stack" hidden={tab !== 'track'}>
        <TrackSocieties societies={societies} onViewRegistrations={() => setTab('registrations')} />
      </div>

      <div className="stack" hidden={tab !== 'info'}>
        <RoyaltyInfo onFindSociety={() => setTab('track')} />
      </div>
    </div>
  )
}
