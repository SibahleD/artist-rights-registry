export const RELEASE_TYPES = ['single', 'ep', 'album'] as const
import type { TrackOrigin, WriterStatus } from './data/options'

export const COLLABORATOR_ROLES = ['composer', 'songwriter', 'lyricist', 'arranger', 'publisher', 'producer', 'performer', 'other'] as const
export const EXPLICIT_VALUES = ['explicit', 'not_explicit', 'cleaned'] as const
export const AUDIO_FORMATS = ['mp3', 'flac', 'wav', 'aac', 'other'] as const

export type ReleaseType = (typeof RELEASE_TYPES)[number]
export type ReleaseStatus = 'draft' | 'ready'
export type CollaboratorRole = (typeof COLLABORATOR_ROLES)[number]
export type ExplicitValue = (typeof EXPLICIT_VALUES)[number]
export type AudioFormat = (typeof AUDIO_FORMATS)[number]

export interface User {
  id: string
  email: string
  artist_name: string
  contact_info: string | null
  first_name?: string | null
  last_name?: string | null
  username?: string | null
  country?: string | null
  nationality?: string | null
  roles?: CollaboratorRole[]
  society_name?: string | null
  ipi?: string | null
  publisher_name?: string | null
  created_at: string
  email_verified_at?: string | null
  avatar_id?: string | null
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
  label_name?: string | null
  language?: string | null
  status: ReleaseStatus
  created_at: string
  ready_at: string | null
  released_at?: string | null          // set once the release is live on the stores
  unconfirmed_acknowledged_at?: string | null
  artwork_id?: string | null
  track_count?: number
  pending_notices?: number              // co-writer notices still pending or disputed (list endpoint only)
}

export interface ReleaseLink { store: string; url: string }

export interface ReadinessCheck {
  id: string
  level: 'error' | 'warn' | 'info'
  message: string
  fix: string            // client route to fix it, e.g. /releases/:id/edit?track=2
  track?: number
  needsAck?: boolean
  acknowledged?: boolean
}

export interface ReadinessReport { status: ReleaseStatus; canMarkReady: boolean; checks: ReadinessCheck[] }

// GET /releases/:id/export. Whitelisted metadata only: no internal ids, no co-writer emails.
export interface ReleaseExport {
  export_version: number
  exported_at: string
  release: Record<string, unknown>
  tracks: Array<Record<string, unknown> & { track_number: number }>
}

export interface AudioSpec {
  file_name: string
  format: AudioFormat
  bitrate_kbps: number | null
  sample_rate_hz: number | null
  channels: number | null
  size_bytes: number | null
  recorded_at?: string
  has_file?: boolean
}

export interface Track {
  id: string
  release_id?: string
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
  origin?: TrackOrigin
  version_title?: string | null
  language?: string | null
  created_at?: string
  audio?: AudioSpec | null
}

export interface Collaborator {
  id: string
  track_id: string
  user_id: string | null
  invited_email: string | null
  legal_name: string
  role: CollaboratorRole
  ownership_percent: number | string
  removed_by_writer?: boolean
  ipi?: string | null
  writer_status?: WriterStatus | null
  publisher_name?: string | null
  is_self_published?: boolean
  created_at: string
}

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

export interface SharedTrackDetail {
  track: Omit<SharedTrack, 'role' | 'ownership_percent'> & {
    composition_title: string | null
    artist_name: string | null
    duration_seconds: number | null
    explicit: ExplicitValue | null
  }
  splits: { legal_name: string; role: CollaboratorRole; ownership_percent: number | string; is_you: boolean }[]
}

export interface ReleaseInput {
  title?: string
  releaseType?: ReleaseType
  albumArtist?: string
  genre?: string | null
  releaseDate?: string | null
  upc?: string | null
  pLine?: string | null
  cLine?: string | null
  labelName?: string | null
  language?: string | null
}

export interface TrackInput {
  title?: string
  compositionTitle?: string | null
  artistName?: string | null
  genre?: string | null
  isrc?: string | null
  iswc?: string | null
  explicit?: ExplicitValue | null
  compositionCopyrightYear?: number | null
  compositionCopyright?: string | null
  recordingCopyrightYear?: number | null
  recordingCopyright?: string | null
  origin?: TrackOrigin
  versionTitle?: string | null
  language?: string | null
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
  role?: CollaboratorRole
  ownershipPercent: number
  invitedEmail?: string | null
  id?: string
  removedByWriter?: boolean
  discard?: boolean
  ipi?: string | null
  writerStatus?: WriterStatus | null
  publisherName?: string | null
  isSelfPublished?: boolean
}

export type NoticeStatus = 'pending' | 'confirmed' | 'disputed' | 'removed' | 'expired' | 'cancelled'
export interface Notice {
  id: string
  track_id: string
  co_writer_name: string | null
  email: string | null
  role: CollaboratorRole
  share_percent: number | string
  status: NoticeStatus
  note: string | null
  sent_at: string
  reminder_sent_at: string | null
  expires_at: string
  responded_at: string | null
  resolution: 'kept' | 'adopted' | null
  resolution_note: string | null
  resolved_at: string | null
}

export interface PublicNotice {
  status: NoticeStatus
  artist_name?: string
  track_title?: string
  release_title?: string
  role?: CollaboratorRole
  share_percent?: number | string
  co_writer_name?: string
}

export interface Credit { id?: string; userId?: string | null; email?: string | null; personName: string; role: string }
export interface DisputeSplit { collaboratorId: string; legalName: string; role: string; currentPercent: number; beforePercent: number; proposedPercent: number }
export interface Dispute {
  id: string; status: 'open' | 'contested' | 'resolved'; reason: string; createdAt: string; resolvedAt: string | null
  raisedBy: string; raisedByName: string; trackId: string; trackTitle: string; releaseId: string; releaseTitle: string
  splits: DisputeSplit[]; approvals: { legalName: string; hasAccount: boolean; accepted: boolean }[]
  responses: { id: string; responderId: string; responderName: string; action: string; message: string | null; createdAt: string }[]
}

export interface Usage {
  enabled: boolean
  releases: { used: number; max: number | null }
  bytes: { audio: number; images: number; used: number; max: number | null }
  limits: { maxTracksPerRelease: number | null; maxAudioBytes: number; maxCoverBytes: number; maxAvatarBytes: number }
}

export interface TrackForm {
  id?: string 
  hadAudio?: boolean
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
  origin: TrackOrigin
  versionTitle: string
  language: string
  audio: AudioInput | null 
  audioHasFile?: boolean 
  audioFile?: File
  collaborators: CollaboratorInput[]
}

export interface ReleaseForm {
  releaseType: ReleaseType
  title: string
  albumArtist: string
  releaseDate: string
  upc: string
  labelName: string
  language: string
  tracks: TrackForm[]
}