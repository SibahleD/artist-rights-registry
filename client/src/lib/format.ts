// Number formatting shared by the Performance and Earnings pages and by PDF exports.

const int = new Intl.NumberFormat('en-US')
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

export const fmtInt = (n: number) => int.format(Math.round(n))
export const fmtCompact = (n: number) => compact.format(n)

/** Money with enough decimals to be useful for per-stream amounts: 1234.5 -> $1,234.50, 0.0042 -> $0.0042. */
export function fmtMoney(n: number, currency = 'USD'): string {
  const digits = Math.abs(n) >= 1 ? 2 : Math.abs(n) >= 0.01 ? 3 : 4
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: digits === 2 ? 2 : digits, maximumFractionDigits: digits }).format(n)
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "2026-09-01" -> "September 2026" (no time zone maths, so it never slips a day). */
export function fmtMonth(period: string, short = false): string {
  const [y, m] = period.split('-').map(Number)
  const name = MONTHS[(m ?? 1) - 1] ?? ''
  return `${short ? name.slice(0, 3) : name} ${y}`
}

/** Only plain web addresses are ever rendered as links; anything else (javascript:, data:, empty) becomes undefined. */
export const safeHref = (u?: string | null) => (u && /^https?:\/\//i.test(u) ? u : undefined)
