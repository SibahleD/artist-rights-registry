// Injected into the current tab only when you press a Fill button.
// It sets text boxes and drop-downs. Beyond that it does exactly two more things, and only when the popup asks for them:
//   1. picks a yes/no (or similar) radio button in a group whose label matches a field the popup is sending, and
//   2. presses an "Add artist" / "Add composer" style button so there are enough rows for the names it is sending.
// It never submits, ticks terms or consent boxes, uploads files, or touches passwords, payment, bank or login fields.
(() => {
  const NEVER_TYPES = new Set(['password', 'file', 'hidden', 'checkbox', 'radio', 'submit', 'button', 'image', 'reset', 'email', 'tel'])
  const NEVER_WORDS = /password|passcode|card|cvv|cvc|iban|swift|routing|account\s*number|bank|tax|ssn|login|sign\s*in|e-?mail|phone|payment|promo|coupon/i
  const CONSENT_WORDS = /terms|agree|accept|consent|licen[cs]e|warrant|confirm that|i (own|have the rights)/i
  const CLICK_DENY = /submit|pay|publish|finish|delete|remove|continue|next|save|agree|accept|upload|sign|log\s*in|release now|send/i

  const PATTERNS = {
    // release level
    title: { re: /(release|album|single|ep)\s*(title|name)|^\s*title\s*\*?$|name of (the )?release/i, not: /track|song|version/i },
    artist: { re: /(primary|main|display|release)?\s*artist(\s*name)?|performer/i, not: /featur|track|song|credit|writer|composer|producer|label/i },
    label: { re: /\blabel\b/i, not: /artist|track/i },
    genre: { re: /genre/i, not: /sub|second/i },
    secondaryGenre: { re: /(secondary|second)\s*genre|genre\s*2/i },
    releaseDate: { re: /(original\s*)?release\s*date|go[\s-]?live|street\s*date|date of release/i, not: /pre-?order/i },
    originallyReleased: { re: /originally\s*released|original\s*release\s*date/i },
    preorderDate: { re: /pre-?order\s*(start\s*)?date/i },
    salesStartDate: { re: /sales?\s*start|start\s*(of\s*)?sales?/i },
    albumVersion: { re: /(album|release)\s*version/i, not: /track|song/i },
    upc: { re: /\bupc\b|\bean\b|barcode/i },
    pLine: { re: /℗|\bp[\s-]?line\b|phonographic|sound\s*recording\s*copyright|master\s*copyright/i },
    cLine: { re: /©|\bc[\s-]?line\b|composition\s*copyright|publishing\s*copyright|^\s*copyright\s*\*?$/i },
    language: { re: /language/i, not: /lyrics\s*language\s*of\s*track/i },
    // track level
    trackTitle: { re: /(track|song)\s*(title|name)|^\s*song\s*\*?$/i },
    trackArtist: { re: /track\s*artist|song\s*artist/i },
    version: { re: /version|remix/i, not: /album|release/i },
    isrc: { re: /\bisrc\b/i },
    iswc: { re: /\biswc\b/i },
    previewStart: { re: /preview\s*(start|time|clip)|clip\s*start/i },
    writers: { re: /songwriter|composer|writer|author/i, not: /publisher|ipi|share|percent|%/i },
    producers: { re: /producer/i, not: /publisher|title|role/i },
  }

  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const visible = (el) => { const r = el.getBoundingClientRect(); return !(r.width === 0 && r.height === 0) }
  const rx = (o) => (o ? { re: new RegExp(o.re, 'i'), not: o.not ? new RegExp(o.not, 'i') : null } : null)
  const matches = (pat, text) => pat.re.test(text) && !(pat.not && pat.not.test(text))

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

  const mark = (el) => { el.style.outline = '2px solid #5b8def'; el.style.outlineOffset = '1px' }

  function candidates() {
    return [...document.querySelectorAll('input, textarea, select')].filter((el) => {
      if (el.disabled || el.readOnly) return false
      if (el instanceof HTMLInputElement && NEVER_TYPES.has(el.type)) return false
      if (!visible(el)) return false
      return !NEVER_WORDS.test(describe(el))
    })
  }

  function fillOne(el, value) {
    if (el instanceof HTMLSelectElement) return pickOption(el, value)
    if (el.type === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(value) && (setValue(el, value), true)
    setValue(el, String(value)); return true
  }

  // ---- Radio groups -----------------------------------------------------------------------------------------------
  function optionText(r) {
    const t = r.labels && r.labels.length ? [...r.labels].map((l) => l.textContent).join(' ') : (r.nextSibling && r.nextSibling.textContent) || r.parentElement?.textContent || ''
    return norm(t) || r.value
  }
  function groupLabel(r) {
    const box = r.closest('fieldset, [role=radiogroup]') || r.closest('div, p, li') || r.parentElement
    const bits = []
    const legend = box?.querySelector(':scope > legend'); if (legend) bits.push(legend.textContent)
    const aria = box?.getAttribute('aria-label'); if (aria) bits.push(aria)
    const by = box?.getAttribute('aria-labelledby')
    if (by) for (const id of by.split(/\s+/)) { const n = document.getElementById(id); if (n) bits.push(n.textContent) }
    const lead = box?.firstElementChild
    if (lead && !lead.querySelector('input') && !(lead instanceof HTMLInputElement)) bits.push(lead.textContent)
    bits.push(r.name)
    return norm(bits.join(' | '))
  }
  function radioGroups() {
    const groups = new Map()
    for (const r of document.querySelectorAll('input[type=radio]')) {
      if (r.disabled || !visible(r)) continue
      const k = r.name || groupLabel(r)
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k).push(r)
    }
    return [...groups.values()]
  }

  // ---- Buttons ----------------------------------------------------------------------------------------------------
  function findAddButton(addPat) {
    return [...document.querySelectorAll('button, a[role=button], input[type=button]')].find((b) => {
      if (b.disabled || !visible(b)) return false
      if (b.tagName === 'BUTTON' && b.type === 'submit') return false
      const text = norm(b.textContent || b.value || b.getAttribute('aria-label'))
      return text && addPat.test(text) && !CLICK_DENY.test(text)
    })
  }

  // payload: { values: { key: string }, extra: {...patterns...}, choices: { key: answer }, lists: { key: [{ name, title? }] } }
  // extra: { <textKey>: {re, not}, choices: { key: { group: {re, not}, options: { answer: regexSource } } },
  //          lists: { key: { name: {re, not}, title?: {re, not}, add: regexSource } } }
  window.__registryFill = async ({ values = {}, extra = {}, choices = {}, lists = {} }) => {
    const used = new Set()
    const filled = [], missed = []
    let clicks = 0

    // 1. Text boxes and drop-downs
    let els = candidates()
    for (const [key, value] of Object.entries(values)) {
      if (value === null || value === undefined || String(value).trim() === '') continue
      const pat = extra[key] && extra[key].re ? rx(extra[key]) : PATTERNS[key]
      if (!pat) continue
      const el = els.find((e) => !used.has(e) && matches(pat, describe(e)))
      if (!el) { missed.push(key); continue }
      if (fillOne(el, value)) { used.add(el); filled.push(key); mark(el) } else missed.push(key)
    }

    // 2. Yes/no style radios, only in a group whose label matches the field, never in a consent group
    for (const [key, answer] of Object.entries(choices)) {
      if (answer === null || answer === undefined || answer === '') continue
      const spec = extra.choices && extra.choices[key]
      if (!spec) continue
      const groupPat = rx(spec.group), optSrc = spec.options && spec.options[answer]
      if (!groupPat || !optSrc) { missed.push(key); continue }
      const optPat = new RegExp(optSrc, 'i')
      const group = radioGroups().find((g) => {
        const label = groupLabel(g[0])
        return matches(groupPat, label) && !CONSENT_WORDS.test(label) && !NEVER_WORDS.test(label)
      })
      const radio = group && group.find((r) => optPat.test(optionText(r)))
      if (!radio) { missed.push(key); continue }
      if (!radio.checked) radio.click()
      filled.push(key); mark(radio.parentElement || radio)
    }

    // 3. Lists: make enough rows, then fill them in order
    for (const [key, items] of Object.entries(lists)) {
      const spec = extra.lists && extra.lists[key]
      if (!spec || !items || !items.length) continue
      const namePat = rx(spec.name), titlePat = rx(spec.title), addPat = spec.add ? new RegExp(spec.add, 'i') : null
      const nameEls = () => candidates().filter((e) => !(e instanceof HTMLSelectElement) && matches(namePat, describe(e)))
      let guard = 0
      while (nameEls().length < items.length && addPat && guard++ < 25) {
        const b = findAddButton(addPat)
        if (!b) break
        b.click(); clicks++
        await wait(150)
      }
      const rows = nameEls()
      const titles = titlePat ? candidates().filter((e) => matches(titlePat, describe(e))) : []
      let n = 0
      items.forEach((it, i) => {
        if (!rows[i]) return
        setValue(rows[i], String(it.name)); mark(rows[i]); n++
        if (it.title && titles[i]) { if (fillOne(titles[i], it.title)) mark(titles[i]) }
      })
      if (n === items.length) filled.push(key); else missed.push(key)
    }
    return { filled, missed, clicks, url: location.hostname }
  }
})()
