import { fmtCompact } from '../lib/format'

// Small inline-SVG charts, so there is no chart library to ship. They scale to the width of their container.

const PALETTE = ['var(--accent)', '#4fc3ff', '#ff8c42', '#8bd17c', '#94a3b8', '#f2c94c']

export interface Series { name: string; values: number[] }

// The y-axis is built from the highest value on the chart: whole-number steps (1, 2, 2.5, 5 or 10 times a power of ten),
// about four of them, and a top that is the first step at or above the highest value. So a chart peaking at 1,200 tops
// out at 1,250 rather than 2,000, and a chart peaking at 3 shows 0, 1, 2, 3 and never 0.75.
export function axisFor(max: number): { top: number; ticks: number[] } {
  if (!(max > 0)) return { top: 4, ticks: [0, 1, 2, 3, 4] }
  const raw = max / 4
  const p = 10 ** Math.floor(Math.log10(raw))
  const n = raw / p
  const step = Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 && p >= 10 ? 2.5 : n <= 5 ? 5 : 10) * p)
  const count = Math.ceil(max / step - 1e-9)
  return { top: count * step, ticks: Array.from({ length: count + 1 }, (_, i) => i * step) }
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
  const { top, ticks } = axisFor(Math.max(0, ...series.flatMap((s) => s.values)))
  const x = (i: number) => m.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v: number) => m.t + ih - (v / top) * ih
  const every = Math.max(1, Math.ceil(n / 8))

  if (n === 0) return <p className="muted">No data for this period.</p>
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <title>{label}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={m.l - 6} y={y(t) + 3.5} textAnchor="end" className="chart-axis">{format(t)}</text>
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
