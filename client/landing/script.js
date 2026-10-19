const APP_URL = '/app'

document.documentElement.classList.add('js')

let signedIn = false
try { signedIn = !!localStorage.getItem('token') } catch { /* storage unavailable */ }
document.querySelectorAll('[data-app]').forEach((a) => {
  a.setAttribute('href', APP_URL + (signedIn ? '/' : a.getAttribute('data-app')))
  if (signedIn) a.textContent = 'Open the app'
})

const btn = document.querySelector('.menu-btn')
const menu = document.getElementById('menu')
btn.addEventListener('click', () => {
  const open = menu.classList.toggle('open')
  btn.setAttribute('aria-expanded', String(open))
})
menu.addEventListener('click', (e) => {
  if (e.target.closest('a')) { menu.classList.remove('open'); btn.setAttribute('aria-expanded', 'false') }
})

const items = document.querySelectorAll('.reveal')
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } })
  }, { threshold: 0.12 })
  items.forEach((el) => io.observe(el))
} else {
  items.forEach((el) => el.classList.add('in'))
}
