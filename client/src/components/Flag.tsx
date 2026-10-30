// Country flag from the two-letter code used in data/societies.ts (RW, KE, UG, TZ, BI, CD, SS).
// Decorative: the country name is always written next to it.
const urls = import.meta.glob('../assets/flags/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export default function Flag({ code }: { code: string }) {
  const src = urls[`../assets/flags/${code.toLowerCase()}.svg`]
  return src ? <img className="flag" src={src} alt="" width={24} height={16} /> : null
}
