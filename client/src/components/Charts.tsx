import { fmtCompact } from '../lib/format'

// Small inline-SVG charts, so there is no chart library to ship. They scale to the width of their container.

const PALETTE = ['var(--accent)', '#4fc3ff', '#ff8c42', '#8bd17c', '#c792ea', '#f2c94c']

export interface Series { name: string; values: number[] }

// Rounds up to 1, 2, 5 or 10 times a power of ten, so axis labels land on tidy numbers.
function niceMax(v: number) {
  if (!(v > 0)) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}

interface LineProps {
  labels: string[]
  series: Series[]
  height?: number
  /** Axis label formatter. Defaults to compact numbers (1.2K, 3M). */
  format?: (n: number) => string
  /** Read out to screen readers, e.g. "Streams per month". */
  label: string
}

export function LineChart({ labels, series, height = 240, format = fmtCompact, label }: LineProps) {
  const W = 640, H = height
  const m = { l: 46, r: 12, t: 12, b: 28 }
  const iw = W - m.l - m.r, ih = H - m.t - m.b
  const n = labels.length
  const top = niceMax(Math.max(0, ...series.flatMap((s) => s.values)))
  const x = (i: number) => m.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v: number) => m.t + ih - (v / top) * ih
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  const every = Math.max(1, Math.ceil(n / 8))

  if (n === 0) return <p className="muted">No data for this period.</p>
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <title>{label}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t * top)} y2={y(t * top)} className="chart-grid" />
            <text x={m.l - 6} y={y(t * top) + 3.5} textAnchor="end" className="chart-axis">{format(t * top)}</text>
          </g>
        ))}
        {labels.map((l, i) => i % every === 0 && (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="chart-axis">{l}</text>
        ))}
        {series.map((s, k) => {
          const c = PALETTE[k % PALETTE.length]
          const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
          return (
            <g key={s.name}>
              <polyline points={pts} fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={n > 24 ? 0 : 3} fill={c}><title>{`${s.name}, ${labels[i]}: ${format(v)}`}</title></circle>)}
            </g>
          )
        })}
      </svg>
      {series.length > 1 && (
        <figcaption className="chart-legend">
          {series.map((s, k) => <span key={s.name}><i style={{ background: PALETTE[k % PALETTE.length] }} />{s.name}</span>)}
        </figcaption>
      )}
    </figure>
  )
}

interface BarsProps {
  items: { label: string; value: number }[]
  format?: (n: number) => string
}

// A ranked list of horizontal bars, for things like streams by platform.
export function BarList({ items, format = fmtCompact }: BarsProps) {
  const max = Math.max(1, ...items.map((i) => i.value))
  if (items.length === 0) return <p className="muted">No data for this period.</p>
  return (
    <ul className="bar-list">
      {items.map((it) => (
        <li key={it.label}>
          <span className="bar-label">{it.label}</span>
          <span className="bar-track"><span className="bar-fill" style={{ width: `${Math.max(1, (it.value / max) * 100)}%` }} /></span>
          <span className="bar-value">{format(it.value)}</span>
        </li>
      ))}
    </ul>
  )
}
