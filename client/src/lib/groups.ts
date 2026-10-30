import type { Release } from '../types'

// The four Discography groups. A release lands in the first one that matches.
export type Group = 'released' | 'awaiting' | 'draft' | 'yet'

export function groupOf(r: Release): Group {
  if (r.released_at) return 'released'
  if (r.status === 'draft') return (r.pending_notices ?? 0) > 0 ? 'awaiting' : 'draft'
  return 'yet'
}

