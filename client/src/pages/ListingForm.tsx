import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, ApiError, upload } from '../api'
import { useAuth } from '../auth'
import TrackEditor from '../components/TrackEditor'
import ImagePicker from '../components/ImagePicker'
import { UsageLine, useUsage } from '../components/files'
import { Collapsible, ErrorBox, Loading } from '../components/ui'
import SaveBar from '../components/SaveBar'
import { useBackGuard } from '../components/UnsavedGuard'
import type {
  Collaborator, CollaboratorInput, Release, ReleaseForm, ReleaseInput, Track, TrackForm, TrackInput,
} from '../types'
import { GENRES, LANGUAGES } from '../data/options'
import SelectOrOther from '../components/SelectOrOther'

const emptyTrack = (owner: CollaboratorInput): TrackForm => ({
  title: '', compositionTitle: '', artistName: '', genre: '', isrc: '', iswc: '',
  durationSeconds: null, explicit: '',
  compositionCopyrightYear: null, compositionCopyright: '',
  recordingCopyrightYear: null, recordingCopyright: '',
  origin: 'original', versionTitle: '', language: '',
  audio: null, collaborators: [{ ...owner }],
})

const toTrackInput = (t: TrackForm): TrackInput => ({
  title: t.title,
  compositionTitle: t.compositionTitle || null,
  artistName: t.artistName || null,
  genre: t.genre || null,
  isrc: t.isrc || null,
  iswc: t.iswc || null,
  explicit: t.explicit || null,
  compositionCopyrightYear: t.compositionCopyrightYear,
  compositionCopyright: t.compositionCopyright || null,
  recordingCopyrightYear: t.recordingCopyrightYear,
  recordingCopyright: t.recordingCopyright || null,
  origin: t.origin,
  versionTitle: t.versionTitle || null,
  language: t.language || null,
})

const fromServerTrack = (t: Track, collabs: Collaborator[], owner: CollaboratorInput): TrackForm => ({
  id: t.id,
  hadAudio: !!t.audio,
  title: t.title,
  compositionTitle: t.composition_title ?? '',
  artistName: t.artist_name ?? '',
  genre: t.genre ?? '',
  isrc: t.isrc ?? '',
  iswc: t.iswc ?? '',
  durationSeconds: t.duration_seconds,
  explicit: t.explicit ?? '',
  compositionCopyrightYear: t.composition_copyright_year ?? null,
  compositionCopyright: t.composition_copyright ?? '',
  recordingCopyrightYear: t.recording_copyright_year ?? null,
  recordingCopyright: t.recording_copyright ?? '',
  origin: t.origin ?? 'original',
  versionTitle: t.version_title ?? '',
  language: t.language ?? '',
  audio: t.audio
    ? {
        fileName: t.audio.file_name, format: t.audio.format, bitrateKbps: t.audio.bitrate_kbps,
        sampleRateHz: t.audio.sample_rate_hz, channels: t.audio.channels, sizeBytes: t.audio.size_bytes,
      }
    : null,
  collaborators: collabs.length
    ? collabs.map((c) => ({
        legalName: c.legal_name, role: c.role, ownershipPercent: Number(c.ownership_percent),
        invitedEmail: c.invited_email,
        ipi: c.ipi ?? '', writerStatus: c.writer_status ?? null,
        publisherName: c.publisher_name ?? '', isSelfPublished: !!c.is_self_published,
        ...(c.removed_by_writer ? { id: c.id, removedByWriter: true } : {}),
      }))
    : [{ ...owner }],
})

