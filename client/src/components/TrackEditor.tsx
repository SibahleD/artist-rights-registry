import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EXPLICIT_VALUES } from '../types'
import type { TrackForm } from '../types'
import { sumPercent } from '../lib/collab'
import { Hint, Panel } from './ui'
import { GENRES, LANGUAGES, ORIGIN_LABELS, ORIGIN_WARNING, TRACK_ORIGINS } from '../data/options'
import { checkAudio, fmtBytes } from './files'
import CopyrightInput from './CopyrightInput'
import SelectOrOther from './SelectOrOther'
import FeaturedArtistsEditor from './FeaturedArtistsEditor'
import AudioPreview from './AudioPreview'
import CreditsEditor from './CreditsEditor'
import { Req } from './Required'
import { formatStartTime, parseStartTime } from '../lib/distribution'

export const EXPLICIT_LABELS: Record<(typeof EXPLICIT_VALUES)[number], string> = {
  explicit: 'Explicit', not_explicit: 'Not explicit', cleaned: 'Cleaned',
}

export const showDuration = (n?: number | null) => (n ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : '')

// A quick preview of the file's length, read by the browser. The server reads it again when the file is saved and is the one that counts.
const previewDuration = (f: File) => new Promise<number | null>((resolve) => {
  const url = URL.createObjectURL(f)
  const a = new Audio()
  const done = (n: number | null) => { URL.revokeObjectURL(url); resolve(n) }
  a.preload = 'metadata'
  a.onloadedmetadata = () => done(Number.isFinite(a.duration) && a.duration >= 1 ? Math.round(a.duration) : null)
  a.onerror = () => done(null)
  a.src = url
})

export type SongSection = 'general' | 'audio' | 'publishing' | 'credits' | 'splits'

