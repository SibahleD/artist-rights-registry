import { SERVICES } from '../data/services'
import type { ReleaseLink } from '../types'

// Logos live in src/assets/streaming/<service id>.svg (see the README there). A missing file is fine: the button shows the name alone.
const logos = import.meta.glob('../assets/streaming/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const logoFor = (id: string) => logos[`../assets/streaming/${id}.svg`]

function describe(store: string) {
  const name = store.trim()
  const service = SERVICES.find((s) => s.label.toLowerCase() === name.toLowerCase())
  return { label: service?.label ?? name, logo: service ? logoFor(service.id) : logoFor('other') }
}

// One button per store the release is live on: the store's logo with its name beside it.
export default function StoreButtons({ links }: { links: ReleaseLink[] }) {
  return (
    <div className="store-buttons">
      {links.map((l) => {
        const { label, logo } = describe(l.store)
        return (
          <a key={l.url} className="store-btn" href={l.url} target="_blank" rel="noopener noreferrer" aria-label={`Open on ${label}`} title={`Open on ${label}`}>
            {logo && <img src={logo} alt="" />}
            <span className="store-name">{label}</span>
          </a>
        )
      })}
    </div>
  )
}
