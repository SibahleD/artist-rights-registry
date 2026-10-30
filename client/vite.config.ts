import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'

// The marketing site (landing/) is served at "/" and the React app lives under "/app/".
//  - dev and preview: a small middleware serves landing/ (or the build's root) for anything outside /app/
//  - build: landing/ is copied into the root of dist/, next to dist/app/
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
}

function landing(): Plugin {
  const src = path.resolve(import.meta.dirname, 'landing')
  const serve = (dir: string) => (req: { url?: string }, res: any, next: () => void) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0])
    if (url.startsWith('/app') || url.startsWith('/@') || url.startsWith('/src') || url.startsWith('/node_modules')) return next()
    const rel = url === '/' ? 'index.html' : url.replace(/^\//, '')
    const file = path.resolve(dir, rel)
    if (!file.startsWith(dir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next()
    res.setHeader('Content-Type', MIME[path.extname(file)] ?? 'application/octet-stream')
    res.end(fs.readFileSync(file))
  }
  // The app builds into dist/app; the landing page goes in dist/, so dist/ is the folder to deploy.
  let site = ''
  let building = false
  return {
    name: 'landing-at-root',
    configResolved(c) { site = path.resolve(c.root, 'dist'); building = c.command === 'build' },
    // Start every build from an empty dist/, so old files (style.css, src/ copies, old hashes) cannot linger.
    buildStart() { if (building) fs.rmSync(site, { recursive: true, force: true }) },
    configureServer(server) { server.middlewares.use(serve(src)) },
    configurePreviewServer(server) { server.middlewares.use(serve(site)) },
    closeBundle() { if (fs.existsSync(src)) fs.cpSync(src, site, { recursive: true }) },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/app/',
  build: { outDir: 'dist/app' },
  plugins: [react(), landing()],
})
