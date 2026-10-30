// Credit titles offered in the app (Producer, Mixing Engineer, Vocals...), in display order. Producer is the default.
// The release-level and per-song credit lists both use this list. server/src/lib/distribution.js holds the same list and
// server/tests/distribution.test.js fails if the two differ.

export const DEFAULT_CONTRIBUTOR_TITLE = 'Producer'

export const CREDIT_TITLES = [
  'Producer', 'DJ', 'Remixer', 'Conductor', 'Arranger', 'Adapter',
  'Recording Engineer', 'Mixing Engineer', 'Mastering Engineer', 'Assistant Engineer',
  'Co-Producer', 'Graphic Design',
] as const

export const INSTRUMENT_TITLES = [
  'Accordion', 'Background Vocals', 'Banjo', 'Bass Guitar', 'Bassoon', 'Bells', 'Cello', 'Clarinet',
  'Drums', 'Ensemble', 'Fiddle', 'Flute', 'Guitar', 'Harmonica', 'Harp', 'Horn', 'Keyboards', 'Lute',
  'Metallophone', 'Mixed Artist', 'Oboe', 'Organ', 'Percussion', 'Piano', 'Programming', 'Rap', 'Recorder',
  'Sampled Artist', 'Saxophone', 'Synthesizer', 'Tambourine', 'Trombone', 'Trumpet', 'Viola', 'Viola de Gamba',
  'Violin', 'Vocals', 'Whistle', 'Xylophone',
] as const

export const CONTRIBUTOR_TITLES: readonly string[] = [...CREDIT_TITLES, ...INSTRUMENT_TITLES]
