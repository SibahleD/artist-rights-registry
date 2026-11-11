import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { Hero } from '../components/ui'
import Performance from './Performance'
import Earnings from './Earnings'

type View = 'performance' | 'earnings'
const VIEWS: [View, string][] = [['performance', 'Performance'], ['earnings', 'Earnings']]

// One page for how the music is doing: streams (Performance) and what they are worth (Earnings).
// The section lives in the address (?view=earnings) so a link or a refresh lands on the same one.
export default function Metrics() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'earnings' ? 'earnings' : 'performance'
  const pick = (v: View) => setParams(v === 'performance' ? {} : { view: v }, { replace: true })
  return (
    <div className="performance">
      <Hero>
        <h1>Metrics</h1>
        <div className="sub">{user?.artist_name ? `Artist: ${user.artist_name}` : 'Streams and estimated earnings'}</div>
      </Hero>
      <div className="tabs perf-tabs" role="tablist" aria-label="Metrics sections">
        {VIEWS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={view === k} className={`tab${view === k ? ' on' : ''}`} onClick={() => pick(k)}>{label}</button>
        ))}
      </div>
      {view === 'performance' ? <Performance embedded /> : <Earnings embedded />}
    </div>
  )
}
