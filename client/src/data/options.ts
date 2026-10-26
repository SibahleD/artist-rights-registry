// Dropdown options for the step 4 fields. Values match what the server accepts.

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
  ['af', 'Afrikaans'],
  ['sq', 'Albanian'],
  ['am', 'Amharic'],
  ['ar', 'Arabic'],
  ['hy', 'Armenian'],
  ['az', 'Azerbaijani'],
  ['eu', 'Basque'],
  ['be', 'Belarusian'],
  ['bn', 'Bengali'],
  ['bs', 'Bosnian'],
  ['bg', 'Bulgarian'],
  ['my', 'Burmese'],
  ['ca', 'Catalan'],
  ['zh', 'Chinese'],
  ['hr', 'Croatian'],
  ['cs', 'Czech'],
  ['da', 'Danish'],
  ['nl', 'Dutch'],
  ['en', 'English'],
  ['et', 'Estonian'],
  ['fil', 'Filipino'],
  ['fi', 'Finnish'],
  ['fr', 'French'],
  ['gl', 'Galician'],
  ['ka', 'Georgian'],
  ['de', 'German'],
  ['el', 'Greek'],
  ['gu', 'Gujarati'],
  ['ha', 'Hausa'],
  ['he', 'Hebrew'],
  ['hi', 'Hindi'],
  ['hu', 'Hungarian'],
  ['is', 'Icelandic'],
  ['ig', 'Igbo'],
  ['id', 'Indonesian'],
  ['ga', 'Irish'],
  ['it', 'Italian'],
  ['ja', 'Japanese'],
  ['kn', 'Kannada'],
  ['kk', 'Kazakh'],
  ['km', 'Khmer'],
  ['rw', 'Kinyarwanda'],
  ['rn', 'Kirundi'],
  ['ko', 'Korean'],
  ['lo', 'Lao'],
  ['lv', 'Latvian'],
  ['lg', 'Luganda'],
  ['ln', 'Lingala'],
  ['lt', 'Lithuanian'],
  ['mk', 'Macedonian'],
  ['mg', 'Malagasy'],
  ['ms', 'Malay'],
  ['ml', 'Malayalam'],
  ['mt', 'Maltese'],
  ['mr', 'Marathi'],
  ['mn', 'Mongolian'],
  ['ne', 'Nepali'],
  ['no', 'Norwegian'],
  ['om', 'Oromo'],
  ['ps', 'Pashto'],
  ['fa', 'Persian'],
  ['pl', 'Polish'],
  ['pt', 'Portuguese'],
  ['pa', 'Punjabi'],
  ['ro', 'Romanian'],
  ['ru', 'Russian'],
  ['sr', 'Serbian'],
  ['sn', 'Shona'],
  ['sd', 'Sindhi'],
  ['si', 'Sinhala'],
  ['sk', 'Slovak'],
  ['sl', 'Slovenian'],
  ['so', 'Somali'],
  ['es', 'Spanish'],
  ['sw', 'Swahili'],
  ['sv', 'Swedish'],
  ['ta', 'Tamil'],
  ['te', 'Telugu'],
  ['th', 'Thai'],
  ['ti', 'Tigrinya'],
  ['tr', 'Turkish'],
  ['uk', 'Ukrainian'],
  ['ur', 'Urdu'],
  ['uz', 'Uzbek'],
  ['vi', 'Vietnamese'],
  ['cy', 'Welsh'],
  ['wo', 'Wolof'],
  ['xh', 'Xhosa'],
  ['yo', 'Yoruba'],
  ['zu', 'Zulu'],
]

// Full language name for a stored code ("rw" -> "Kinyarwanda"). Unknown codes are shown as they are.
const LANGUAGE_BY_CODE = new Map(LANGUAGES)
export const languageName = (code?: string | null): string => (code ? LANGUAGE_BY_CODE.get(code.toLowerCase()) ?? code : '')

export const COUNTRIES: [string, string][] = [
  ['RW', 'Rwanda'], ['KE', 'Kenya'], ['UG', 'Uganda'], ['TZ', 'Tanzania'], ['BI', 'Burundi'], ['CD', 'DR Congo'],
  ['NG', 'Nigeria'], ['GH', 'Ghana'], ['ZA', 'South Africa'], ['ET', 'Ethiopia'], ['SN', 'Senegal'],
  ['CI', "Côte d'Ivoire"], ['CM', 'Cameroon'], ['ZM', 'Zambia'], ['ZW', 'Zimbabwe'], ['EG', 'Egypt'],
  ['MA', 'Morocco'], ['SS', 'South Sudan'], ['SO', 'Somalia'], ['AO', 'Angola'], ['MZ', 'Mozambique'],
  ['GB', 'United Kingdom'], ['US', 'United States'], ['FR', 'France'], ['BE', 'Belgium'], ['CA', 'Canada'],
]

export const GENRES: string[] = [
  'Afrobeats', 'Afropop', 'Afro-fusion', 'Amapiano', 'Bongo Flava', 'Benga', 'Coupé-décalé', 'Gospel / Worship',
  'Highlife', 'Hip-hop / Rap', 'Gengetone', 'Kinyarwanda Contemporary', 'Reggae / Dancehall', 'R&B / Soul',
  'Rumba / Soukous', 'Traditional / Folk', 'Pop', 'Rock', 'Electronic / Dance', 'Jazz', 'Classical', 'Country', 'Latin',
]

// Demonyms for the Nationality field (nationality is "Rwandan", not "Rwanda").
export const NATIONALITIES: string[] = [
  'Angolan', 'Belgian', 'British', 'Burundian', 'Cameroonian', 'Canadian', 'Congolese (DRC)', 'Egyptian', 'Ethiopian',
  'French', 'Ghanaian', 'Ivorian', 'Kenyan', 'Moroccan', 'Mozambican', 'Nigerian', 'Rwandan', 'Senegalese', 'Somali',
  'South African', 'South Sudanese', 'Tanzanian', 'Ugandan', 'American', 'Zambian', 'Zimbabwean',
]
