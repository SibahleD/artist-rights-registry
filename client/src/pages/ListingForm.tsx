import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, ApiError, upload } from '../api'
import { useAuth } from '../auth'
import TrackEditor, { EXPLICIT_LABELS, type SongSection } from '../components/TrackEditor'
import ImagePicker from '../components/ImagePicker'
import { UsageLine, useUsage } from '../components/files'
import { ConfirmModal, ErrorBox, Loading, Panel } from '../components/ui'
import SaveBar from '../components/SaveBar'
import { useBackGuard } from '../components/UnsavedGuard'
import type {
  Collaborator, CollaboratorInput, ContributorsPayload, CreditRow, Notice, Release, ReleaseForm, ReleaseInput, Track, TrackForm, TrackInput,
} from '../types'
import CoverArtGuide from '../components/CoverArtGuide'
import CreditsEditor from '../components/CreditsEditor'
import PrimaryArtistsEditor from '../components/PrimaryArtistsEditor'
import { Req, RequiredNote } from '../components/Required'
import {
  boolToYesNo, cleanArtists, cleanCredits, dateOrderProblem, formatStartTime, parseStartTime, validateDistribution, yesNoToBool,
} from '../lib/distribution'
import { GENRES, LANGUAGES } from '../data/options'
import { EXPLICIT_VALUES } from '../types'
import SelectOrOther from '../components/SelectOrOther'
import { featuredCredit, featuredNames, toCollaboratorInput } from '../lib/collab'
import { useGlowField } from '../components/useGlowField'

type Part = 'release' | 'songs'
type ReleaseSection = 'info' | 'cover' | 'dates' | 'artists'
const RELEASE_TABS: [ReleaseSection, string][] = [['info', 'General info'], ['cover', 'Cover art'], ['dates', 'Dates and distribution'], ['artists', 'Artists and credits']]
const SONG_TABS: [SongSection, string][] = [['general', 'General info'], ['audio', 'Audio file'], ['publishing', 'Publishing info'], ['credits', 'Credits'], ['splits', 'Royalty splits']]

const FIELD_HOME: Record<string, [Part, ReleaseSection | SongSection]> = {
  'release-date': ['release', 'info'], upc: ['release', 'info'],
  'cover-art': ['release', 'cover'],
  'sales-start': ['release', 'dates'], 'originally-released': ['release', 'dates'], preorder: ['release', 'dates'],
  'primary-artists': ['release', 'artists'],
  'song-info': ['songs', 'general'], 'artist-info': ['songs', 'general'], 'track-info': ['songs', 'general'], 'featured-artists': ['songs', 'general'], 'track-lyrics': ['songs', 'general'],
  'track-audio': ['songs', 'audio'], 'track-preview': ['songs', 'audio'],
  'track-isrc': ['songs', 'publishing'],
  'track-splits': ['songs', 'splits'],
}

const emptyTrack = (owner: CollaboratorInput): TrackForm => ({
  title: '', compositionTitle: '', artistName: '', genre: '', isrc: '', iswc: '',
  durationSeconds: null, explicit: '',
  compositionCopyrightYear: new Date().getFullYear(), compositionCopyright: owner.legalName,
  recordingCopyrightYear: new Date().getFullYear(), recordingCopyright: owner.legalName,
  origin: 'original', versionTitle: '', language: '',
  hasLyrics: '', previewStart: '', credits: [],
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
  hasLyrics: yesNoToBool(t.hasLyrics),

  previewStartSeconds: (() => { const p = parseStartTime(t.previewStart); return p.ok ? p.seconds : null })(),
})

