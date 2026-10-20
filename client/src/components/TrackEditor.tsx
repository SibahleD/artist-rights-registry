import { useState } from 'react'
import { COLLABORATOR_ROLES, EXPLICIT_VALUES } from '../types'
import type { CollaboratorInput, TrackForm } from '../types'
import { Collapsible, Hint } from './ui'
import { LANGUAGES, ORIGIN_LABELS, ORIGIN_WARNING, TRACK_ORIGINS, WRITER_STATUSES, WRITER_STATUS_LABELS } from '../data/options'
import type { WriterStatus } from '../data/options'
import { checkAudio, fmtBytes } from './files'

const EXPLICIT_LABELS: Record<(typeof EXPLICIT_VALUES)[number], string> = {
  explicit: 'Explicit', not_explicit: 'Not explicit', cleaned: 'Cleaned',
}

const sumPct = (t: TrackForm) => t.collaborators.filter((c) => !c.discard).reduce((s, c) => s + Math.round((Number(c.ownershipPercent) || 0) * 100), 0) / 100
const toInt = (s: string) => (s.trim() && /^\d+$/.test(s.trim()) ? parseInt(s, 10) : null)

export const parseDuration = (s: string) => {
  const m = s.trim().match(/^(\d+):([0-5]?\d)$/)
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : s.trim() && /^\d+$/.test(s.trim()) ? parseInt(s) : null
}
export const showDuration = (n?: number | null) => (n ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : '')

