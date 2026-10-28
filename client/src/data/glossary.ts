export type GlossaryCategory = 'Identifiers' | 'Rights & ownership' | 'Royalties' | 'People & roles' | 'Distribution'

export interface GlossaryEntry {
  id: string
  term: string
  category: GlossaryCategory
  short: string
  details: string
  example?: string
  why?: string
  related?: string[]
}

export const CATEGORIES: GlossaryCategory[] = ['Identifiers', 'Rights & ownership', 'Royalties', 'People & roles', 'Distribution']

export const GLOSSARY: GlossaryEntry[] = [
  // ---- Identifiers ----
  {
    id: 'metadata', term: 'Metadata', category: 'Identifiers',
    short: 'The information that describes a song or release: titles, names, codes, dates, owners and splits.',
    details: 'Streaming services, distributors and royalty collectors all work from metadata, not from the audio. If the metadata is missing or wrong, the music can still play but the money and credit may go to the wrong place, or nowhere.',
    why: 'Most royalty problems that independent artists run into are metadata problems, such as a misspelt name or a missing code.',
    related: ['isrc', 'iswc', 'upc', 'ownership-split'],
  },
  {
    id: 'isrc', term: 'ISRC', category: 'Identifiers',
    short: 'A 12-character code that identifies one specific sound recording.',
    details: 'ISRC stands for International Standard Recording Code. It is made of a country code, a registrant code, the year and a five-digit number. It follows the recording, not the release: the same recording keeps its ISRC when it appears on a single and later on an album. A new recording (a remix, a re-recorded version) needs a new ISRC. Distributors can usually issue one for you.',
    example: 'RW-ABC-26-00001 (often written without the dashes: RWABC2600001).',
    why: 'Streaming services use the ISRC to count plays and match them to the right recording, so it decides where recording royalties are paid.',
    related: ['sound-recording', 'iswc', 'distributor'],
  },
  {
    id: 'iswc', term: 'ISWC', category: 'Identifiers',
    short: 'A code that identifies the composition (the song as written), not any particular recording of it.',
    details: 'ISWC stands for International Standard Musical Work Code. It looks like T-123.456.789-0. It is usually issued when the work is registered with a collecting society, so many new songs do not have one yet. One composition has one ISWC no matter how many recordings or versions exist.',
    why: 'It links all the recordings of a song back to its writers so composition royalties reach them.',
    related: ['composition', 'cmo', 'isrc'],
  },
  {
    id: 'upc', term: 'UPC / EAN', category: 'Identifiers',
    short: 'A barcode number that identifies a release (a single, EP or album) as a product.',
    details: 'A UPC has 12 digits and an EAN has 13. They identify the release as a whole, while ISRCs identify the individual songs inside it. Distributors normally generate one for you, so you only need to enter your own if the release already has one.',
    related: ['isrc', 'release-types'],
  },
  {
    id: 'ipi', term: 'IPI number', category: 'Identifiers',
    short: 'An ID that collecting societies give to songwriters and publishers.',
    details: 'IPI stands for Interested Parties Information. It identifies a person or company in the databases that societies share. You normally receive one when you join a society as a songwriter or publisher.',
    why: 'It helps societies match your name to your works, especially if other writers have similar names.',
    related: ['cmo', 'legal-name'],
  },

  // ---- Rights & ownership ----
  {
    id: 'composition', term: 'Composition (musical work)', category: 'Rights & ownership',
    short: 'The song itself: the melody, chords and lyrics, separate from any recording of it.',
    details: 'A composition is owned by the people who wrote it, and often by their publisher. The same composition can be recorded many times by different artists, and each recording is a separate sound recording.',
    related: ['sound-recording', 'songwriter', 'composer', 'ownership-split'],
  },
  {
    id: 'sound-recording', term: 'Sound recording (master)', category: 'Rights & ownership',
    short: 'A specific recorded performance of a song. This is what listeners hear.',
    details: 'The recording is usually owned by the artist, a producer or a label, depending on who paid for it and what was agreed in writing. It has its own copyright and its own ISRC, separate from the composition.',
    related: ['composition', 'isrc', 'p-line'],
  },
  {
    id: 'ownership-split', term: 'Ownership split', category: 'Rights & ownership',
    short: 'The percentage of a song that each person owns. The shares add up to 100%.',
    details: 'Splits describe who gets what share of the money a song earns. Composition splits (between writers and publishers) and recording splits (between the people who own the master) are separate, and each set should total 100%. Agree splits with your co-writers before release, and put them in writing.',
    example: 'Two writers who wrote a song together equally: 50% and 50%.',
    why: 'Splits are hard to change after royalties start being paid, and disputes can hold up payments for everyone.',
    related: ['split-sheet', 'co-writer', 'composition'],
  },
  {
    id: 'split-sheet', term: 'Split sheet', category: 'Rights & ownership',
    short: 'A signed agreement that records who wrote a song and what share each person owns.',
    details: 'It is best completed right after the song is written, while everyone remembers who contributed what. It usually lists legal names, roles, percentages and signatures, and is the document you point to if there is a disagreement later.',
    related: ['ownership-split', 'co-writer', 'legal-name'],
  },
  {
    id: 'p-line', term: 'P-line (℗)', category: 'Rights & ownership',
    short: 'The copyright notice for the sound recording, written as ℗ year and owner.',
    details: 'The ℗ symbol marks the phonographic (recording) copyright. It names the year the recording was first made available and who owns it.',
    example: '℗ 2026 Your Legal Name',
    related: ['c-line', 'sound-recording'],
  },
  {
    id: 'c-line', term: 'C-line (©)', category: 'Rights & ownership',
    short: 'The copyright notice for the composition or artwork, written as © year and owner.',
    details: 'The © symbol marks the copyright in the written work and, on many release forms, the artwork. It names the year and the owner. Check how your distributor wants this line filled in.',
    example: '© 2026 Your Legal Name',
    related: ['p-line', 'composition'],
  },
  {
    id: 'publisher', term: 'Publisher', category: 'Rights & ownership',
    short: 'A company that manages a songwriter’s compositions and collects composition royalties for them.',
    details: 'A publisher may own part of the composition in return for registering the work, collecting royalties and finding opportunities for it. Many independent artists have no publisher and collect their own writer and publisher share through a society.',
    related: ['composition', 'cmo', 'mechanical-royalties'],
  },
  {
    id: 'sample-clearance', term: 'Sample clearance', category: 'Rights & ownership',
    short: 'Permission to use part of someone else’s recording or composition in your song.',
    details: 'A sample can involve two permissions: one from the owner of the recording and one from the owner of the composition. The original owners may also be added to your splits. Do this before release.',
    why: 'Uncleared samples are a common reason for takedowns and withheld royalties.',
    related: ['composition', 'sound-recording', 'ownership-split'],
  },
  {
    id: 'cover-license', term: 'Cover and mechanical licence', category: 'Rights & ownership',
    short: 'Permission to record and release your own version of someone else’s song.',
    details: 'A cover is a new recording of an existing composition. The writers still own the composition and must be credited and paid, usually through a mechanical licence. Distributors often have a process for this. Your recording gets its own ISRC, but the composition keeps its original writers and ISWC.',
    related: ['composition', 'mechanical-royalties', 'isrc'],
  },

  // ---- Royalties ----
  {
    id: 'performance-royalties', term: 'Performance royalties', category: 'Royalties',
    short: 'Money paid when a composition is played in public, broadcast or streamed.',
    details: 'They are paid to the songwriters and publishers of the composition, and are normally collected by collecting societies from radio, TV, venues and streaming services.',
    related: ['cmo', 'composition', 'mechanical-royalties'],
  },
  {
    id: 'mechanical-royalties', term: 'Mechanical royalties', category: 'Royalties',
    short: 'Money paid to the writers and publishers when a song is reproduced, for example when it is downloaded or streamed.',
    details: 'They are separate from performance royalties, and are collected by different organisations in some countries. They are one reason your composition splits must be accurate.',
    related: ['performance-royalties', 'cmo', 'publisher'],
  },
  {
    id: 'master-royalties', term: 'Recording (master) royalties', category: 'Royalties',
    short: 'Money from streams and downloads of the recording, paid to the owners of the sound recording.',
    details: 'For independent artists this normally arrives through the distributor, and is split according to the recording ownership you set up.',
    related: ['sound-recording', 'distributor', 'isrc'],
  },
  {
    id: 'neighbouring-rights', term: 'Neighbouring rights', category: 'Royalties',
    short: 'Royalties for performers and recording owners when a recording is broadcast or played in public.',
    details: 'They are paid to the people who performed on and own the recording, as opposed to the writers of the song. How they are collected differs by country, and in some places through a separate society.',
    related: ['performance-royalties', 'cmo', 'sound-recording'],
  },
  {
    id: 'cmo', term: 'Collecting society (PRO / CMO)', category: 'Royalties',
    short: 'An organisation that collects royalties on behalf of its members and pays them out.',
    details: 'PRO means performing rights organisation and CMO means collective management organisation. Songwriters and publishers register their works with the society that covers their territory, which then collects and distributes the royalties. What each society covers varies by country, so check which one applies to you.',
    related: ['performance-royalties', 'mechanical-royalties', 'ipi', 'iswc'],
  },
  {
    id: 'sync-licensing', term: 'Sync licensing', category: 'Royalties',
    short: 'Permission, usually for a fee, to use a song and its recording in a film, advert, game or video.',
    details: 'Sync means synchronising music with moving images. Because it uses both the composition and the recording, the deal is normally agreed with the owners of each, and the fee is whatever they negotiate. It is separate from the royalties that societies and distributors collect.',
    related: ['composition', 'sound-recording', 'publisher'],
  },
  {
    id: 'work-registration', term: 'Work registration', category: 'Royalties',
    short: 'Telling your collecting society about a new song, including its writers and splits.',
    details: 'Registering gives the song its identity in the society’s system, and often produces the ISWC. Registration is separate from distributing the song to streaming services, and one does not do the other.',
    why: 'An unregistered song can earn composition royalties that nobody can match to its writers.',
    related: ['cmo', 'iswc', 'ownership-split'],
  },

  // ---- People & roles ----
  {
    id: 'songwriter', term: 'Songwriter', category: 'People & roles',
    short: 'A person who wrote the words or contributed to the writing of a song.',
    details: 'Songwriters share in the composition and receive writer royalties through their society. Credit the person who wrote it, not the person who performed it, unless they are the same.',
    related: ['composer', 'co-writer', 'composition'],
  },
  {
    id: 'composer', term: 'Composer', category: 'People & roles',
    short: 'A person who wrote the music: the melody, chords or arrangement.',
    details: 'In practice many modern songs are written by people who do both, so the same person is often listed as both composer and songwriter. What matters is that everyone who helped write it is listed with the right share.',
    related: ['songwriter', 'composition'],
  },
  {
    id: 'producer', term: 'Producer', category: 'People & roles',
    short: 'The person who shaped and oversaw the recording.',
    details: 'A producer may be paid a fee, may own a share of the recording, or may also be credited as a writer if they contributed to the music. Agree this in writing early.',
    related: ['sound-recording', 'ownership-split'],
  },
  {
    id: 'performer', term: 'Performer', category: 'People & roles',
    short: 'A person who sang or played on the recording.',
    details: 'Performers can be entitled to neighbouring rights. Being a performer does not, by itself, make someone a writer of the song.',
    related: ['neighbouring-rights', 'songwriter'],
  },
  {
    id: 'co-writer', term: 'Co-writer', category: 'People & roles',
    short: 'Someone who wrote a song together with you.',
    details: 'Co-writers each own a share of the composition. Ask each one to confirm their details and share, and keep their legal names and contact email accurate.',
    related: ['ownership-split', 'split-sheet', 'songwriter'],
  },
  {
    id: 'legal-name', term: 'Legal name', category: 'People & roles',
    short: 'A person’s full official name, as opposed to a stage name.',
    details: 'Collecting societies and distributors pay and match people by legal name, so splits should use legal names. A stage name can be added as an alias in your artist profile.',
    why: 'A split under a stage name can be hard to match to a bank account or society member.',
    related: ['ipi', 'split-sheet'],
  },
  {
    id: 'main-artist', term: 'Main vs featured artist', category: 'People & roles',
    short: 'The main artist is the headline name for a release; featured artists are credited as guests on a song.',
    details: 'Streaming services display these differently, and putting featured artists in the wrong field can break artist pages and credits. Writers and producers are credited separately from this.',
    related: ['performer', 'distributor'],
  },

  // ---- Distribution ----
  {
    id: 'distributor', term: 'Distributor (aggregator)', category: 'Distribution',
    short: 'A service that delivers your music and metadata to streaming platforms and collects the money for you.',
    details: 'Independent artists usually use one to reach the major services. The distributor checks your metadata, assigns codes such as a UPC or ISRC if you lack them, and pays you recording royalties after taking its fee. It does not register your compositions with a collecting society.',
    related: ['dsp', 'ddex', 'master-royalties', 'work-registration'],
  },
  {
    id: 'dsp', term: 'DSP', category: 'Distribution',
    short: 'A digital service provider: a streaming or download platform such as Spotify or Apple Music.',
    details: 'DSPs receive your music and metadata from the distributor and report plays back so royalties can be calculated.',
    related: ['distributor'],
  },
  {
    id: 'ddex', term: 'DDEX', category: 'Distribution',
    short: 'The standard format distributors use to send metadata to streaming platforms.',
    details: 'The fields in a release form map to this format. If a required field is missing or wrongly formatted, the delivery can be rejected.',
    related: ['distributor', 'metadata'],
  },
  {
    id: 'release-types', term: 'Single, EP and album', category: 'Distribution',
    short: 'The release type groups songs: a single is one or a few songs, an EP is a short collection, an album is a full-length one.',
    details: 'Platforms set their own limits, and a common rule of thumb is single 1–3 tracks, EP 4–6 and album 7 or more. Check your distributor’s rules, because choosing the wrong type can cause the release to be reclassified.',
    related: ['upc'],
  },
  {
    id: 'explicit', term: 'Explicit content flag', category: 'Distribution',
    short: 'A label saying whether a song contains strong language or mature themes.',
    details: 'Platforms use it to filter content. The values are explicit, not explicit, or cleaned (an edited version of a song that is explicit in another form). Mark it honestly, as platforms may change it and can penalise missing flags.',
    related: ['dsp'],
  },
  {
    id: 'release-date', term: 'Release date', category: 'Distribution',
    short: 'The day the music goes live on streaming platforms.',
    details: 'Set it a few weeks ahead if you can, so the distributor has time to review the metadata and platforms can consider the release for playlists. An original release date is different if the song was released before.',
    related: ['distributor', 'dsp'],
  },
]

export const byId = (id: string) => GLOSSARY.find((g) => g.id === id)