export default function ListingForm({ mode }: { mode: 'song' | 'album' }) {
  const { id } = useParams()
  const [params] = useSearchParams()
  const wantedTrack = Number(params.get('track')) || 0   // from the readiness checklist's "Open" links
  const { user } = useAuth()
  const nav = useNavigate()

  const owner = useMemo<CollaboratorInput>(() => ({
    legalName: [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.artist_name || '',
    role: 'songwriter',
    ownershipPercent: 100,
    ipi: user?.ipi ?? '',
    publisherName: user?.publisher_name ?? '',
  }), [user])

  const [form, setForm] = useState<ReleaseForm | null>(id ? null : {
    releaseType: mode === 'song' ? 'single' : 'album', title: '', albumArtist: user?.artist_name ?? '',
    releaseDate: '', genre: '', upc: '', labelName: '', language: '', tracks: [emptyTrack(owner)],
  })
  const [releaseId, setReleaseId] = useState<string | undefined>(id)
  const [removed, setRemoved] = useState<string[]>([])
  const [active, setActive] = useState(0)
  const [err, setErr] = useState<{ error: string; details?: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [artworkFile, setArtworkFile] = useState<File | undefined>()
  const [artworkId, setArtworkId] = useState<string | null>(null)   // cover already stored on the server
  const [artworkCleared, setArtworkCleared] = useState(false)
  const [usageKey, setUsageKey] = useState(0)
  const usage = useUsage(usageKey)

  // Unsaved-changes tracking: compare against a snapshot taken once the form has loaded.
  const snapshot = form ? JSON.stringify([form, removed, !!artworkFile, artworkCleared]) : null
  const [baseline, setBaseline] = useState<string | null>(null)
  useEffect(() => { if (snapshot && baseline === null) setBaseline(snapshot) }, [snapshot, baseline])
  const dirty = snapshot !== null && baseline !== null && snapshot !== baseline
  const { goBack, modal: backModal, backButton } = useBackGuard({
    dirty, onSave: () => submit('draft'), saveLabel: 'Save', leaveAfterSave: false,
  })

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const { release } = await api<{ release: Release }>(`/releases/${id}`)
      if (release.status !== 'draft') return nav(`/releases/${id}`)
      setArtworkId(release.artwork_id ?? null)
      const { tracks } = await api<{ tracks: Track[] }>(`/releases/${id}/tracks`)
      const splits = await Promise.all(
        tracks.map((t) => api<{ collaborators: Collaborator[] }>(`/releases/${id}/tracks/${t.id}/collaborators`)),
      )
      setForm({
        releaseType: release.release_type,
        title: release.title,
        albumArtist: release.album_artist,
        releaseDate: release.release_date ?? '',
        genre: release.genre ?? '',
        upc: release.upc ?? '',
        labelName: release.label_name ?? '',
        language: release.language ?? '',
        tracks: tracks.length
          ? tracks.map((t, i) => fromServerTrack(t, splits[i].collaborators, owner))
          : [emptyTrack(owner)],
      })
      if (wantedTrack > 0 && tracks.length) setActive(Math.min(wantedTrack, tracks.length) - 1)
    })().catch((e) => setErr({ error: e.message }))
  }, [id, nav, owner, wantedTrack])

  if (!form) return err ? <ErrorBox error={err.error} /> : <Loading />
  const isSong = form.releaseType === 'single'
  const setTrack = (i: number, t: TrackForm) => setForm({ ...form, tracks: form.tracks.map((x, j) => (j === i ? t : x)) })

  // Release -> tracks -> audio -> collaborators, then (optionally) ask co-writers. Marking ready happens on the release page.
  async function submit(save: 'draft' | 'notify') {
    if (!form) return
    setBusy(true); setErr(null)
    const tracks = form.tracks.map((t) => ({ ...t }))
    const inherit = (t: TrackForm): TrackForm => (!isSong && !t.genre && form.genre ? { ...t, genre: form.genre } : t)
    const pending = [...removed]
    let rid = releaseId
    try {
      const body: ReleaseInput = {
        title: isSong ? tracks[0]?.title : form.title,
        releaseType: form.releaseType,
        albumArtist: form.albumArtist,
        releaseDate: form.releaseDate || null,
        // A single has one genre (the song's). An album has a release genre that songs without their own inherit.
        genre: (isSong ? tracks[0]?.genre : form.genre) || null,
        upc: form.upc || null,
        labelName: form.labelName || null,
        language: form.language || null,
      }
      if (rid) {
        await api(`/releases/${rid}`, 'PATCH', body)
      } else {
        const r = await api<{ release: Release }>('/releases', 'POST', body)
        rid = r.release.id
        setReleaseId(rid)
      }

      if (artworkFile) {
        await upload(`/releases/${rid}/artwork`, artworkFile)
        setArtworkFile(undefined); setArtworkCleared(false)
      } else if (artworkCleared && artworkId) {
        await api(`/releases/${rid}/artwork`, 'DELETE')
        setArtworkId(null); setArtworkCleared(false)
      }

      const base = `/releases/${rid}/tracks`
      while (pending.length) {
        await api(`${base}/${pending[0]}`, 'DELETE')
        pending.shift()
      }
      setRemoved([])

      for (const t of tracks) {
        if (t.id) {
          await api(`${base}/${t.id}`, 'PATCH', toTrackInput(inherit(t)))
        } else {
          const r = await api<{ track: Track }>(base, 'POST', toTrackInput(inherit(t)))
          t.id = r.track.id
        }
        if (t.audioFile) {
          // The server reads the real format, bitrate and length from the file.
          const r = await upload<{ audio: Record<string, any>; durationSeconds: number | null }>(`${base}/${t.id}/audio/file`, t.audioFile)
          t.audio = {
            fileName: r.audio.file_name, format: r.audio.format, bitrateKbps: r.audio.bitrate_kbps,
            sampleRateHz: r.audio.sample_rate_hz, channels: r.audio.channels, sizeBytes: r.audio.size_bytes,
          }
          if (r.durationSeconds) t.durationSeconds = r.durationSeconds
          t.audioFile = undefined
          t.hadAudio = true
        } else if (!t.audio && t.hadAudio) {
          await api(`${base}/${t.id}/audio`, 'DELETE')
          t.hadAudio = false
          t.durationSeconds = null
        }
        await api(`${base}/${t.id}/collaborators`, 'PUT', { collaborators: t.collaborators })
      }

      if (save === 'notify') {
        await api(`/releases/${rid}/notices/send`, 'POST')
        return nav(`/releases/${rid}`)
      }
      nav(`/releases/${rid}`)
    } catch (e) {
      const ae = e as ApiError & { problems?: string[] }
      setForm({ ...form, tracks })
      setRemoved(pending)
      setErr({ error: ae.message, details: ae.details ?? ae.problems })
      setUsageKey((k) => k + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally { setBusy(false) }
  }

  // Collaborators other than the owner, so their emails can be confirmed before the release is locked.
  const people = form.tracks.flatMap((t, ti) =>
    t.collaborators.map((c, i) => ({ ti, i, name: c.legalName, email: c.invitedEmail ?? '', skip: !!c.removedByWriter })),
  ).filter((p) => !p.skip && p.name.trim().toLowerCase() !== owner.legalName.trim().toLowerCase())
  const removeActive = () => {
    const t = form.tracks[active]
    if (t.id) setRemoved([...removed, t.id])
    setForm({ ...form, tracks: form.tracks.filter((_, j) => j !== active) })
    setActive(0)
  }

  return (
    <div className="stack">
      {backButton}
      <h1>{id ? 'Edit draft' : isSong ? 'New Song Listing' : 'New Album / EP Listing'}</h1>
      <SaveBar dirty={dirty} busy={busy} onSave={() => void submit('draft')} onCancel={goBack}>
        {people.some((p) => p.email.trim()) &&
          <button type="button" className="secondary" disabled={busy} onClick={() => void submit('notify')}>Save &amp; ask co-writers to confirm</button>}
      </SaveBar>
      {err && <ErrorBox error={err.error} details={err.details} />}

      <Collapsible title="Release info">
        <div className="split">
        <div className="grid2">
          {!isSong && <label>Release title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>}
          {!isSong && <label>Type<select value={form.releaseType} onChange={(e) => setForm({ ...form, releaseType: e.target.value as ReleaseForm['releaseType'] })}><option value="ep">EP</option><option value="album">Album</option></select></label>}
          <label>Main artist name<input value={form.albumArtist} onChange={(e) => setForm({ ...form, albumArtist: e.target.value })} /></label>
          {!isSong && <SelectOrOther label="Genre (songs without their own use this)" options={GENRES} value={form.genre} onChange={(v) => setForm({ ...form, genre: v })} otherPlaceholder="Type the genre" />}
          <label>Release date (to streaming services)<input type="date" value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} /></label>
          <label>Label (optional)<input value={form.labelName} onChange={(e) => setForm({ ...form, labelName: e.target.value })} placeholder="Leave blank if you release independently" /></label>
          <label>Main language
            <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
              <option value="">Not specified</option>
              {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              {form.language && !LANGUAGES.some(([c]) => c === form.language) && <option value={form.language}>{form.language}</option>}
            </select>
          </label>
          <label>UPC (optional)
            <input inputMode="numeric" value={form.upc} onChange={(e) => setForm({ ...form, upc: e.target.value })} placeholder="12 or 13 digits" />
            <small className="hint">The barcode for the release, on singles too. Your distributor assigns one if you don't have it.</small>
          </label>
        </div>
        <ImagePicker label="Cover art" hint="Square JPEG or PNG, at least 1400 x 1400 pixels for most stores."
          mediaId={artworkCleared ? null : artworkId} file={artworkFile} maxBytes={usage?.limits.maxCoverBytes ?? 1024 * 1024}
          onPick={(f) => { setArtworkFile(f); setArtworkCleared(false) }}
          onClear={() => { setArtworkFile(undefined); setArtworkCleared(true) }} />
        </div>
      </Collapsible>

      {!isSong && (
        <div className="tabs">
          {form.tracks.map((t, i) => <button key={i} className={i === active ? 'tab on' : 'tab'} onClick={() => setActive(i)}>{i + 1}. {t.title || 'Untitled'}</button>)}
          <button className="tab" onClick={() => { setForm({ ...form, tracks: [...form.tracks, emptyTrack(owner)] }); setActive(form.tracks.length) }}>+ Add song</button>
        </div>
      )}

      <TrackEditor key={active} track={form.tracks[active]} onChange={(t) => setTrack(active, t)} hideTitle={false} maxAudioBytes={usage?.limits.maxAudioBytes} releaseId={releaseId} />
      <UsageLine usage={usage} />
      {!isSong && form.tracks.length > 1 && (
        <button className="ghost danger" onClick={removeActive}>Remove this song</button>
      )}
      {backModal}
    </div>
  )
}
