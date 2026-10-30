const APP_URL = '/app'

document.documentElement.classList.add('lp-js')

// Signed-in visitors get "Open the app" instead of the sign-up buttons
let signedIn = false
try { signedIn = !!localStorage.getItem('token') } catch { /* storage unavailable */ }
document.querySelectorAll('[data-app]').forEach((a) => {
  // Signed in: the header's "Log in" link goes away, leaving a single "Open the app" button
  if (signedIn && a.classList.contains('lp-link')) { a.remove(); return }
  a.setAttribute('href', APP_URL + (signedIn ? '/' : a.getAttribute('data-app')))
  if (signedIn) {
    const arrow = a.querySelector('span[aria-hidden]')
    a.textContent = 'Open the app'
    if (arrow && a.classList.contains('lp-btn')) a.append(' ', arrow)
  }
})

const btn = document.querySelector('.lp-menu-btn')
const menu = document.getElementById('menu')
btn.addEventListener('click', () => {
  const open = menu.classList.toggle('lp-open')
  btn.setAttribute('aria-expanded', String(open))
})
menu.addEventListener('click', (e) => {
  if (e.target.closest('a')) { menu.classList.remove('lp-open'); btn.setAttribute('aria-expanded', 'false') }
})

const items = document.querySelectorAll('.lp-reveal')
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('lp-in'); io.unobserve(e.target) } })
  }, { threshold: 0.12 })
  items.forEach((el) => io.observe(el))
} else {
  items.forEach((el) => el.classList.add('lp-in'))
}
