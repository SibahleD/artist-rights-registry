import { Link } from 'react-router-dom'
import { Hero } from '../components/ui'

// VITE_API_URL is "/api" on the hosted site, which means nothing inside the extension, so show the full address.
const RAW_API = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api'
const API = RAW_API.startsWith('/') ? window.location.origin + RAW_API : RAW_API
const ZIP = `${window.location.origin}/assets/track-record-helper.zip`

export default function Extension() {
  return (
    <div className="stack">
      <Hero>
        <h1>Track Record helper</h1>
        <p className="muted">
          A Chrome extension that copies a ready release from Track Record into a distributor's release form.
          It only fills text boxes and drop-downs. It never submits, uploads files or touches login or payment fields.
        </p>
      </Hero>
      <section className="card stack">
        <ol className="ext-steps">
          <li><a href={ZIP} download>Download the extension</a> and unzip it. You get a folder called <code>track-record-helper</code>.</li>
          <li>In Chrome open <code>chrome://extensions</code> and switch on Developer mode.</li>
          <li>Choose Load unpacked and pick the <code>track-record-helper</code> folder.</li>
          <li>Open the extension and sign in with your Track Record account. If it asks for an API address, use <code>{API}</code>.</li>
        </ol>
        <p className="muted">You check everything and press submit yourself.</p>
        <p><Link to="/settings">Back to settings</Link></p>
      </section>
    </div>
  )
}
