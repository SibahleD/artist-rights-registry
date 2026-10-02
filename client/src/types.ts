// ── Constants (mirror the backend validators) ────────────────────────────────
export const RELEASE_TYPES = ['single', 'ep', 'album'] as const
export const COLLABORATOR_ROLES = ['composer', 'songwriter', 'publisher', 'producer', 'performer', 'other'] as const
export const EXPLICIT_VALUES = ['explicit', 'not_explicit', 'cleaned'] as const
export const AUDIO_FORMATS = ['mp3', 'flac', 'wav', 'aac', 'other'] as const

export type ReleaseType = (typeof RELEASE_TYPES)[number]
export type ReleaseStatus = 'draft' | 'ready'
export type CollaboratorRole = (typeof COLLABORATOR_ROLES)[number]
export type ExplicitValue = (typeof EXPLICIT_VALUES)[number]
export type AudioFormat = (typeof AUDIO_FORMATS)[number]

// ── Responses (snake_case, exactly as the API returns them) ──────────────────
export interface User {
  id: string
  email: string
  artist_name: string
  contact_info: string | null
  first_name?: string | null
  last_name?: string | null
  username?: string | null
  created_at: string
}

export interface ArtistLink { platform: string; url: string }

export interface Release {
  id: string
  owner_id: string
  title: string
  release_type: ReleaseType
  album_artist: string
  genre: string | null
  creation_date: string | null
  release_date: string | null // YYYY-MM-DD
  upc: string | null
  p_line: string | null
  c_line: string | null
  status: ReleaseStatus
  created_at: string
  ready_at: string | null
  track_count?: number // only on GET /releases
}

export interface AudioSpec {
  file_name: string
  format: AudioFormat
  bitrate_kbps: number | null
  sample_rate_hz: number | null
  channels: number | null
  size_bytes: number | null
  recorded_at?: string
}

export interface Track {
  id: string
  release_id?: string // not returned by GET /releases/:id
  track_number: number
  title: string
  composition_title?: string | null
  artist_name: string | null
  genre?: string | null
  isrc: string | null
  iswc?: string | null
  duration_seconds: number | null
  explicit: ExplicitValue | null
  composition_copyright_year?: number | null
  composition_copyright?: string | null
  recording_copyright_year?: number | null
  recording_copyright?: string | null
  created_at?: string
  audio?: AudioSpec | null // present on /tracks endpoints
}

export interface Collaborator {
  id: string
  track_id: string
  user_id: string | null
  invited_email: string | null
  legal_name: string
  role: CollaboratorRole
  ownership_percent: number | string // NUMERIC comes back as a string
  created_at: string
}

// GET /shared-tracks (tracks you collaborate on; only on ready releases)
export interface SharedTrack {
  id: string
  title: string
  track_number: number
  isrc: string | null
  iswc: string | null
  release_id: string
  release_title: string
  album_artist: string
  release_date: string | null
  owner_artist_name: string
  role: CollaboratorRole
  ownership_percent: number | string
}

// GET /shared-tracks/:trackId
export interface SharedTrackDetail {
  track: Omit<SharedTrack, 'role' | 'ownership_percent'> & {
    composition_title: string | null
    artist_name: string | null
    duration_seconds: number | null
    explicit: ExplicitValue | null
  }
  splits: { legal_name: string; role: CollaboratorRole; ownership_percent: number | string; is_you: boolean }[]
}

// ── Request bodies (camelCase, as the controllers expect) ────────────────────
export interface ReleaseInput {
  title?: string
  releaseType?: ReleaseType
  albumArtist?: string
  genre?: string | null
  releaseDate?: string | null
  upc?: string | null
  pLine?: string | null
  cLine?: string | null
}

export interface TrackInput {
  title?: string
  compositionTitle?: string | null
  artistName?: string | null
  genre?: string | null
  isrc?: string | null
  iswc?: string | null
  durationSeconds?: number | null
  explicit?: ExplicitValue | null
  compositionCopyrightYear?: number | null
  compositionCopyright?: string | null
  recordingCopyrightYear?: number | null
  recordingCopyright?: string | null
}

export interface AudioInput {
  fileName: string
  format: AudioFormat
  bitrateKbps?: number | null
  sampleRateHz?: number | null
  channels?: number | null
  sizeBytes?: number | null
}

export interface CollaboratorInput {
  legalName: string
  role?: CollaboratorRole // defaults to 'songwriter'
  ownershipPercent: number // 0-100, max 2 decimals; all entries must total 100
  invitedEmail?: string | null
}

// ── Kept from the old file: no endpoints for these in the backend files shared so far ──
export interface Credit { id?: string; userId?: string | null; email?: string | null; personName: string; role: string }
export interface DisputeSplit { collaboratorId: string; legalName: string; role: string; currentPercent: number; beforePercent: number; proposedPercent: number }
export interface Dispute {
  id: string; status: 'open' | 'contested' | 'resolved'; reason: string; createdAt: string; resolvedAt: string | null
  raisedBy: string; raisedByName: string; trackId: string; trackTitle: string; releaseId: string; releaseTitle: string
  splits: DisputeSplit[]; approvals: { legalName: string; hasAccount: boolean; accepted: boolean }[]
  responses: { id: string; responderId: string; responderName: string; action: string; message: string | null; createdAt: string }[]
}

// ── Form state for the create/edit listing screens (editable strings, not API shapes) ──
export interface TrackForm {
  id?: string // set once the track exists on the server
  hadAudio?: boolean // true if the server already holds an audio spec for this track
  title: string
  compositionTitle: string
  artistName: string
  genre: string
  isrc: string
  iswc: string
  durationSeconds: number | null
  explicit: ExplicitValue | ''
  compositionCopyrightYear: number | null
  compositionCopyright: string
  recordingCopyrightYear: number | null
  recordingCopyright: string
  audio: AudioInput | null
  collaborators: CollaboratorInput[]
}

export interface ReleaseForm {
  releaseType: ReleaseType
  title: string
  albumArtist: string
  releaseDate: string
  upc: string
  tracks: TrackForm[]
}