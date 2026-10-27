// Contributor titles offered by RouteNote's Producer / contributor drop-down, in the order it shows them.
// Producer is the default. The album-level and per-track dropdowns both use this list.
// Keep extension/ in step when the extension starts filling this field (Phase 5).

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
export const isContributorTitle = (t: string) => CONTRIBUTOR_TITLES.includes(t)
