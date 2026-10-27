import { Link } from 'react-router-dom'
import AuthShell from '../components/AuthShell'

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api'

export default function Extension() {
  return (
    <AuthShell footer={<Link to="/login">Back to log in</Link>}>
      <div className="stack">
        <h1>Registry helper</h1>
        <p className="muted">
          A Chrome extension that copies a ready release from the registry into a distributor's release form.
          It only fills text boxes and drop-downs. It never submits, uploads files or touches login or payment fields.
        </p>
        <ol className="ext-steps">
          <li>Download the <code>extension</code> folder from the project and unzip it.</li>
          <li>In Chrome open <code>chrome://extensions</code> and switch on Developer mode.</li>
          <li>Choose Load unpacked and pick the <code>extension</code> folder.</li>
          <li>Open the extension, enter the API address <code>{API}</code> and sign in with your registry account.</li>
        </ol>
        <p className="muted">You check everything and press submit yourself.</p>
      </div>
    </AuthShell>
  )
}
