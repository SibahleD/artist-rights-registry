export interface User { id: string; email: string; artistName: string; legalName?: string | null; contactInfo?: string | null }
export interface Collaborator { id?: string; userId?: string | null; email?: string | null; legalName: string; role: string; ownershipPercent: number }
export interface Credit { id?: string; userId?: string | null; email?: string | null; personName: string; role: string }
export interface Track {
  id?: string; releaseId?: string; trackNumber?: number; title: string; compositionTitle?: string | null
  isrc?: string | null; iswc?: string | null; genre?: string | null; durationSecs?: number | null
  compositionCopyright?: string | null; recordingCopyright?: string | null
  collaborators: Collaborator[]; credits: Credit[]
}
export interface Release {
  id: string; ownerId: string; kind: 'single' | 'ep' | 'album'; title: string; mainArtistName: string
  releaseDate: string | null; upc?: string | null; status: 'draft' | 'registered'
  registeredAt: string; savedAt: string | null; tracks: Track[]
}
export interface Discography { direct: Release[]; collaborations: Release[]; drafts: Release[] }
export interface DisputeSplit { collaboratorId: string; legalName: string; role: string; currentPercent: number; beforePercent: number; proposedPercent: number }
export interface Dispute {
  id: string; status: 'open' | 'contested' | 'resolved'; reason: string; createdAt: string; resolvedAt: string | null
  raisedBy: string; raisedByName: string; trackId: string; trackTitle: string; releaseId: string; releaseTitle: string
  splits: DisputeSplit[]; approvals: { legalName: string; hasAccount: boolean; accepted: boolean }[]
  responses: { id: string; responderId: string; responderName: string; action: string; message: string | null; createdAt: string }[]
}