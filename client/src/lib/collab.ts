import type { Collaborator, CollaboratorInput } from '../types'

// A stored credit, in the shape the splits editor works with and the save endpoint accepts.
export const toCollaboratorInput = (c: Collaborator): CollaboratorInput => ({
  legalName: c.legal_name, role: c.role, ownershipPercent: Number(c.ownership_percent),
  invitedEmail: c.invited_email,
  ipi: c.ipi ?? '', writerStatus: c.writer_status ?? null,
  publisherName: c.publisher_name ?? '', isSelfPublished: !!c.is_self_published, isFeatured: !!c.is_featured,
  ...(c.removed_by_writer ? { id: c.id, removedByWriter: true } : {}),
})

// Percentages in whole cents, so 33.33 + 33.33 + 33.34 adds up to exactly 100.
export const sumPercent = (list: CollaboratorInput[]) =>
  list.filter((c) => !c.discard && !c.removedByWriter).reduce((s, c) => s + Math.round((Number(c.ownershipPercent) || 0) * 100), 0) / 100

export const featuredNames = (list: Collaborator[]) => list.filter((c) => c.is_featured && !c.removed_by_writer).map((c) => c.legal_name)
export const featTitle = (title: string, names: string[]) => (names.length ? `${title} (feat. ${names.join(', ')})` : title)
export const featuredCredit = (name: string): CollaboratorInput => ({ legalName: name, role: 'performer', ownershipPercent: 0, isFeatured: true })