export default function TrackEditor({ track, onChange, hideTitle, maxAudioBytes = 5 * 1024 * 1024 }: { track: TrackForm; onChange: (t: TrackForm) => void; hideTitle?: boolean; maxAudioBytes?: number }) {
  const [audioErr, setAudioErr] = useState('')
  const [open, setOpen] = useState<Record<number, boolean>>({})
  const set = <K extends keyof TrackForm>(k: K, v: TrackForm[K]) => onChange({ ...track, [k]: v })
  const setCollab = (i: number, patch: Partial<CollaboratorInput>) =>
    set('collaborators', track.collaborators.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const total = sumPct(track)

  const pickFile = (f?: File) => {
    if (!f) return
    const problem = checkAudio(f, maxAudioBytes)
    if (problem) { setAudioErr(problem); return }
    setAudioErr('')
    set('audioFile', f)
  }

  return (
    <div className="stack">
      <Collapsible title={<>General info</>}>
        
        <div className="grid2">
          {!hideTitle && <label>Song title<input value={track.title} onChange={(e) => set('title', e.target.value)} /></label>}
          <label>Performing artist<input value={track.artistName} onChange={(e) => set('artistName', e.target.value)} placeholder="Defaults to the main artist" /></label>
          <label>Genre<input value={track.genre} onChange={(e) => set('genre', e.target.value)} placeholder="Afrobeat, Gospel, Hip-hop…" /></label>
          <label>Duration (m:ss)<input defaultValue={showDuration(track.durationSeconds)} onBlur={(e) => set('durationSeconds', parseDuration(e.target.value))} placeholder="3:45" /></label>
          <label>Version title (optional)<input value={track.versionTitle} onChange={(e) => set('versionTitle', e.target.value)} placeholder="Acoustic, Radio edit, Remix…" /></label>
          <label>Language of the lyrics
            <select value={track.language} onChange={(e) => set('language', e.target.value)}>
              <option value="">Not specified</option>
              {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              {track.language && !LANGUAGES.some(([c]) => c === track.language) && <option value={track.language}>{track.language}</option>}
            </select>
          </label>
          <label>Where does the song come from?
            <select value={track.origin} onChange={(e) => set('origin', e.target.value as TrackForm['origin'])}>
              {TRACK_ORIGINS.map((o) => <option key={o} value={o}>{ORIGIN_LABELS[o]}</option>)}
            </select>
          </label>
          <label>Explicit content
            <select value={track.explicit} onChange={(e) => set('explicit', e.target.value as TrackForm['explicit'])}>
              <option value="">Not specified</option>
              {EXPLICIT_VALUES.map((v) => <option key={v} value={v}>{EXPLICIT_LABELS[v]}</option>)}
            </select>
          </label>
        </div>
        {track.origin !== 'original' && <small className="warn">{ORIGIN_WARNING}</small>}
      </Collapsible>

      <Collapsible title={<>Audio file</>}>
        <Hint>This is a small reference copy (MP3, WAV, FLAC or AAC, up to {fmtBytes(maxAudioBytes)}). Keep your original master file. A release can't be marked ready until every song has an audio file.</Hint>
        <div className="row">
          <input type="file" accept=".mp3,.aac,.m4a,.wav,.flac,audio/*" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = '' }} />
          {(track.audio || track.audioFile) && (
            <button type="button" className="ghost" onClick={() => { setAudioErr(''); onChange({ ...track, audio: null, audioFile: undefined }) }}>Remove audio</button>
          )}
        </div>
        {audioErr && <small className="warn">{audioErr}</small>}
        {track.audioFile && <small className="muted">Selected: {track.audioFile.name} ({fmtBytes(track.audioFile.size)}). It uploads when you save, and the details below are then read from the file.</small>}
        {track.audio && !track.audioFile && (
          <div className="grid2">
            <div><span className="muted">File name</span><br />{track.audio.fileName}</div>
            <div><span className="muted">Format</span><br />{track.audio.format.toUpperCase()}</div>
            <div><span className="muted">Bitrate</span><br />{track.audio.bitrateKbps ? `${track.audio.bitrateKbps} kbps` : '—'}</div>
            <div><span className="muted">Sample rate</span><br />{track.audio.sampleRateHz ? `${track.audio.sampleRateHz} Hz` : '—'}</div>
            <div><span className="muted">Channels</span><br />{track.audio.channels ?? '—'}</div>
            <div><span className="muted">Size</span><br />{track.audio.sizeBytes ? fmtBytes(track.audio.sizeBytes) : '—'}</div>
          </div>
        )}
      </Collapsible>

      <Collapsible title={<>Publishing info</>}>
        
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
      </Collapsible>

      <Collapsible title={<>Royalty splits <small className="muted">(legal names)</small></>}>
        <Hint>Ownership must total exactly 100%, with at most 2 decimals. Once the release is marked ready, splits are locked. Revert it to draft to edit them (not possible after a dispute is raised).</Hint>
        {track.collaborators.map((c, i) => c.removedByWriter ? (
          <div className="row" key={i}>
            <span className="muted">Removed by writer: {c.ownershipPercent}% {c.discard ? 'will be freed on save' : 'is held until you discard this line'}</span>
            <button type="button" className="ghost" onClick={() => setCollab(i, { discard: !c.discard })}>{c.discard ? 'Keep' : 'Discard'}</button>
          </div>
        ) : (
          <div className="stack" key={i}>
          <div className="row">
            <input placeholder="Legal name" value={c.legalName} onChange={(e) => setCollab(i, { legalName: e.target.value })} />
            <select value={c.role ?? 'songwriter'} onChange={(e) => setCollab(i, { role: e.target.value as CollaboratorInput['role'] })}>
              {COLLABORATOR_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input type="number" min={0} max={100} step="0.01" className="pct" placeholder="%" value={c.ownershipPercent || ''} onChange={(e) => setCollab(i, { ownershipPercent: Number(e.target.value) })} />
            <input type="email" placeholder="Email" value={c.invitedEmail ?? ''} onChange={(e) => setCollab(i, { invitedEmail: e.target.value })} />
            <button type="button" className="ghost" onClick={() => setOpen({ ...open, [i]: !open[i] })}>{open[i] ? 'Hide details' : 'Details'}</button>
            <button type="button" className="ghost" onClick={() => set('collaborators', track.collaborators.filter((_, j) => j !== i))}>Remove</button>
          </div>
          {open[i] && (
            <div className="grid2">
              <label>IPI number (optional)<input inputMode="numeric" value={c.ipi ?? ''} onChange={(e) => setCollab(i, { ipi: e.target.value })} placeholder="9 to 11 digits" />
                <Hint>Identifies a writer or publisher at rights societies. Only enter it if you have it.</Hint></label>
              <label>Rights society status
                <select value={c.writerStatus ?? ''} onChange={(e) => setCollab(i, { writerStatus: (e.target.value || null) as WriterStatus | null })}>
                  <option value="">Not specified</option>
                  {WRITER_STATUSES.map((w) => <option key={w} value={w}>{WRITER_STATUS_LABELS[w]}</option>)}
                </select>
              </label>
              <label>Publisher (optional)<input value={c.publisherName ?? ''} disabled={!!c.isSelfPublished} onChange={(e) => setCollab(i, { publisherName: e.target.value })} placeholder="Publishing company name" /></label>
              <label className="check"><input type="checkbox" checked={!!c.isSelfPublished} onChange={(e) => setCollab(i, { isSelfPublished: e.target.checked, ...(e.target.checked ? { publisherName: '' } : {}) })} /> Self-published</label>
            </div>
          )}
          </div>
        ))}
        <div className="row between">
          <button type="button" className="ghost" onClick={() => set('collaborators', [...track.collaborators, { legalName: '', role: 'songwriter', ownershipPercent: 0 }])}>+ Add split holder</button>
          <strong className={total === 100 ? 'ok' : 'warn'}>Total: {total}%</strong>
        </div>
      </Collapsible>
    </div>
  )
}
