import { AUDIO_FORMATS, COLLABORATOR_ROLES, EXPLICIT_VALUES } from '../types'
import type { AudioFormat, AudioInput, CollaboratorInput, TrackForm } from '../types'
import { Hint } from './ui'

const EXPLICIT_LABELS: Record<(typeof EXPLICIT_VALUES)[number], string> = {
  explicit: 'Explicit', not_explicit: 'Not explicit', cleaned: 'Cleaned',
}

const sumPct = (t: TrackForm) => t.collaborators.reduce((s, c) => s + Math.round((Number(c.ownershipPercent) || 0) * 100), 0) / 100
const toInt = (s: string) => (s.trim() && /^\d+$/.test(s.trim()) ? parseInt(s, 10) : null)

export const parseDuration = (s: string) => {
  const m = s.trim().match(/^(\d+):([0-5]?\d)$/)
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : s.trim() && /^\d+$/.test(s.trim()) ? parseInt(s) : null
}
export const showDuration = (n?: number | null) => (n ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : '')

export default function TrackEditor({ track, onChange, hideTitle }: { track: TrackForm; onChange: (t: TrackForm) => void; hideTitle?: boolean }) {
  const set = <K extends keyof TrackForm>(k: K, v: TrackForm[K]) => onChange({ ...track, [k]: v })
  const setCollab = (i: number, patch: Partial<CollaboratorInput>) =>
    set('collaborators', track.collaborators.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const setAudio = (patch: Partial<AudioInput>) => {
    if (track.audio) set('audio', { ...track.audio, ...patch })
  }
  const total = sumPct(track)

  // Only the file's metadata is recorded (name, size, format); the file itself is not uploaded.
  const pickFile = (f?: File) => {
    if (!f) return
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    const format: AudioFormat = (AUDIO_FORMATS as readonly string[]).includes(ext) ? (ext as AudioFormat) : 'other'
    set('audio', { ...track.audio, fileName: f.name, format, sizeBytes: f.size })
  }

  return (
    <div className="stack">
      <section className="card">
        <h4>General info</h4>
        <div className="grid2">
          {!hideTitle && <label>Song title<input value={track.title} onChange={(e) => set('title', e.target.value)} /></label>}
          <label>Performing artist<input value={track.artistName} onChange={(e) => set('artistName', e.target.value)} placeholder="Defaults to the main artist" /></label>
          <label>Genre<input value={track.genre} onChange={(e) => set('genre', e.target.value)} placeholder="Afrobeat, Gospel, Hip-hop…" /></label>
          <label>Duration (m:ss)<input defaultValue={showDuration(track.durationSeconds)} onBlur={(e) => set('durationSeconds', parseDuration(e.target.value))} placeholder="3:45" /></label>
          <label>Explicit content
            <select value={track.explicit} onChange={(e) => set('explicit', e.target.value as TrackForm['explicit'])}>
              <option value="">Not specified</option>
              {EXPLICIT_VALUES.map((v) => <option key={v} value={v}>{EXPLICIT_LABELS[v]}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="card">
        <h4>Audio file</h4>
        <Hint>A release can't be marked ready until every song has an audio file recorded.</Hint>
        <div className="row">
          <input type="file" accept="audio/*,.mp3,.flac,.wav,.aac" onChange={(e) => pickFile(e.target.files?.[0])} />
          {track.audio && <button type="button" className="ghost" onClick={() => set('audio', null)}>Remove audio</button>}
        </div>
        {track.audio && (
          <div className="grid2">
            <label>File name<input value={track.audio.fileName} onChange={(e) => setAudio({ fileName: e.target.value })} /></label>
            <label>Format
              <select value={track.audio.format} onChange={(e) => setAudio({ format: e.target.value as AudioFormat })}>
                {AUDIO_FORMATS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
              </select>
            </label>
            <label>Bitrate (kbps, optional)<input inputMode="numeric" value={track.audio.bitrateKbps ?? ''} onChange={(e) => setAudio({ bitrateKbps: toInt(e.target.value) })} /></label>
            <label>Sample rate (Hz, optional)<input inputMode="numeric" value={track.audio.sampleRateHz ?? ''} onChange={(e) => setAudio({ sampleRateHz: toInt(e.target.value) })} placeholder="44100" /></label>
            <label>Channels (optional)<input inputMode="numeric" value={track.audio.channels ?? ''} onChange={(e) => setAudio({ channels: toInt(e.target.value) })} placeholder="2" /></label>
            <label>Size (bytes)<input inputMode="numeric" value={track.audio.sizeBytes ?? ''} onChange={(e) => setAudio({ sizeBytes: toInt(e.target.value) })} /></label>
          </div>
        )}
      </section>

      <section className="card">
        <h4>Publishing info</h4>
        <div className="grid2">
          <label>Composition title<input value={track.compositionTitle} onChange={(e) => set('compositionTitle', e.target.value)} />
            <Hint>The name of the underlying song (words and music), which can differ from the recording title, e.g. for remixes.</Hint></label>
          <label>ISRC<input value={track.isrc} onChange={(e) => set('isrc', e.target.value)} placeholder="RW-ABC-26-00001" />
            <Hint>12-character code that identifies this recording. Your distributor can issue one if you don't have it.</Hint></label>
          <label>ISWC (optional)<input value={track.iswc} onChange={(e) => set('iswc', e.target.value)} placeholder="T-123.456.789-0" />
            <Hint>Identifies the composition. It is issued when the work is registered with a rights society, so you may not have one yet.</Hint></label>
          <label>Composition copyright line<input value={track.compositionCopyright} onChange={(e) => set('compositionCopyright', e.target.value)} placeholder="© Your Legal Name" /></label>
          <label>Composition copyright year<input inputMode="numeric" value={track.compositionCopyrightYear ?? ''} onChange={(e) => set('compositionCopyrightYear', toInt(e.target.value))} placeholder="2026" /></label>
          <label>Sound recording copyright line<input value={track.recordingCopyright} onChange={(e) => set('recordingCopyright', e.target.value)} placeholder="℗ Your Legal Name" /></label>
          <label>Sound recording copyright year<input inputMode="numeric" value={track.recordingCopyrightYear ?? ''} onChange={(e) => set('recordingCopyrightYear', toInt(e.target.value))} placeholder="2026" /></label>
        </div>
      </section>

      <section className="card">
        <h4>Royalty splits <small className="muted">(legal names)</small></h4>
        <Hint>Ownership must total exactly 100%, with at most 2 decimals. Once the release is marked ready, splits are locked. Revert it to draft to edit them (not possible after a dispute is raised).</Hint>
        {track.collaborators.map((c, i) => (
          <div className="row" key={i}>
            <input placeholder="Legal name" value={c.legalName} onChange={(e) => setCollab(i, { legalName: e.target.value })} />
            <select value={c.role ?? 'songwriter'} onChange={(e) => setCollab(i, { role: e.target.value as CollaboratorInput['role'] })}>
              {COLLABORATOR_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input type="number" min={0} max={100} step="0.01" className="pct" placeholder="%" value={c.ownershipPercent || ''} onChange={(e) => setCollab(i, { ownershipPercent: Number(e.target.value) })} />
            <input type="email" placeholder="Email" value={c.invitedEmail ?? ''} onChange={(e) => setCollab(i, { invitedEmail: e.target.value })} />
            <button type="button" className="ghost" onClick={() => set('collaborators', track.collaborators.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <div className="row between">
          <button type="button" className="ghost" onClick={() => set('collaborators', [...track.collaborators, { legalName: '', role: 'songwriter', ownershipPercent: 0 }])}>+ Add split holder</button>
          <strong className={total === 100 ? 'ok' : 'warn'}>Total: {total}%</strong>
        </div>
      </section>
    </div>
  )
}
