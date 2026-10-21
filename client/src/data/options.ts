export const TRACK_ORIGINS = ['original', 'cover', 'arrangement', 'sample'] as const
export type TrackOrigin = (typeof TRACK_ORIGINS)[number]
export const ORIGIN_LABELS: Record<TrackOrigin, string> = {
  original: 'Original song', cover: 'Cover of someone else’s song',
  arrangement: 'New arrangement of an existing song', sample: 'Uses a sample',
}
export const ORIGIN_WARNING =
  'Covers, arrangements and samples usually need permission or a licence from the owners of the original work. Distributors often ask for proof. Get it before you release, and list the original writers in the splits.'

export const WRITER_STATUSES = ['joined', 'not_joined', 'has_administrator', 'authorized_artist', 'bought_out', 'unknown'] as const
export type WriterStatus = (typeof WRITER_STATUSES)[number]
export const WRITER_STATUS_LABELS: Record<WriterStatus, string> = {
  joined: 'Member of a rights society', not_joined: 'Not a member of a society',
  has_administrator: 'Has a publishing administrator', authorized_artist: 'Authorised artist',
  bought_out: 'Bought out (work for hire)', unknown: 'Not sure',
}

export const LANGUAGES: [string, string][] = [
  ['en', 'English'], ['fr', 'French'], ['rw', 'Kinyarwanda'], ['sw', 'Swahili'], ['lg', 'Luganda'],
  ['rn', 'Kirundi'], ['yo', 'Yoruba'], ['ig', 'Igbo'], ['ha', 'Hausa'], ['am', 'Amharic'],
  ['zu', 'Zulu'], ['xh', 'Xhosa'], ['so', 'Somali'], ['ar', 'Arabic'], ['pt', 'Portuguese'], ['ln', 'Lingala'],
]

export const COUNTRIES: [string, string][] = [
  ['RW', 'Rwanda'], ['KE', 'Kenya'], ['UG', 'Uganda'], ['TZ', 'Tanzania'], ['BI', 'Burundi'], ['CD', 'DR Congo'],
  ['NG', 'Nigeria'], ['GH', 'Ghana'], ['ZA', 'South Africa'], ['ET', 'Ethiopia'], ['SN', 'Senegal'],
  ['CI', "Côte d'Ivoire"], ['CM', 'Cameroon'], ['ZM', 'Zambia'], ['ZW', 'Zimbabwe'], ['EG', 'Egypt'],
  ['MA', 'Morocco'], ['SS', 'South Sudan'], ['SO', 'Somalia'], ['AO', 'Angola'], ['MZ', 'Mozambique'],
  ['GB', 'United Kingdom'], ['US', 'United States'], ['FR', 'France'], ['BE', 'Belgium'], ['CA', 'Canada'],
]