// One section of one song at a time: the release form puts them under tabs. All the song's values live in `track`, so switching tabs loses nothing.
export default function TrackEditor({ track, onChange, section, hideTitle, hideGenre, maxAudioBytes = 200 * 1024 * 1024, releaseId }: {
  track: TrackForm; onChange: (t: TrackForm) => void; section: SongSection; hideTitle?: boolean; hideGenre?: boolean; maxAudioBytes?: number; releaseId?: string
}) {
  const [audioErr, setAudioErr] = useState('')
  const set = <K extends keyof TrackForm>(k: K, v: TrackForm[K]) => onChange({ ...track, [k]: v })
  // The composition title follows the song title until the artist edits it to something different.
  const setTitle = (v: string) => onChange({
    ...track, title: v,
    compositionTitle: !track.compositionTitle || track.compositionTitle === track.title ? v : track.compositionTitle,
  })
  const preview = parseStartTime(track.previewStart)
  const previewOk = preview.ok
  const previewSeconds = preview.ok ? preview.seconds : null
  const total = sumPercent(track.collaborators)
  const credits = track.collaborators.filter((c) => !c.removedByWriter).length

  const pickFile = async (f?: File) => {
    if (!f) return
    const problem = checkAudio(f, maxAudioBytes)
    if (problem) { setAudioErr(problem); return }
    setAudioErr('')
    onChange({ ...track, audioFile: f, durationSeconds: await previewDuration(f) })
  }

  return (
    <div className="stack">
      {section === 'general' && (
        <Panel title="General info" field="song-info">
          <div className="subsection" data-field="artist-info">
            <h5>Artist info</h5>
            <div className="grid2">
              <label>Performing artist<input value={track.artistName} onChange={(e) => set('artistName', e.target.value)} placeholder="Defaults to the main artist" /></label>
            </div>
            <FeaturedArtistsEditor value={track.featuring} onChange={(v) => set('featuring', v)} />
          </div>
          <hr className="divider" />
          <div className="subsection" data-field="track-info">
            <h5>Track info</h5>
            <div className="grid2">
              {!hideTitle && <label>Song title<Req /><input value={track.title} onChange={(e) => setTitle(e.target.value)} /></label>}
              {!hideGenre && <SelectOrOther label="Genre" options={GENRES} value={track.genre} onChange={(v) => set('genre', v)} otherPlaceholder="Type the genre" />}
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
              <label data-field="track-lyrics">Does the song have lyrics?
                <select value={track.hasLyrics} onChange={(e) => set('hasLyrics', e.target.value as TrackForm['hasLyrics'])}>
                  <option value="">Not answered</option><option value="yes">Yes</option><option value="no">No (instrumental)</option>
                </select>
              </label>
            </div>
            {track.origin !== 'original' && <small className="warn">{ORIGIN_WARNING}</small>}
          </div>
        </Panel>
      )}

      {section === 'audio' && (
      <Panel title={<>Audio file<Req /></>} field="track-audio">
        <Hint>MP3, WAV, FLAC or AAC, up to {fmtBytes(maxAudioBytes)}. Keep your original master file. A release can't be marked ready until every song has an audio file.</Hint>
        <div className="row">
          <input type="file" accept=".mp3,.aac,.m4a,.wav,.flac,audio/*" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = '' }} />
          {(track.audio || track.audioFile) && (
            <button type="button" className="ghost" onClick={() => { setAudioErr(''); onChange({ ...track, audio: null, audioFile: undefined, durationSeconds: null }) }}>Remove audio</button>
          )}
        </div>
        {audioErr && <small className="warn">{audioErr}</small>}
        <label data-field="track-preview">Preview start (optional)
          <input value={track.previewStart} inputMode="numeric" placeholder="0:45" onChange={(e) => set('previewStart', e.target.value)} />
          <Hint>Where the short store preview should begin, as minutes and seconds (0:45) or seconds (45). Once the song is loaded above, you can choose it by ear.</Hint>
          {!previewOk && <small className="warn">Use a time like 0:45, or a number of seconds up to 3600.</small>}
          {previewOk && previewSeconds !== null && track.durationSeconds && previewSeconds >= track.durationSeconds && (
            <small className="warn">That is after the end of the song ({showDuration(track.durationSeconds)}). Pick a time inside the song.</small>
          )}
        </label>
        {(track.audioFile || (track.audio && track.id && releaseId)) && (
          <AudioPreview file={track.audioFile} releaseId={releaseId} trackId={track.id}
            previewStart={previewSeconds} onPreviewStart={(s) => set('previewStart', formatStartTime(s))} />
        )}
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

      </Panel>
      )}

      {section === 'publishing' && (
      <Panel title="Publishing info">
        
        <div className="grid2">
          <label>Composition title<input value={track.compositionTitle} onChange={(e) => set('compositionTitle', e.target.value)} />
            <Hint>The name of the underlying song (words and music), which can differ from the recording title, e.g. for remixes.</Hint></label>
          <label data-field="track-isrc">ISRC<input value={track.isrc} onChange={(e) => set('isrc', e.target.value)} placeholder="RW-ABC-26-00001" />
            <Hint>12-character code that identifies this recording. Your distributor can issue one if you don't have it.</Hint></label>
          <label>ISWC (optional)<input value={track.iswc} onChange={(e) => set('iswc', e.target.value)} placeholder="T-123.456.789-0" />
            <Hint>Identifies the composition. It is issued when the work is registered with a rights society, so you may not have one yet.</Hint></label>
          <CopyrightInput symbol="©" label="Composition copyright" year={track.compositionCopyrightYear} line={track.compositionCopyright}
            placeholder="2026 Your Legal Name" hint="Year, then the legal name of the songwriter or publisher: 2026 Jane Doe. The © is added for you."
            onChange={(y, l) => onChange({ ...track, compositionCopyrightYear: y, compositionCopyright: l })} />
          <CopyrightInput symbol="℗" label="Sound recording copyright" year={track.recordingCopyrightYear} line={track.recordingCopyright}
            placeholder="2026 Your Label or Name" hint="Year, then whoever owns the recording (you or your label): 2026 Jane Doe Records. The ℗ is added for you."
            onChange={(y, l) => onChange({ ...track, recordingCopyrightYear: y, recordingCopyright: l })} />
        </div>

      </Panel>
      )}

      {section === 'credits' && (
      <Panel title="Credits">
        <CreditsEditor legend="Producers, engineers and performers" value={track.credits} onChange={(v) => set('credits', v)}
          hint="Anyone who worked on this song and should be credited, with what they did. Writers and their shares are on the Splits page, not here." />

      </Panel>
      )}

      {section === 'splits' && (
      <Panel title={<>Royalty splits<Req /></>} field="track-splits">
        <div className="row between">
          {releaseId && track.id
            ? <span>{credits} {credits === 1 ? 'credit' : 'credits'}, {total}%{total !== 100 && <span className="warn"> (must total 100%)</span>}</span>
            : <span className="muted">Save the release first, then add splits.</span>}
          {releaseId && track.id && <Link className="btn secondary" to={`/releases/${releaseId}/splits`}>Edit splits</Link>}
        </div>
        <Hint>Who owns what share of this song, by legal name. They are edited on the Splits page, where co-writers are also asked to confirm.</Hint>
      </Panel>
      )}
    </div>
  )
}
