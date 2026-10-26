import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, ApiError, upload } from '../api'
import { useAuth } from '../auth'
import TrackEditor from '../components/TrackEditor'
import ImagePicker from '../components/ImagePicker'
import { UsageLine, useUsage } from '../components/files'
import { Collapsible, ConfirmModal, ErrorBox, Loading } from '../components/ui'
import SaveBar from '../components/SaveBar'
import { useBackGuard } from '../components/UnsavedGuard'
import type {
  Collaborator, CollaboratorInput, Notice, Release, ReleaseForm, ReleaseInput, Track, TrackForm, TrackInput,
} from '../types'
import { GENRES, LANGUAGES } from '../data/options'
import SelectOrOther from '../components/SelectOrOther'
import { featuredCredit, featuredNames, toCollaboratorInput } from '../lib/collab'

// A new song starts with this year and the owner's legal name in both copyright lines, e.g. "© 2026 Jane Doe". Saved songs are never touched.
const emptyTrack = (owner: CollaboratorInput): TrackForm => ({
  title: '', compositionTitle: '', artistName: '', genre: '', isrc: '', iswc: '',
  durationSeconds: null, explicit: '',
  compositionCopyrightYear: new Date().getFullYear(), compositionCopyright: owner.legalName,
  recordingCopyrightYear: new Date().getFullYear(), recordingCopyright: owner.legalName,
  origin: 'original', versionTitle: '', language: '',
  audio: null, featuring: [], savedFeaturing: [], collaborators: [{ ...owner }],
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
  featuring: featuredNames(collabs),
  savedFeaturing: featuredNames(collabs),
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
    ? collabs.map(toCollaboratorInput)
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
  // Saving from the unsaved-changes modal must not navigate on its own: the guard then carries on to wherever the person was going.
  const { goBack, modal: backModal, backButton, allowLeave } = useBackGuard({
    dirty, onSave: () => submit({ navigate: false }), saveLabel: 'Save',
  })
  const [deleting, setDeleting] = useState<number | null>(null)   // index of the song waiting for a delete confirmation

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

  // Brings the saved featured credits in line with the Featuring tags, without touching anyone else's splits.
  // A featured artist who already has a share, or who has confirmed it, is kept: only the Splits page can take them off.
  async function syncFeatured(rid: string, t: TrackForm): Promise<string> {
    const lc = (x: string) => x.toLowerCase()
    const { collaborators } = await api<{ collaborators: Collaborator[] }>(`/releases/${rid}/tracks/${t.id}/collaborators`)
    const { notices } = await api<{ notices: Notice[] }>(`/releases/${rid}/notices`)
    const kept: string[] = []
    const next = collaborators.map(toCollaboratorInput).filter((c) => {
      if (!c.isFeatured || c.removedByWriter || t.featuring.some((w) => lc(w) === lc(c.legalName))) return true
      const confirmed = notices.some((n) => n.track_id === t.id && n.status === 'confirmed' && n.co_writer_name && lc(n.co_writer_name) === lc(c.legalName))
      if (c.ownershipPercent > 0 || confirmed) { kept.push(c.legalName); return true }
      return false
    })
    for (const w of t.featuring) if (!next.some((c) => lc(c.legalName) === lc(w))) next.push(featuredCredit(w))
    const { collaborators: saved } = await api<{ collaborators: Collaborator[] }>(`/releases/${rid}/tracks/${t.id}/collaborators`, 'PUT', { collaborators: next })
    t.featuring = featuredNames(saved); t.savedFeaturing = [...t.featuring]
    t.collaborators = saved.map(toCollaboratorInput)
    return kept.length ? `${kept.join(', ')} ${kept.length === 1 ? 'was' : 'were'} kept as credited because they have a share or have confirmed it. Change that on the Splits page.` : ''
  }

  // Release -> tracks -> audio. Splits are edited on the Splits page; a new song only gets the owner's own 100% credit.
  async function submit({ navigate = true }: { navigate?: boolean } = {}): Promise<boolean> {
    if (!form) return false
    setBusy(true); setErr(null)
    const tracks = form.tracks.map((t) => ({ ...t }))
    const inherit = (t: TrackForm): TrackForm => (!isSong && !t.genre && form.genre ? { ...t, genre: form.genre } : t)
    const pending = [...removed]
    const notes: string[] = []
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
        const isNew = !t.id
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
        if (isNew) {
          const own = t.collaborators.map((c) => c.legalName.trim().toLowerCase())
          const feat = t.featuring.filter((n) => !own.includes(n.toLowerCase()))
          await api(`${base}/${t.id}/collaborators`, 'PUT', { collaborators: [...t.collaborators, ...feat.map(featuredCredit)] })
          t.featuring = feat; t.savedFeaturing = feat
        } else if (JSON.stringify([...t.featuring].sort()) !== JSON.stringify([...t.savedFeaturing].sort())) {
          const note = await syncFeatured(rid!, t)
          if (note) notes.push(note)
        }
      }

      // After the first save go straight to the splits; later saves go back to the release.
      if (notes.length && navigate) {
        // Something was kept on purpose: stay here so the message is read.
        setForm({ ...form, tracks }); setBaseline(null); setErr({ error: notes.join(' ') })
        return true
      }
      if (navigate) { allowLeave(); nav(id ? `/releases/${rid}` : `/releases/${rid}/splits`, { state: id ? undefined : { first: true } }) }
      return true
    } catch (e) {
      const ae = e as ApiError & { problems?: string[] }
      setForm({ ...form, tracks })
      setRemoved(pending)
      setErr({ error: ae.message, details: ae.details ?? ae.problems })
      setUsageKey((k) => k + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return false
    } finally { setBusy(false) }
  }

  // Songs already saved are deleted on the server when the release is saved; unsaved ones just disappear.
  const removeTrack = (i: number) => {
    const t = form.tracks[i]
    if (t.id) setRemoved([...removed, t.id])
    setForm({ ...form, tracks: form.tracks.filter((_, j) => j !== i) })
    setActive(i < active ? active - 1 : Math.min(active, form.tracks.length - 2))
    setDeleting(null)
  }

  return (
    <div className="stack">
      {backButton}
      <h1>{id ? 'Edit draft' : isSong ? 'New Song Listing' : 'New Album / EP Listing'}</h1>
      <SaveBar dirty={dirty} busy={busy} onSave={() => void submit()} onCancel={goBack} />
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
        <div className="tabs tabs-songs">
          {form.tracks.map((t, i) => (
            <div key={i} className={i === active ? 'tab-group on' : 'tab-group'}>
              <button type="button" className={i === active ? 'tab on' : 'tab'} onClick={() => setActive(i)}>{i + 1}. {t.title || 'Untitled'}</button>
              {form.tracks.length > 1 && (
                <button type="button" className="tab-x" aria-label={`Delete ${t.title || 'song ' + (i + 1)}`} title="Delete this song" onClick={() => setDeleting(i)}>✕</button>
              )}
            </div>
          ))}
          <button className="tab" onClick={() => { setForm({ ...form, tracks: [...form.tracks, emptyTrack(owner)] }); setActive(form.tracks.length) }}>+ Add song</button>
        </div>
      )}

      <TrackEditor key={active} track={form.tracks[active]} onChange={(t) => setTrack(active, t)} hideTitle={false} maxAudioBytes={usage?.limits.maxAudioBytes} releaseId={releaseId} />
      <UsageLine usage={usage} />
      {backModal}
      {deleting !== null && form.tracks[deleting] && (
        <ConfirmModal title="Delete this song?" danger confirmLabel="Delete song" onConfirm={() => removeTrack(deleting)} onClose={() => setDeleting(null)}>
          <p>“{form.tracks[deleting].title || `Song ${deleting + 1}`}” will be removed from this release, together with its audio file and its splits.</p>
          <p className="muted">Nothing is deleted until you save. Leave without saving to keep it.</p>
        </ConfirmModal>
      )}
    </div>
  )
}
