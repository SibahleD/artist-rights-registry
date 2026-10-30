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
  ['ach', 'Acholi'],
  ['af', 'Afrikaans'],
  ['ak', 'Akan / Twi'],
  ['am', 'Amharic'],
  ['ar', 'Arabic'],
  ['bm', 'Bambara'],
  ['bem', 'Bemba'],
  ['ber', 'Berber / Tamazight'],
  ['kea', 'Cape Verdean Creole'],
  ['ny', 'Chewa / Nyanja'],
  ['din', 'Dinka'],
  ['en', 'English'],
  ['ee', 'Ewe'],
  ['fan', 'Fang'],
  ['fon', 'Fon'],
  ['fr', 'French'],
  ['ff', 'Fula / Fulfulde'],
  ['gaa', 'Ga'],
  ['ha', 'Hausa'],
  ['ig', 'Igbo'],
  ['kln', 'Kalenjin'],
  ['kam', 'Kamba'],
  ['kg', 'Kikongo'],
  ['ki', 'Kikuyu'],
  ['mer', 'Kimeru'],
  ['rw', 'Kinyarwanda'],
  ['rn', 'Kirundi'],
  ['kri', 'Krio'],
  ['ln', 'Lingala'],
  ['loz', 'Lozi'],
  ['lg', 'Luganda'],
  ['luy', 'Luhya'],
  ['luo', 'Luo / Dholuo'],
  ['xog', 'Lusoga'],
  ['mas', 'Maasai'],
  ['mg', 'Malagasy'],
  ['mfe', 'Mauritian Creole'],
  ['mos', 'Mooré'],
  ['nd', 'Ndebele (North)'],
  ['nr', 'Ndebele (South)'],
  ['pcm', 'Nigerian Pidgin'],
  ['nus', 'Nuer'],
  ['om', 'Oromo'],
  ['pt', 'Portuguese'],
  ['nyn', 'Runyankole'],
  ['sg', 'Sango'],
  ['crs', 'Seychellois Creole'],
  ['sn', 'Shona'],
  ['so', 'Somali'],
  ['st', 'Sotho (Southern)'],
  ['es', 'Spanish'],
  ['sw', 'Swahili'],
  ['ss', 'Swati'],
  ['ti', 'Tigrinya'],
  ['lua', 'Tshiluba'],
  ['ts', 'Tsonga'],
  ['tn', 'Tswana'],
  ['tum', 'Tumbuka'],
  ['ve', 'Venda'],
  ['wo', 'Wolof'],
  ['xh', 'Xhosa'],
  ['yo', 'Yoruba'],
  ['zu', 'Zulu'],
]

// African languages, plus the official languages used across the continent (English, French, Portuguese, Arabic, Spanish).
// Codes are ISO 639-1 where one exists and ISO 639-3 otherwise. Keep extension/languages.js in sync.
// Full language name for a stored code ("rw" -> "Kinyarwanda"). Unknown codes are shown as they are.
const LANGUAGE_BY_CODE = new Map(LANGUAGES)
export const languageName = (code?: string | null): string => (code ? LANGUAGE_BY_CODE.get(code.toLowerCase()) ?? code : '')

export const COUNTRIES: [string, string][] = [
  ['DZ', 'Algeria'], ['AO', 'Angola'], ['BJ', 'Benin'], ['BW', 'Botswana'],
  ['BF', 'Burkina Faso'], ['BI', 'Burundi'], ['CV', 'Cabo Verde'], ['CM', 'Cameroon'],
  ['CF', 'Central African Republic'], ['TD', 'Chad'], ['KM', 'Comoros'], ['CG', 'Congo (Republic)'],
  ['CD', 'DR Congo'], ['CI', 'Côte d\'Ivoire'], ['DJ', 'Djibouti'], ['EG', 'Egypt'],
  ['GQ', 'Equatorial Guinea'], ['ER', 'Eritrea'], ['SZ', 'Eswatini'], ['ET', 'Ethiopia'],
  ['GA', 'Gabon'], ['GM', 'Gambia'], ['GH', 'Ghana'], ['GN', 'Guinea'],
  ['GW', 'Guinea-Bissau'], ['KE', 'Kenya'], ['LS', 'Lesotho'], ['LR', 'Liberia'],
  ['LY', 'Libya'], ['MG', 'Madagascar'], ['MW', 'Malawi'], ['ML', 'Mali'],
  ['MR', 'Mauritania'], ['MU', 'Mauritius'], ['MA', 'Morocco'], ['MZ', 'Mozambique'],
  ['NA', 'Namibia'], ['NE', 'Niger'], ['NG', 'Nigeria'], ['RW', 'Rwanda'],
  ['ST', 'São Tomé and Príncipe'], ['SN', 'Senegal'], ['SC', 'Seychelles'], ['SL', 'Sierra Leone'],
  ['SO', 'Somalia'], ['ZA', 'South Africa'], ['SS', 'South Sudan'], ['SD', 'Sudan'],
  ['TZ', 'Tanzania'], ['TG', 'Togo'], ['TN', 'Tunisia'], ['UG', 'Uganda'],
  ['ZM', 'Zambia'], ['ZW', 'Zimbabwe'],
]

export const GENRES: string[] = [
  'Afrobeats', 'Afropop', 'Afro-fusion', 'Amapiano', 'Bongo Flava', 'Benga', 'Coupé-décalé', 'Gospel / Worship',
  'Highlife', 'Hip-hop / Rap', 'Gengetone', 'Kinyarwanda Contemporary', 'Reggae / Dancehall', 'R&B / Soul',
  'Rumba / Soukous', 'Traditional / Folk', 'Pop', 'Rock', 'Electronic / Dance', 'Jazz', 'Classical', 'Country', 'Latin',
]

// Demonyms for the Nationality field (nationality is "Rwandan", not "Rwanda").
export const NATIONALITIES: string[] = [
  'Algerian', 'Angolan', 'Beninese', 'Motswana', 'Burkinabè',
  'Burundian', 'Cape Verdean', 'Cameroonian', 'Central African', 'Chadian',
  'Comorian', 'Congolese (Republic of the Congo)', 'Congolese (DRC)', 'Ivorian', 'Djiboutian',
  'Egyptian', 'Equatorial Guinean', 'Eritrean', 'Swazi', 'Ethiopian',
  'Gabonese', 'Gambian', 'Ghanaian', 'Guinean', 'Bissau-Guinean',
  'Kenyan', 'Mosotho', 'Liberian', 'Libyan', 'Malagasy',
  'Malawian', 'Malian', 'Mauritanian', 'Mauritian', 'Moroccan',
  'Mozambican', 'Namibian', 'Nigerien', 'Nigerian', 'Rwandan',
  'São Toméan', 'Senegalese', 'Seychellois', 'Sierra Leonean', 'Somali',
  'South African', 'South Sudanese', 'Sudanese', 'Tanzanian', 'Togolese',
  'Tunisian', 'Ugandan', 'Zambian', 'Zimbabwean',
]
