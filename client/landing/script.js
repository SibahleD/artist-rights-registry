const APP_URL = '/app'

document.documentElement.classList.add('lp-js')

// Signed in: "Log in" would just be a second "Open the app" next to "Get started", so drop it.
let signedIn = false
try { signedIn = !!localStorage.getItem('token') } catch { /* storage unavailable */ }
document.querySelectorAll('[data-app]').forEach((a) => {
  if (signedIn && a.getAttribute('data-app') === '/login') { a.remove(); return }
  a.setAttribute('href', APP_URL + (signedIn ? '/' : a.getAttribute('data-app')))
  if (signedIn) a.textContent = 'Open the app'
})

// Mobile menu
const btn = document.querySelector('.lp-menu-btn')
const menu = document.getElementById('menu')
btn.addEventListener('click', () => {
  const open = menu.classList.toggle('lp-open')
  btn.setAttribute('aria-expanded', String(open))
})
menu.addEventListener('click', (e) => {
  if (e.target.closest('a')) { menu.classList.remove('lp-open'); btn.setAttribute('aria-expanded', 'false') }
})

// Nav gets a firmer background once the page has scrolled off the hero
const nav = document.querySelector('.lp-nav')
const onScroll = () => nav.classList.toggle('lp-scrolled', window.scrollY > 40)
onScroll()
window.addEventListener('scroll', onScroll, { passive: true })

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Stagger things that reveal together
const seen = new Map()
document.querySelectorAll('.lp-reveal').forEach((el) => {
  const n = seen.get(el.parentElement) ?? 0
  seen.set(el.parentElement, n + 1)
  el.style.setProperty('--d', Math.min(n, 6) * 90 + 'ms')
})
// Index the chips and table rows inside each mock so they pop in one after another
document.querySelectorAll('.lp-plats, .lp-panel').forEach((box) => {
  box.querySelectorAll('.lp-plat').forEach((el, i) => el.style.setProperty('--k', i))
  box.querySelectorAll('.lp-earn:not(.lp-earn-h)').forEach((el, i) => el.style.setProperty('--k', i))
})

// Numbers count up when they scroll into view
function countUp(el) {
  const to = Number(el.dataset.count)
  const pre = el.dataset.prefix || ''
  if (reduced || !to) return
  const t0 = performance.now()
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / 1500)
    el.textContent = pre + Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString('en-US')
    if (k < 1) requestAnimationFrame(tick)
  }
  el.textContent = pre + '0'
  requestAnimationFrame(tick)
}

// Scroll reveal
const items = document.querySelectorAll('.lp-reveal')
const counters = document.querySelectorAll('[data-count]')
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('lp-in'); io.unobserve(e.target) } })
  }, { threshold: 0.12 })
  items.forEach((el) => io.observe(el))
  const co = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { countUp(e.target); co.unobserve(e.target) } })
  }, { threshold: 0.6 })
  counters.forEach((el) => co.observe(el))
} else {
  items.forEach((el) => el.classList.add('lp-in'))
}
