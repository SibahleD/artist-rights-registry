import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import TrackEditor from '../components/TrackEditor'
import { ErrorBox, Loading, Modal } from '../components/ui'
import type {
  Collaborator, CollaboratorInput, Release, ReleaseForm, ReleaseInput, Track, TrackForm, TrackInput,
} from '../types'
import backIco from '../assets/ico/chevron-down.svg'

const emptyTrack = (owner: CollaboratorInput): TrackForm => ({
  title: '', compositionTitle: '', artistName: '', genre: '', isrc: '', iswc: '',
  durationSeconds: null, explicit: '',
  compositionCopyrightYear: null, compositionCopyright: '',
  recordingCopyrightYear: null, recordingCopyright: '',
  audio: null, collaborators: [{ ...owner }],
})

const toTrackInput = (t: TrackForm): TrackInput => ({
  title: t.title,
  compositionTitle: t.compositionTitle || null,
  artistName: t.artistName || null,
  genre: t.genre || null,
  isrc: t.isrc || null,
  iswc: t.iswc || null,
  durationSeconds: t.durationSeconds,
  explicit: t.explicit || null,
  compositionCopyrightYear: t.compositionCopyrightYear,
  compositionCopyright: t.compositionCopyright || null,
  recordingCopyrightYear: t.recordingCopyrightYear,
  recordingCopyright: t.recordingCopyright || null,
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
      }))
    : [{ ...owner }],
})

