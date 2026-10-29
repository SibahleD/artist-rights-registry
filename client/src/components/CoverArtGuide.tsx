import { ART_NOT_ALLOWED, ART_TARGET } from '../lib/distribution'

// Cover art rules that no program can check, shown as a list with a confirmation. The size and weight are checked on the
// server and shown as warnings on the release page. The confirmation is a reminder for this visit and is not saved.
export default function CoverArtGuide({ confirmed, onConfirm }: { confirmed: boolean; onConfirm: (v: boolean) => void }) {
  return (
    <div className="art-guide">
      <p className="art-guide-title">Cover art checklist</p>
      <p className="hint">Aim for: {ART_TARGET}</p>
      <p className="hint">Stores can reject cover art that contains or shows:</p>
      <ul>{ART_NOT_ALLOWED.map((x) => <li key={x}>{x}</li>)}</ul>
      <label className="consent">
        <input type="checkbox" checked={confirmed} onChange={(e) => onConfirm(e.target.checked)} />
        <span>I have checked my cover art against this list.</span>
      </label>
    </div>
  )
}
