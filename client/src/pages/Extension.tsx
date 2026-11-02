import { Link } from 'react-router-dom'
import { Hero } from '../components/ui'

// The extension is served straight from the repository, so it is always the latest version.
const EXTENSION = 'https://github.com/SibahleD/artist-rights-registry/tree/main/extension'
const REPO_ZIP = 'https://github.com/SibahleD/artist-rights-registry/archive/refs/heads/main.zip'

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
          <li>Open the <a href={EXTENSION} target="_blank" rel="noopener noreferrer">extension on GitHub</a>, or <a href={REPO_ZIP}>download the repository as a zip</a>, and unzip it. The extension is the <code>extension</code> folder inside.</li>
          <li>In Chrome open <code>chrome://extensions</code> and switch on Developer mode.</li>
          <li>Choose Load unpacked and pick the <code>extension</code> folder.</li>
          <li>Open the extension and sign in with your Track Record account.</li>
        </ol>
        <p className="muted">You check everything and press submit yourself.</p>
        <p><Link to="/settings">Back to settings</Link></p>
      </section>
    </div>
  )
}