export default function ListingForm({ mode }: { mode: 'song' | 'album' }) {
  const { id } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()

  // The owner is listed as a collaborator with no email: linking their own email would make
  // their own releases show up under "Collaborations".
  const owner = useMemo<CollaboratorInput>(() => ({
    legalName: [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.artist_name || '',
    role: 'songwriter',
    ownershipPercent: 100,
  }), [user])

  const [form, setForm] = useState<ReleaseForm | null>(id ? null : {
    releaseType: mode === 'song' ? 'single' : 'album', title: '', albumArtist: user?.artist_name ?? '',
    releaseDate: '', upc: '', tracks: [emptyTrack(owner)],
  })
  const [releaseId, setReleaseId] = useState<string | undefined>(id)
  const [removed, setRemoved] = useState<string[]>([]) // server track ids to delete on save
  const [active, setActive] = useState(0)
  const [err, setErr] = useState<{ error: string; details?: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const { release } = await api<{ release: Release }>(`/releases/${id}`)
      if (release.status !== 'draft') return nav(`/releases/${id}`)
      const { tracks } = await api<{ tracks: Track[] }>(`/releases/${id}/tracks`)
      const splits = await Promise.all(
        tracks.map((t) => api<{ collaborators: Collaborator[] }>(`/releases/${id}/tracks/${t.id}/collaborators`)),
      )
      setForm({
        releaseType: release.release_type,
        title: release.title,
        albumArtist: release.album_artist,
        releaseDate: release.release_date ?? '',
        upc: release.upc ?? '',
        tracks: tracks.length
          ? tracks.map((t, i) => fromServerTrack(t, splits[i].collaborators, owner))
          : [emptyTrack(owner)],
      })
    })().catch((e) => setErr({ error: e.message }))
  }, [id, nav, owner])

  if (!form) return err ? <ErrorBox error={err.error} /> : <Loading />
  const isSong = form.releaseType === 'single'
  const setTrack = (i: number, t: TrackForm) => setForm({ ...form, tracks: form.tracks.map((x, j) => (j === i ? t : x)) })

  // Release -> tracks -> audio -> collaborators, then (optionally) mark ready.
  // Ids are remembered as we go, so a retry after a partial failure updates instead of duplicating.
  async function submit(save: 'draft' | 'release') {
    if (!form) return
    setBusy(true); setErr(null)
    const tracks = form.tracks.map((t) => ({ ...t }))
    const pending = [...removed]
    let rid = releaseId
    try {
      const body: ReleaseInput = {
        title: isSong ? tracks[0]?.title : form.title,
        releaseType: form.releaseType,
        albumArtist: form.albumArtist,
        releaseDate: form.releaseDate || null,
        upc: form.upc || null,
      }
      if (rid) {
        await api(`/releases/${rid}`, 'PATCH', body)
      } else {
        const r = await api<{ release: Release }>('/releases', 'POST', body)
        rid = r.release.id
        setReleaseId(rid)
      }

      const base = `/releases/${rid}/tracks`
      while (pending.length) {
        await api(`${base}/${pending[0]}`, 'DELETE')
        pending.shift()
      }
      setRemoved([])

      for (const t of tracks) {
        if (t.id) {
          await api(`${base}/${t.id}`, 'PATCH', toTrackInput(t))
        } else {
          const r = await api<{ track: Track }>(base, 'POST', toTrackInput(t))
          t.id = r.track.id
        }
        if (t.audio) {
          await api(`${base}/${t.id}/audio`, 'PUT', t.audio)
          t.hadAudio = true
        } else if (t.hadAudio) {
          await api(`${base}/${t.id}/audio`, 'DELETE')
          t.hadAudio = false
        }
        await api(`${base}/${t.id}/collaborators`, 'PUT', { collaborators: t.collaborators })
      }

      if (save === 'release') await api(`/releases/${rid}/ready`, 'POST')
      nav(save === 'draft' ? '/discography' : `/releases/${rid}`)
    } catch (e) {
      const ae = e as ApiError & { problems?: string[] }
      setForm({ ...form, tracks })
      setRemoved(pending)
      setErr({ error: ae.message, details: ae.details ?? ae.problems })
      setConfirm(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally { setBusy(false) }
  }

  // Collaborators other than the owner, so their emails can be confirmed before the release is locked.
  const people = form.tracks.flatMap((t, ti) =>
    t.collaborators.map((c, i) => ({ ti, i, name: c.legalName, email: c.invitedEmail ?? '' })),
  ).filter((p) => p.name.trim().toLowerCase() !== owner.legalName.trim().toLowerCase())
  const setEmail = (p: (typeof people)[number], email: string) => {
    const t = form.tracks[p.ti]
    setTrack(p.ti, { ...t, collaborators: t.collaborators.map((c, j) => (j === p.i ? { ...c, invitedEmail: email } : c)) })
  }

  const removeActive = () => {
    const t = form.tracks[active]
    if (t.id) setRemoved([...removed, t.id])
    setForm({ ...form, tracks: form.tracks.filter((_, j) => j !== active) })
    setActive(0)
  }

  return (
    <div className="stack">
      <h1>{id ? 'Edit draft' : isSong ? 'New Song Listing' : 'New Album / EP Listing'}</h1>
      {err && <ErrorBox error={err.error} details={err.details} />}

      <section className="card">
        <div className="row section-title">
            <img className="collapse-icon" src={backIco}/>
        <h4>Release info</h4>
        </div>
        <div className="grid2">
          {!isSong && <label>Release title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>}
          {!isSong && <label>Type<select value={form.releaseType} onChange={(e) => setForm({ ...form, releaseType: e.target.value as ReleaseForm['releaseType'] })}><option value="ep">EP</option><option value="album">Album</option></select></label>}
          <label>Main artist name<input value={form.albumArtist} onChange={(e) => setForm({ ...form, albumArtist: e.target.value })} /></label>
          <label>Release date (to streaming services)<input type="date" value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} /></label>
          {!isSong && <label>UPC (optional)<input value={form.upc} onChange={(e) => setForm({ ...form, upc: e.target.value })} placeholder="12 or 13 digits" /></label>}
        </div>
      </section>

      {!isSong && (
        <div className="tabs">
          {form.tracks.map((t, i) => <button key={i} className={i === active ? 'tab on' : 'tab'} onClick={() => setActive(i)}>{i + 1}. {t.title || 'Untitled'}</button>)}
          <button className="tab" onClick={() => { setForm({ ...form, tracks: [...form.tracks, emptyTrack(owner)] }); setActive(form.tracks.length) }}>+ Add song</button>
        </div>
      )}

      <TrackEditor key={active} track={form.tracks[active]} onChange={(t) => setTrack(active, t)} hideTitle={false} />
      {!isSong && form.tracks.length > 1 && (
        <button className="ghost danger" onClick={removeActive}>Remove this song</button>
      )}

      <div className="row actions">
        <button disabled={busy} onClick={() => setConfirm(true)}>Save Release</button>
        <button className="secondary" disabled={busy} onClick={() => submit('draft')}>Save as Draft</button>
        <button className="ghost" onClick={() => nav('/discography')}>Cancel</button>
      </div>

      {confirm && (
        <Modal title="Confirm release" onClose={() => setConfirm(false)}>
          <p>Saving marks this release as ready and locks the ownership splits. Collaborators whose email matches an account will see the song under Collaborations when they log in, including people who sign up later with that email.</p>
          {people.length === 0 && <p className="muted">You haven't added anyone else, so nobody else will see this release.</p>}
          {people.map((p) => (
            <label key={`${p.ti}-${p.i}`}>{p.name || '(unnamed)'}
              <input type="email" value={p.email} placeholder="their email" onChange={(e) => setEmail(p, e.target.value)} /></label>
          ))}
          <div className="row actions">
            <button disabled={busy} onClick={() => submit('release')}>{busy ? 'Saving…' : 'Save & mark ready'}</button>
            <button className="ghost" onClick={() => setConfirm(false)}>Back</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
