import { useCallback, useEffect, useState } from 'react'
import { api, fetchBlob, upload } from '../api'
import { AuthImage, vinylFallback } from './files'
import { ConfirmModal, Collapsible, ErrorBox, Hint } from './ui'
import { Spinner } from './Skeleton'
import { makeClip } from '../lib/audioClip'
import { releaseTypeLabel, type ReleaseLine, type Selection } from '../lib/performance'
import type { Track } from '../types'

interface Fit { id: string; label: string; fit: number; band: string; why: string[] }
interface Features { acousticness?: number; danceability?: number; energy?: number; instrumentalness?: number; liveness?: number; loudness?: number; speechiness?: number; tempo?: number; valence?: number }
interface Analysis { track_id: string; features: Features; summary: string[]; projections: Fit[]; clip_start_seconds: number; analysed_at: string }

const pct = (v?: number) => (v === undefined ? '—' : `${Math.round(v * 100)}%`)
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// What each number means, in plain words.
const FEATURE_ROWS: [keyof Features, string, (v?: number) => string][] = [
  ['energy', 'Energy', pct], ['danceability', 'Danceability', pct], ['valence', 'Mood (higher is happier)', pct],
  ['acousticness', 'Acoustic', pct], ['instrumentalness', 'Instrumental', pct], ['speechiness', 'Spoken words', pct], ['liveness', 'Live feel', pct],
  ['tempo', 'Tempo', (v) => (v === undefined ? '—' : `${Math.round(v)} BPM`)], ['loudness', 'Loudness', (v) => (v === undefined ? '—' : `${v.toFixed(1)} dB`)],
]

