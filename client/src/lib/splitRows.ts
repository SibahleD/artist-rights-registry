import type { Collaborator, Notice, Track } from '../types'

export type SendResult = { trackId: string; name: string; email: string; action: string }

export const SEND_TEXT: Record<string, string> = {
  sent: 'invitation sent',
  updated: 'details changed, updated invitation sent',
  resent: 'invitation sent again',
  unchanged: 'already invited, nothing to send',
  blocked: 'removed themselves and cannot be invited again',
  limit: 'daily invitation limit reached, try again tomorrow',
  skipped_self: 'that is your own email, skipped',
}

// One line on the Splits page: a sent notice, or someone with an email who has not been invited yet.
export interface Row {
  key: string; trackId: string; noticeId?: string; name: string; email: string | null; role: string; share: number
  status: string; note: string | null; expiresAt?: string; canRemind: boolean
}

// Notices plus the people with an email but no notice yet (the owner's own email never gets one).
export function buildRows(notices: Notice[], people: Collaborator[], tracks: Track[], ownerEmail?: string): Row[] {
  const title = (tid: string) => tracks.find((t) => t.id === tid)?.title ?? 'Song'
  return [
    ...notices.map((n): Row => ({
      key: n.id, trackId: n.track_id, noticeId: n.id,
      name: n.co_writer_name ?? (n.status === 'removed' ? 'Removed by writer' : 'Email removed'),
      email: n.email, role: n.role, share: Number(n.share_percent), status: n.status, note: n.note,
      expiresAt: n.expires_at,
      canRemind: n.status === 'pending' && !n.reminder_sent_at && !!n.email && new Date(n.expires_at) > new Date(),
    })),
    ...people.filter((c) => c.invited_email && !c.removed_by_writer && c.invited_email !== ownerEmail
      && !notices.some((n) => n.track_id === c.track_id && n.email?.toLowerCase() === c.invited_email!.toLowerCase()))
      .map((c): Row => ({
        key: c.id, trackId: c.track_id, name: c.legal_name, email: c.invited_email, role: c.role,
        share: Number(c.ownership_percent), status: 'not_sent', note: null, canRemind: false,
      })),
  ].sort((a, b) => title(a.trackId).localeCompare(title(b.trackId)))
}

// Statuses that still need the co-writer (or the artist) to do something.
const AWAITING = ['not_sent', 'pending', 'disputed', 'expired']

export function summarize(rows: Row[], removedLines: number) {
  return {
    confirmed: rows.filter((r) => r.status === 'confirmed').length,
    awaiting: rows.filter((r) => AWAITING.includes(r.status)).length,
    disputed: rows.filter((r) => r.status === 'disputed').length,
    removed: removedLines,
  }
}
