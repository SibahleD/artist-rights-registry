// Starts the API server and records its CPU and memory once per second while you run k6 against it.
// On Ctrl+C it stops the server and writes a CSV and a small HTML chart to reports/load/.
//
//   LABEL=relaxed node tests/load/monitor.mjs
//   LABEL=limited AUTH_RATE_LIMIT=10 ACCOUNT_RATE_LIMIT=10 NOTICE_RATE_LIMIT=30 API_RATE_LIMIT=600 node tests/load/monitor.mjs
//
// Needs: npm i -D pidusage. Values set on the command line override server/.env.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pidusage from 'pidusage'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverDir = path.resolve(here, '../../server')
const OUT = process.env.OUT ?? path.resolve(here, '../../reports/load')
const LABEL = process.env.LABEL ?? 'run'
fs.mkdirSync(OUT, { recursive: true })

const child = spawn(process.execPath, ['src/index.js'], { cwd: serverDir, stdio: 'inherit', env: process.env })
const started = Date.now()
const samples = []
let finished = false

const timer = setInterval(async () => {
  try {
    const s = await pidusage(child.pid)
    samples.push({ t: Math.round((Date.now() - started) / 1000), cpu: Number(s.cpu.toFixed(1)), memMB: Number((s.memory / 1048576).toFixed(1)) })
  } catch { /* process is ending */ }
}, 1000)

function line(xs, key, w, h, color, max) {
  if (xs.length < 2) return ''
  const tmax = xs[xs.length - 1].t || 1
  const pts = xs.map((p) => `${(p.t / tmax * w).toFixed(1)},${(h - (p[key] / max) * h).toFixed(1)}`).join(' ')
  return `<polyline fill="none" stroke="${color}" stroke-width="2" points="${pts}"/>`
}

function finish() {
  if (finished) return
  finished = true
  clearInterval(timer)
  child.kill()
  if (samples.length === 0) { console.log('\nNo samples recorded.'); process.exit(0) }
  const avg = (k) => samples.reduce((s, p) => s + p[k], 0) / samples.length
  const peak = (k) => Math.max(...samples.map((p) => p[k]))
  const summary = { label: LABEL, seconds: samples.at(-1).t, cpuAvg: +avg('cpu').toFixed(1), cpuPeak: peak('cpu'), memAvgMB: +avg('memMB').toFixed(1), memPeakMB: peak('memMB') }
  const csv = 't_seconds,cpu_percent,memory_mb\n' + samples.map((p) => `${p.t},${p.cpu},${p.memMB}`).join('\n') + '\n'
  fs.writeFileSync(path.join(OUT, `resources-${LABEL}.csv`), csv)
  const W = 720, H = 200
  const cpuMax = Math.max(100, peak('cpu')), memMax = Math.ceil(peak('memMB') / 50) * 50 || 50
  const html = `<!doctype html><meta charset="utf-8"><title>Server resources (${LABEL})</title>
<body style="font-family:system-ui;margin:24px;max-width:780px">
<h2>Server resource use during the ${LABEL} run</h2>
<p>${summary.seconds} s sampled once per second. CPU: average <b>${summary.cpuAvg}%</b>, peak <b>${summary.cpuPeak}%</b>. Memory: average <b>${summary.memAvgMB} MB</b>, peak <b>${summary.memPeakMB} MB</b>.</p>
<h3 style="color:#c2410c">CPU (%), axis 0 to ${cpuMax}</h3><svg width="${W}" height="${H}" style="border:1px solid #ccc">${line(samples, 'cpu', W, H, '#c2410c', cpuMax)}</svg>
<h3 style="color:#1d4ed8">Memory (MB), axis 0 to ${memMax}</h3><svg width="${W}" height="${H}" style="border:1px solid #ccc">${line(samples, 'memMB', W, H, '#1d4ed8', memMax)}</svg>
<p style="color:#555">Horizontal axis: time from server start, 0 to ${summary.seconds} s.</p></body>`
  fs.writeFileSync(path.join(OUT, `resources-${LABEL}.html`), html)
  console.log('\nResource summary:', JSON.stringify(summary))
  console.log(`Saved ${path.join(OUT, `resources-${LABEL}.csv`)} and .html`)
  process.exit(0)
}
child.on('exit', finish)
process.on('SIGINT', finish)
process.on('SIGTERM', finish)