// "Playlist Projections": how well each song's sound matches the usual sound of different kinds of playlist, worked out from audio
// features that ReccoBeats estimates from a 30-second clip. It is an estimate of fit, not a forecast of streams or a promise of placement.
export default function PlaylistProjections({ lines, sel }: { lines: ReleaseLine[]; sel: Selection }) {
  const [data, setData] = useState<Map<string, Analysis> | null>(null)
  const [error, setError] = useState('')
  const [ask, setAsk] = useState<{ rel: ReleaseLine; id: string; title: string } | null>(null)
  const [busy, setBusy] = useState<{ id: string; step: string } | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    try { const r = await api<{ songs: Analysis[] }>('/streams/projections'); setData(new Map(r.songs.map((s) => [s.track_id, s]))) }
    catch (e) { setError((e as Error).message); setData(new Map()) }
  }, [])
  useEffect(() => { load() }, [load])

  // The same scope as the rest of the page: one song, one release, or everything.
  const rows = lines.flatMap((rel) => rel.tracks
    .filter((t) => !sel || (sel.kind === 'track' ? sel.id === t.id : sel.id === rel.id))
    .map((t) => ({ rel, t })))

  async function analyse() {
    if (!ask) return
    const { rel, id } = ask
    setAsk(null); setError(''); setBusy({ id, step: 'Loading the song…' })
    try {
      const { tracks } = await api<{ tracks: Track[] }>(`/releases/${rel.id}/tracks`)
      const meta = tracks.find((x) => x.id === id)
      const song = await fetchBlob(`/releases/${rel.id}/tracks/${id}/audio/file`)
      setBusy({ id, step: 'Cutting a 30-second clip…' })
      const { clip, start } = await makeClip(song, meta?.preview_start_seconds)
      setBusy({ id, step: 'Analysing…' })
      const result = await upload<Analysis>(`/releases/${rel.id}/tracks/${id}/audio-features`, new File([clip], 'clip.wav', { type: 'audio/wav' }), 'POST', { start: String(start) })
      setData((m) => new Map(m).set(id, result))
      setOpen((o) => ({ ...o, [id]: true }))
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(null) }
  }

  async function remove(rel: ReleaseLine, id: string) {
    setError('')
    try { await api(`/releases/${rel.id}/tracks/${id}/audio-features`, 'DELETE'); setData((m) => { const n = new Map(m); n.delete(id); return n }) }
    catch (e) { setError((e as Error).message) }
  }

  return (
    <section className="card proj" aria-label="Playlist Projections">
      <h4>Playlist Projections</h4>
      <p className="muted">How closely each song’s sound matches the usual sound of different kinds of playlist, before it has any streams. These are estimates from the audio itself, not a forecast of streams or a promise of playlist placement.</p>

      <Collapsible title="Why audio features matter" defaultOpen={false} level="h4" className="proj-why">
        <div className="stack tight">
          <p>Streaming apps recommend music in two main ways. One looks at <strong>listening behaviour</strong>: people who played this also played that. The other looks at the <strong>sound itself</strong>: tempo, energy, mood, how acoustic it is.</p>
          <p>A brand-new or unreleased song has no listening history, so the first way has nothing to work with. This is called the cold-start problem. The sound is all there is, so audio features are how a new song gets placed next to similar songs, and how playlists built around a mood or activity (workout, chill, party) can be matched to it.</p>
          <p>The numbers here come from ReccoBeats, which estimates them from a 30-second clip. The playlist fits are our own rule of thumb on top of them: each playlist type has a typical range for energy, tempo and so on, and a song scores higher the closer it falls. Real placement also depends on listeners, editors and your metadata, so treat a high fit as “this sound belongs there”, not “this will get in”.</p>
        </div>
      </Collapsible>

      {error && <ErrorBox error={error} />}
      {!data ? <Spinner label="Loading projections" /> : rows.length === 0 ? <p className="muted">No songs to show.</p> : (
        <div className="proj-list">
          {rows.map(({ rel, t }) => {
            const a = data.get(t.id)
            const working = busy?.id === t.id
            const isOpen = !!open[t.id]
            return (
              <div className="proj-row" key={t.id}>
                <div className="proj-head">
                  <span className="perf-art"><AuthImage mediaId={rel.artworkId} alt="" fallback={vinylFallback} /></span>
                  <span className="perf-item-text">
                    <b className="perf-item-title">{t.title}</b>
                    <span className="perf-item-type">{rel.type === 'single' ? 'Single' : `${releaseTypeLabel(rel.type)} · track ${t.trackNumber}`}</span>
                  </span>
                  <span className="proj-actions">
                    {working
                      ? <span className="muted"><Spinner size={14} label={busy.step} /> {busy.step}</span>
                      : a
                        ? <button type="button" className="ghost" onClick={() => setAsk({ rel, id: t.id, title: t.title })} disabled={!!busy}>Analyse again</button>
                        : <button type="button" className="secondary" disabled={!t.hasAudio || !!busy} onClick={() => setAsk({ rel, id: t.id, title: t.title })}>Analyse 30 seconds</button>}
                  </span>
                </div>

                {!a && !t.hasAudio && <small className="muted">Add an audio file to this song to see its projections.</small>}
                {!a && t.hasAudio && !working && <small className="muted">Not analysed yet.</small>}

                {a && (
                  <>
                    <div className="proj-summary">{a.summary.map((s) => <span key={s} className="tag-pill">{s}</span>)}</div>
                    <ul className="fit-list">
                      {a.projections.slice(0, isOpen ? a.projections.length : 3).map((p) => (
                        <li key={p.id}>
                          <span className="fit-label">{p.label}</span>
                          <span className="bar-track" role="img" aria-label={`${p.label}: ${p.fit} out of 100, ${p.band}`}><span className="bar-fill" style={{ width: `${Math.max(2, p.fit)}%` }} /></span>
                          <span className="fit-value"><b>{p.fit}</b> <span className="muted">{p.band}</span></span>
                          {isOpen && p.why.length > 0 && <small className="fit-why muted">Matches on {p.why.join(' and ')}.</small>}
                        </li>
                      ))}
                    </ul>
                    <div className="row proj-foot">
                      <button type="button" className="ghost" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [t.id]: !isOpen })}>{isOpen ? 'Show less' : 'All playlist types and the numbers'}</button>
                      <button type="button" className="ghost danger" onClick={() => remove(rel, t.id)}>Remove analysis</button>
                    </div>
                    {isOpen && (
                      <div className="stack tight">
                        <dl className="feature-grid">
                          {FEATURE_ROWS.map(([k, label, fmt]) => <div key={k}><dt>{label}</dt><dd>{fmt(a.features[k])}</dd></div>)}
                        </dl>
                        <Hint>Analysed from the 30 seconds starting at {mmss(a.clip_start_seconds)}, on {new Date(a.analysed_at).toLocaleDateString()}. Different parts of a song can score differently.</Hint>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {ask && (
        <ConfirmModal title="Send a 30-second clip for analysis?" confirmLabel="Send clip and analyse" onConfirm={analyse} onClose={() => setAsk(null)}>
          <p>To estimate the sound of “{ask.title}”, a 30-second clip of it will be sent to <strong>ReccoBeats</strong>, an outside service. Only the clip is sent, not the whole song, and it is not saved here. We keep just the numbers that come back.</p>
          <p className="muted">If this song is unreleased and you would rather not share any of it, cancel. Nothing is sent until you confirm.</p>
        </ConfirmModal>
      )}
    </section>
  )
}