const fromServerTrack = (t: Track, collabs: Collaborator[], owner: CollaboratorInput, credits: CreditRow[]): TrackForm => ({
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
  hasLyrics: boolToYesNo(t.has_lyrics),
  previewStart: formatStartTime(t.preview_start_seconds),
  credits,
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

const defaultOriginal = (releaseDate: string, salesStart: string) =>
  releaseDate && salesStart && salesStart < releaseDate ? salesStart : releaseDate

export default function ListingForm({ mode }: { mode: 'song' | 'album' }) {
  const { id } = useParams()
  const [params] = useSearchParams()
  const wantedTrack = Number(params.get('track')) || 0
  const focusField = params.get('focus') 
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
    releaseDate: '', genre: '', upc: '', labelName: '', language: '',
    albumVersion: '', isCompilation: false, hasLyrics: '', hasCoverVersions: null, explicit: '', secondaryGenre: '',
    originallyReleased: '', preorderDate: '', salesStartDate: '', primaryArtists: [], credits: [],
    tracks: [emptyTrack(owner)],
  })
  const [releaseId, setReleaseId] = useState<string | undefined>(id)
  const [active, setActive] = useState(0)
  const home = focusField ? FIELD_HOME[focusField] : undefined
  const [part, setPart] = useState<Part>(home?.[0] ?? 'release')
  const [relTab, setRelTab] = useState<ReleaseSection>(home?.[0] === 'release' ? (home[1] as ReleaseSection) : 'info')
  const [songTab, setSongTab] = useState<SongSection>(home?.[0] === 'songs' ? (home[1] as SongSection) : 'general')
  
  const [glow, setGlow] = useState(focusField)
  useGlowField(glow, form !== null, [active, part, relTab, songTab])
  const [removed, setRemoved] = useState<string[]>([])
  
  const [rereleased, setRereleased] = useState(focusField === 'originally-released')
  const [err, setErr] = useState<{ error: string; details?: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [artworkFile, setArtworkFile] = useState<File | undefined>()
  const [artworkId, setArtworkId] = useState<string | null>(null)
  const [artworkCleared, setArtworkCleared] = useState(false)
  const [artChecked, setArtChecked] = useState(false) 
  const [usageKey, setUsageKey] = useState(0)
  const usage = useUsage(usageKey)

  const snapshot = form ? JSON.stringify([form, removed, !!artworkFile, artworkCleared]) : null
  const [baseline, setBaseline] = useState<string | null>(null)
  useEffect(() => { if (snapshot && baseline === null) setBaseline(snapshot) }, [snapshot, baseline])
  const dirty = snapshot !== null && baseline !== null && snapshot !== baseline

  const { goBack, modal: backModal, backButton, allowLeave } = useBackGuard({
    dirty, onSave: () => submit({ navigate: false }), saveLabel: 'Save',
  })
  const [deleting, setDeleting] = useState<number | null>(null)

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
      const contrib = await api<ContributorsPayload>(`/releases/${id}/contributors`)
      const creditsFor = (n: number | null): CreditRow[] => contrib.credits.filter((c) => c.track_number === n).map(({ name, title }) => ({ name, title }))
      setForm({
        releaseType: release.release_type,
        title: release.title,
        albumArtist: release.album_artist,
        releaseDate: release.release_date ?? '',
        genre: release.genre ?? '',
        upc: release.upc ?? '',
        labelName: release.label_name ?? '',
        language: release.language ?? '',
        albumVersion: release.album_version ?? '',
        isCompilation: !!release.is_compilation,
        hasLyrics: boolToYesNo(release.has_lyrics),
        hasCoverVersions: release.has_cover_versions ?? null,
        explicit: release.explicit ?? '',
        secondaryGenre: release.secondary_genre ?? '',
        originallyReleased: release.originally_released ?? '',
        preorderDate: release.preorder_date ?? '',
        salesStartDate: release.sales_start_date ?? '',
        primaryArtists: contrib.primary_artists,
        credits: creditsFor(null),
        tracks: tracks.length
          ? tracks.map((t, i) => fromServerTrack(t, splits[i].collaborators, owner, creditsFor(t.track_number)))
          : [emptyTrack(owner)],
      })
      setRereleased((was) => was || (!!release.originally_released && release.originally_released !== defaultOriginal(release.release_date ?? '', release.sales_start_date ?? '')))
      if (wantedTrack > 0 && tracks.length) setActive(Math.min(wantedTrack, tracks.length) - 1)
    })().catch((e) => setErr({ error: e.message }))
  }, [id, nav, owner, wantedTrack])

  if (!form) return err ? <ErrorBox error={err.error} /> : <Loading what="Opening the form" variant="form" />
  const isSong = form.releaseType === 'single'
  const showRelease = (t: ReleaseSection) => part === 'release' && relTab === t
  const pickPart = (p: Part) => { setGlow(null); setPart(p) }
  const setTrack = (i: number, t: TrackForm) => setForm({ ...form, tracks: form.tracks.map((x, j) => (j === i ? t : x)) })
  
  const setSongTitle = (v: string) => {
    const t = form.tracks[0]
    setTrack(0, { ...t, title: v, compositionTitle: !t.compositionTitle || t.compositionTitle === t.title ? v : t.compositionTitle })
  }
 
  const originallyReleased = rereleased ? form.originallyReleased : defaultOriginal(form.releaseDate, form.salesStartDate)
  const checkForm = { ...form, originallyReleased }

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
    // Catch mistakes before anything is saved, so a refusal never leaves the release half-written.
    const problems = validateDistribution(checkForm)
    if (problems.length) {
      setErr({ error: 'Fix these before saving.', details: problems })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return false
    }
    setBusy(true); setErr(null)
    const tracks = form.tracks.map((t) => ({ ...t, featuring: cleanArtists(t.featuring) }))
    const inherit = (t: TrackForm): TrackForm => (!isSong && !t.genre && form.genre ? { ...t, genre: form.genre } : t)
    const pending = [...removed]
    const notes: string[] = []
    let rid = releaseId
    const hadRelease = !!releaseId
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
        // A single has no album-level version or compilation flag, and its lyrics and explicit answers are the song's.
        albumVersion: isSong ? null : form.albumVersion.trim() || null,
        isCompilation: isSong ? false : form.isCompilation,
        hasLyrics: yesNoToBool(isSong ? tracks[0]?.hasLyrics ?? '' : form.hasLyrics),
        hasCoverVersions: isSong ? null : form.hasCoverVersions,
        explicit: (isSong ? tracks[0]?.explicit : form.explicit) || null,
        secondaryGenre: form.secondaryGenre.trim() || null,
        originallyReleased: originallyReleased || null,
        preorderDate: form.preorderDate || null,
        salesStartDate: form.salesStartDate || null,
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

      // Primary artists and credits are saved last, once every song has its number. The numbers are read back from the
      // server, so they stay right after songs were added or deleted. The whole list is replaced in one go.
      const artists = cleanArtists(form.primaryArtists)
      const releaseCredits = cleanCredits(form.credits)
      const songCredits = tracks.map((t) => cleanCredits(t.credits))
      if (hadRelease || artists.length || releaseCredits.length || songCredits.some((c) => c.length)) {
        const { tracks: saved } = await api<{ tracks: Track[] }>(base)
        const numberOf = new Map(saved.map((x) => [x.id, x.track_number]))
        const credits = [
          ...releaseCredits.map((c) => ({ track_number: null as number | null, ...c })),
          ...tracks.flatMap((t, i) => songCredits[i].map((c) => {
            const n = t.id ? numberOf.get(t.id) : undefined
            if (n === undefined) throw new Error('A song could not be matched to its credits. Reload the page and try again.')
            return { track_number: n as number | null, ...c }
          })),
        ]
        await api(`/releases/${rid}/contributors`, 'PUT', { primary_artists: artists, credits })
      }
      const tidy = { primaryArtists: artists, credits: releaseCredits }
      tracks.forEach((t, i) => { t.credits = songCredits[i] })

      // After the first save go straight to the splits; later saves go back to the release.
      if (notes.length && navigate) {
        // Something was kept on purpose: stay here so the message is read.
        setForm({ ...form, ...tidy, tracks }); setBaseline(null); setErr({ error: notes.join(' ') })
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
      <RequiredNote />

      <div className="tabs tabs-2" role="tablist" aria-label="Part of the listing">
        <button type="button" role="tab" aria-selected={part === 'release'} className={`tab${part === 'release' ? ' on' : ''}`} onClick={() => pickPart('release')}>Release</button>
        <button type="button" role="tab" aria-selected={part === 'songs'} className={`tab${part === 'songs' ? ' on' : ''}`} onClick={() => pickPart('songs')}>{isSong ? 'Song' : `Songs (${form.tracks.length})`}</button>
      </div>

      {part === 'songs' && !isSong && (
        <div className="tabs tabs-songs">
          {form.tracks.map((t, i) => (
            <div key={i} className={i === active ? 'tab-group on' : 'tab-group'}>
              <button type="button" className={i === active ? 'tab on' : 'tab'} onClick={() => { setGlow(null); setActive(i) }}>{i + 1}. {t.title || 'Untitled'}</button>
              {form.tracks.length > 1 && (
                <button type="button" className="tab-x" aria-label={`Delete ${t.title || 'song ' + (i + 1)}`} title="Delete this song" onClick={() => setDeleting(i)}>✕</button>
              )}
            </div>
          ))}
          <button type="button" className="tab" onClick={() => { setForm({ ...form, tracks: [...form.tracks, emptyTrack(owner)] }); setActive(form.tracks.length) }}>+ Add song</button>
        </div>
      )}

      <div className="tabs tabs-sub" role="tablist" aria-label={part === 'release' ? 'Release sections' : 'Song sections'}>
        {part === 'release'
          ? RELEASE_TABS.map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={relTab === k} className={`tab${relTab === k ? ' on' : ''}`} onClick={() => { setGlow(null); setRelTab(k) }}>{label}</button>)
          : SONG_TABS.map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={songTab === k} className={`tab${songTab === k ? ' on' : ''}`} onClick={() => { setGlow(null); setSongTab(k) }}>{label}</button>)}
      </div>

      {showRelease('info') && (
      <Panel title="Release info">
        <div className="grid2">
          {!isSong && <label>Release title<Req /><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>}
          {isSong && <label>Song title<Req /><input value={form.tracks[0].title} onChange={(e) => setSongTitle(e.target.value)} /></label>}
          {!isSong && <label>Type<select value={form.releaseType} onChange={(e) => setForm({ ...form, releaseType: e.target.value as ReleaseForm['releaseType'] })}><option value="ep">EP</option><option value="album">Album</option></select></label>}
          <label>Main artist name<Req /><input value={form.albumArtist} onChange={(e) => setForm({ ...form, albumArtist: e.target.value })} /></label>
          {isSong && <SelectOrOther label="Genre" options={GENRES} value={form.tracks[0].genre} onChange={(v) => setTrack(0, { ...form.tracks[0], genre: v })} otherPlaceholder="Type the genre" />}
          {!isSong && <SelectOrOther label="Genre (songs without their own use this)" options={GENRES} value={form.genre} onChange={(v) => setForm({ ...form, genre: v })} otherPlaceholder="Type the genre" />}
          <label data-field="release-date">Release date (to streaming services)<Req /><input type="date" value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} /></label>
          <label>Label (optional)<input value={form.labelName} onChange={(e) => setForm({ ...form, labelName: e.target.value })} placeholder="Leave blank if you release independently" /></label>
          <label>Main language
            <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
              <option value="">Not specified</option>
              {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              {form.language && !LANGUAGES.some(([c]) => c === form.language) && <option value={form.language}>{form.language}</option>}
            </select>
          </label>
          <label data-field="upc">UPC (optional)
            <input inputMode="numeric" value={form.upc} onChange={(e) => setForm({ ...form, upc: e.target.value })} placeholder="12 or 13 digits" />
            <small className="hint">The barcode for the release, on singles too. Your distributor assigns one if you don't have it.</small>
          </label>
        </div>
      </Panel>
      )}

      {showRelease('cover') && (
      <Panel title={<>Cover art<Req /></>} field="cover-art">
        <div className="stack">
          <ImagePicker label="Cover art" mediaId={artworkCleared ? null : artworkId} file={artworkFile} maxBytes={usage?.limits.maxCoverBytes ?? 25 * 1024 * 1024}
            onPick={(f) => { setArtworkFile(f); setArtworkCleared(false) }}
            onClear={() => { setArtworkFile(undefined); setArtworkCleared(true) }} />
          <CoverArtGuide confirmed={artChecked} onConfirm={setArtChecked} />
        </div>
      </Panel>
      )}

      {showRelease('dates') && (
      <Panel title="Dates and details for distributors">
        <p className="hint">Distributors usually ask for these. None of them stop you marking a release ready.</p>
        <div className="grid2">
          <label data-field="sales-start">Sales start date
            <input type="date" value={form.salesStartDate} onChange={(e) => setForm({ ...form, salesStartDate: e.target.value })} />
            <small className="hint">The first day the release can be sold or streamed.</small>
            {form.releaseDate && form.salesStartDate !== form.releaseDate && (
              <button type="button" className="ghost link-btn" onClick={() => setForm({ ...form, salesStartDate: form.releaseDate })}>Use the release date</button>
            )}
          </label>
          <div className="stack" data-field="originally-released">
            <label className="check-inline">
              <input type="checkbox" checked={rereleased} onChange={(e) => { setRereleased(e.target.checked); if (!e.target.checked) setForm({ ...form, originallyReleased: '' }) }} />
              <span>This music was released before</span>
            </label>
            {rereleased
              ? <label>Originally released
                  <input type="date" value={form.originallyReleased} onChange={(e) => setForm({ ...form, originallyReleased: e.target.value })} />
                  <small className="hint">The date it was first released anywhere. It can't be after the sales start date.</small>
                </label>
              : <small className="hint">Counted as new music, first released on the release date.</small>}
          </div>
          <label data-field="preorder">Pre-order date (optional)
            <input type="date" value={form.preorderDate} onChange={(e) => setForm({ ...form, preorderDate: e.target.value })} />
            <small className="hint">The day fans can start pre-ordering, if you offer it.</small>
          </label>
          <SelectOrOther label="Second genre (optional)" options={GENRES} value={form.secondaryGenre} onChange={(v) => setForm({ ...form, secondaryGenre: v })} otherPlaceholder="Type the genre" />
          {!isSong && <label>Album version (optional)
            <input value={form.albumVersion} maxLength={200} onChange={(e) => setForm({ ...form, albumVersion: e.target.value })} placeholder="Deluxe, Remastered, Anniversary edition…" />
          </label>}
          {!isSong && <label>Is this a compilation?
            <select value={form.isCompilation ? 'yes' : 'no'} onChange={(e) => setForm({ ...form, isCompilation: e.target.value === 'yes' })}>
              <option value="no">No</option><option value="yes">Yes, songs by different artists</option>
            </select>
          </label>}
          {!isSong && <label>Does the release contain cover versions?
            <select value={form.hasCoverVersions === null ? '' : form.hasCoverVersions ? 'yes' : 'no'}
              onChange={(e) => setForm({ ...form, hasCoverVersions: e.target.value === '' ? null : e.target.value === 'yes' })}>
              <option value="">Not answered</option><option value="yes">Yes</option><option value="no">No</option>
            </select>
            <small className="hint">Cover versions are songs written by someone else. If any song is a cover, answer Yes.</small>
          </label>}
          {!isSong && <label>Does the release have lyrics?
            <select value={form.hasLyrics} onChange={(e) => setForm({ ...form, hasLyrics: e.target.value as ReleaseForm['hasLyrics'] })}>
              <option value="">Not answered</option><option value="yes">Yes</option><option value="no">No (instrumental)</option>
            </select>
          </label>}
          {!isSong && <label>Explicit content (whole release)
            <select value={form.explicit} onChange={(e) => setForm({ ...form, explicit: e.target.value as ReleaseForm['explicit'] })}>
              <option value="">Not specified</option>
              {EXPLICIT_VALUES.map((v) => <option key={v} value={v}>{EXPLICIT_LABELS[v]}</option>)}
            </select>
          </label>}
        </div>
        {dateOrderProblem(originallyReleased, form.salesStartDate) && <small className="warn">{dateOrderProblem(originallyReleased, form.salesStartDate)}</small>}
        {isSong && <small className="hint">Lyrics and explicit content for a single are set on the song below.</small>}
      </Panel>
      )}

      {showRelease('artists') && (
      <Panel title="Artists and credits">
        <div data-field="primary-artists"><PrimaryArtistsEditor value={form.primaryArtists} onChange={(v) => setForm({ ...form, primaryArtists: v })} /></div>
        {!isSong && (
          <CreditsEditor legend="Release credits" value={form.credits} onChange={(v) => setForm({ ...form, credits: v })}
            hint="People who worked on the release as a whole, such as a producer or the cover designer. Credits for one song go on that song." />
        )}
      </Panel>
      )}

      {part === 'songs' && (
        <TrackEditor key={active} section={songTab} track={form.tracks[active]} onChange={(t) => setTrack(active, t)} hideTitle={isSong} hideGenre={isSong} maxAudioBytes={usage?.limits.maxAudioBytes} releaseId={releaseId} />
      )}
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
