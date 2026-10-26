// Injected into the current tab only when you press a Fill button. It sets text boxes and drop-downs, nothing else:
// it never clicks, submits, ticks a box, uploads a file, or touches passwords, payment, bank or login fields.
(() => {
  const NEVER_TYPES = new Set(['password', 'file', 'hidden', 'checkbox', 'radio', 'submit', 'button', 'image', 'reset', 'email', 'tel'])
  const NEVER_WORDS = /password|passcode|card|cvv|cvc|iban|swift|routing|account\s*number|bank|tax|ssn|login|sign\s*in|e-?mail|phone|payment|promo|coupon/i

  const PATTERNS = {
    // release level
    title: { re: /(release|album|single|ep)\s*(title|name)|^\s*title\s*\*?$|name of (the )?release/i, not: /track|song|version/i },
    artist: { re: /(primary|main|display|release)?\s*artist(\s*name)?|performer/i, not: /featur|track|song|credit|writer|composer|producer|label/i },
    label: { re: /\blabel\b/i, not: /artist|track/i },
    genre: { re: /genre/i, not: /sub/i },
    releaseDate: { re: /(original\s*)?release\s*date|go[\s-]?live|street\s*date|date of release/i, not: /pre-?order/i },
    upc: { re: /\bupc\b|\bean\b|barcode/i },
    pLine: { re: /℗|\bp[\s-]?line\b|phonographic|sound\s*recording\s*copyright|master\s*copyright/i },
    cLine: { re: /©|\bc[\s-]?line\b|composition\s*copyright|publishing\s*copyright|^\s*copyright\s*\*?$/i },
    language: { re: /language/i, not: /lyrics\s*language\s*of\s*track/i },
    // track level
    trackTitle: { re: /(track|song)\s*(title|name)|^\s*song\s*\*?$/i },
    trackArtist: { re: /track\s*artist|song\s*artist/i },
    version: { re: /version|remix/i },
    isrc: { re: /\bisrc\b/i },
    iswc: { re: /\biswc\b/i },
    writers: { re: /songwriter|composer|writer|author/i, not: /publisher|ipi|share|percent|%/i },
    producers: { re: /producer/i, not: /publisher/i },
  }

  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()

  function describe(el) {
    const bits = []
    if (el.labels) for (const l of el.labels) bits.push(l.textContent)
    const aria = el.getAttribute('aria-label'); if (aria) bits.push(aria)
    const by = el.getAttribute('aria-labelledby')
    if (by) for (const id of by.split(/\s+/)) { const n = document.getElementById(id); if (n) bits.push(n.textContent) }
    bits.push(el.placeholder, el.name, el.id, el.title)
    return norm(bits.filter(Boolean).join(' | '))
  }

  function setValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)   // works with React and Vue controlled inputs
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function pickOption(sel, value) {
    const want = norm(value).toLowerCase()
    if (!want) return false
    const opts = [...sel.options]
    const hit = opts.find((o) => norm(o.textContent).toLowerCase() === want || o.value.toLowerCase() === want)
      || opts.find((o) => norm(o.textContent).toLowerCase().includes(want) || (want.includes(norm(o.textContent).toLowerCase()) && norm(o.textContent).length > 2))
    if (!hit) return false
    setValue(sel, hit.value)
    return true
  }

  function candidates() {
    return [...document.querySelectorAll('input, textarea, select')].filter((el) => {
      if (el.disabled || el.readOnly) return false
      if (el instanceof HTMLInputElement && NEVER_TYPES.has(el.type)) return false
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) return false
      return !NEVER_WORDS.test(describe(el))
    })
  }

  // payload: { scope: 'release' | 'track', values: { key: string }, extra: { key: {re, not} } }
  window.__registryFill = ({ values, extra }) => {
    const used = new Set()
    const filled = [], missed = []
    const els = candidates()
    for (const [key, value] of Object.entries(values)) {
      if (value === null || value === undefined || String(value).trim() === '') continue
      const pat = (extra && extra[key]) ? { re: new RegExp(extra[key].re, 'i'), not: extra[key].not ? new RegExp(extra[key].not, 'i') : null } : PATTERNS[key]
      if (!pat) continue
      const el = els.find((e) => !used.has(e) && pat.re.test(describe(e)) && !(pat.not && pat.not.test(describe(e))))
      if (!el) { missed.push(key); continue }
      let ok = true
      if (el instanceof HTMLSelectElement) ok = pickOption(el, value)
      else if (el.type === 'date') ok = /^\d{4}-\d{2}-\d{2}$/.test(value) && (setValue(el, value), true)
      else setValue(el, String(value))
      if (ok) { used.add(el); filled.push(key); el.style.outline = '2px solid #5b8def'; el.style.outlineOffset = '1px' }
      else missed.push(key)
    }
    return { filled, missed, url: location.hostname }
  }
})()
