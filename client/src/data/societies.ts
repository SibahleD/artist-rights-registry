// Country guide for registering music rights with collecting societies (PRO / CMO) in East Africa.
// Compiled from public reporting and the bodies' own websites. This sector changes quickly (Rwanda and
// Kenya especially), so every entry carries the date it was last checked and its sources.
// Treat it as a starting point and confirm with the body itself before paying fees or signing anything.

export type BodyStatus = 'active' | 'suspended' | 'dissolved' | 'pending' | 'unclear'
export type CountryStatus = 'working' | 'in_flux' | 'none'

// How we know a cost. 'published' = the body's own pages or rules; 'reported' = press or a guide site, not confirmed
// by the body; 'not_published' = no source found. Never leave a cost blank: say it is not published.
export type FeeBasis = 'published' | 'reported' | 'not_published'
export const FEE_BASIS_LABEL: Record<FeeBasis, string> = {
  published: 'Published by the body', reported: 'Reported, not confirmed', not_published: 'Not published',
}
export interface Fees {
  basis: FeeBasis
  join?: string // what it costs to join or apply
  recurring?: string // yearly or other repeating fees
  deduction?: string // what the body keeps from royalties
  note?: string // caveats, such as the age of the source
  checked: string // YYYY-MM-DD
  source?: { label: string; url: string }
}

export interface Body {
  name: string
  abbr?: string
  status: BodyStatus
  does: string // what it covers, one line
  note?: string
  website?: string
  dashboard?: string // the members' login or dashboard page, only where it has been checked
  fees?: Fees
  payout?: string // how often and how royalties are paid out
  apply?: string // the public page to apply or register, where one exists
}

// Registering a copyright with the national office is separate from joining a society, and usually optional.
export interface CopyrightRegistration { name: string; fee: string; basis: FeeBasis; note: string; url?: string }

export interface CountryGuide {
  code: string
  name: string
  status: CountryStatus
  headline: string // the one thing to know
  bodies: Body[]
  steps: string[] // what an artist does, in order
  readyFor: string // who Step 4 is preparing for, e.g. 'UPRS'
  ready: string[] // what to have ready for that body, taken from what the body asks for
  readyGroups?: { title: string; items: string[] }[] // used instead of `ready` where one body asks for different things by applicant type
  registration?: CopyrightRegistration[]
  watchOut: string[]
  sources: { label: string; url: string }[]
  checked: string // YYYY-MM-DD
}

export const CHECKED = '2026-11-18'

export const STATUS_LABEL: Record<CountryStatus, string> = {
  working: 'A society is operating',
  in_flux: 'In transition: check before you act',
  none: 'No operating society found',
}

export const BODY_LABEL: Record<BodyStatus, string> = {
  active: 'Operating', suspended: 'Suspended', dissolved: 'Dissolved', pending: 'Being set up', unclear: 'Status unclear',
}

// Shown with every country. Fees are the most overlooked part of joining, and several bodies publish none.
export const ASK_BEFORE_PAYING = [
  'What does it cost to join, and is that a one-off or a yearly fee?',
  'What percentage of my royalties do you keep, and what is it spent on?',
  'When do you pay out, and in what currency and way (bank or mobile money)?',
  'Is tax withheld from my payments, and do I get a statement?',
]

export const COUNTRIES: CountryGuide[] = [
  {
    code: 'RW', name: 'Rwanda', status: 'in_flux', checked: CHECKED,
    readyFor: 'RDB and the new CMO',
    ready: ['Signed split sheets and the legal name of every writer, for each song.', 'The dates and recordings for each song. A new society will ask for exactly this.', 'Two questions for RDB’s Intellectual Property team: how to register your works, and the name and status of the new CMO.'],
    headline: 'The Rwanda Society of Authors (RSAU) was dissolved in 2025. The ministerial order for its replacement has been reported as published, but no new society is operating yet, so there is still no national society to join.',
    bodies: [
      { name: 'Rwanda Society of Authors', abbr: 'RSAU', status: 'dissolved',
        does: 'Was the approved collective management organisation for music, collecting public-performance and similar royalties.',
        note: 'Press reports in April 2025 described it as dissolved after years of criticism over how little it paid out. Its website was still online when checked, so confirm its status before dealing with anyone using its name.', website: 'https://rsau.rw' },
      { name: 'New collective management organisation (CMO)', status: 'pending',
        does: 'The government (MINICOM, the Ministry of Youth and Arts and RDB) is setting up a new CMO under the recent Law on the Protection of Intellectual Property.',
        note: 'At a 3 July 2026 ministry roundtable, RDB’s chief executive said the CMO Ministerial Order has been published and that RDB is strengthening its Intellectual Property office to run the CMO. No operator, start date, membership process or fees have been announced. Earlier reporting said it will focus on public use such as radio and venues, not streaming platform payments.',
        fees: { basis: 'not_published', join: 'No fees announced, because nothing is operating yet.', checked: CHECKED } },
      { name: 'Rwanda Development Board, Intellectual Property', abbr: 'RDB', status: 'active',
        does: 'Government body that registers copyright and handles IP policy.', website: 'https://rdb.rw' },
    ],
    steps: [
      'Keep your own records now: legal names, signed split sheets and the dates and recordings for each song. A new society will ask for exactly this.',
      'Use your distributor for recording (master) royalties from streaming; this does not depend on a society.',
      'Ask RDB’s Intellectual Property team about registering your works, and about the status and name of the new CMO.',
      'For composition royalties from streaming and from abroad, consider a publishing administrator (see the international options below), since there is no national society to register with yet.',
      'Watch for the announcement of the new CMO and its membership process, then register your works with it.',
    ],
    watchOut: [
      'Do not assume past RSAU membership carries over to a new body.',
      'Confirm with RDB before paying any registration fee to an organisation claiming to collect on RSAU’s behalf.',
      'Some international directories still list RSAU as Rwanda’s society. Do not treat that as current.',
    ],
    registration: [
      { name: 'RDB, Intellectual Property', fee: 'Reported free', basis: 'reported', note: 'Optional. The “free” claim comes from a 2022 guide; RDB’s own procedures page gave no fee or document list, so ask the IP office (info@rdb.rw, +250 727 775 170).', url: 'https://rdb.rw' },
    ],
    sources: [
      { label: 'Ministry of Youth and Arts: roundtable on monetisation (Jul 2026)', url: 'https://www.mod.gov.rw/docs-media/news-detail/moya-convenes-roundtable-on-sustainable-monetization-pathways-for-rwandas-creative-industry' },
      { label: 'The New Times / allAfrica: govt-backed arts council after RSAU shutdown (Apr 2025)', url: 'https://allafrica.com/stories/202504250038.html' },
      { label: 'MINICOM: consultation on the CMO Ministerial Order', url: 'https://www.minicom.gov.rw/news-detail/government-engages-artists-in-consultation-on-collective-management-organisation-framework' },
      { label: 'Streamlinefeed: Parliament presses for the CMO (Jul 2026)', url: 'https://streamlinefeed.co.ke/news/rwandan-parliament-demands-aggressive-ip-enforcement-to-salvage-the-creative-economy' },
    ],
  },
  {
    code: 'KE', name: 'Kenya', status: 'in_flux', checked: CHECKED,
    readyFor: 'PAVRISK and KECOBO',
    ready: ['A works list: song titles, writers with legal names and shares, and the recording details.', 'Proof that you may manage the rights, since KECOBO now requires CMOs to hold verifiable member and works lists.', 'The current KECOBO list of licensed CMOs. Licences run one year at a time, so check it is still current.', 'Bank or mobile money details and ISRC or ISWC codes. This is a typical list; PAVRISK publishes none, so confirm with it.', 'If you are a producer or label: whether KAMP’s suspension has ended.'],
    headline: 'Kenya licenses its collecting societies one year at a time. The 2025/26 licences ran from 5 November 2025 and KECOBO invited 2027 applications on 4 September 2026, but we could not find a list of licensed societies for after 4 November 2026, so confirm before you join anyone.',
    bodies: [
      { name: 'Performing and Audio-Visual Rights Society of Kenya', abbr: 'PAVRISK', status: 'active',
        does: 'Licensed by KECOBO (the Kenya Copyright Board) for one year from 5 Nov 2025. Manages music rights and performers’ audiovisual rights, and was appointed to collect on KAMP’s behalf while KAMP is suspended.',
        payout: 'Reported as a twice-yearly cycle, in April and October.',
        fees: { basis: 'not_published', join: 'No joining fee found. Ask PAVRISK before paying.', deduction: 'KECOBO’s licence conditions say at least 70% of what is collected must go to rights holders (reported).', checked: CHECKED,
          source: { label: 'Music In Africa: KECOBO licences', url: 'https://musicinafrica.net/magazine/kenya-kecobo-grants-one-year-licences-two-cmos/' } } },
      { name: 'Kenya Association of Music Producers', abbr: 'KAMP', status: 'suspended',
        does: 'Represents producers of sound recordings (master rights).',
        note: 'KECOBO suspended its licence for 90 days from 1 July 2026 over governance and royalty-spending findings. On 24 August 2026 it also ordered KAMP’s board to suspend the chief executive and vacate office, with new board elections within 30 days, and said the suspension would not be lifted until the breaches are addressed. PAVRISK was directed to collect for KAMP’s members into a separate account meanwhile.',
        fees: { basis: 'reported', join: 'Reported: KES 10,000 once for producers; KES 5,000 (new) or KES 3,000 (existing) for performers.', note: 'This comes from one guide site, not from KAMP, and KAMP is suspended. Confirm before paying.', checked: CHECKED,
          source: { label: 'PayBill KE guide', url: 'https://paybillke.com/guides/music-royalties-kenya-how-artists-get-paid' } } },
      { name: 'Music Copyright Society of Kenya', abbr: 'MCSK', status: 'suspended',
        does: 'Historically represented authors, composers and publishers.',
        note: 'KECOBO declined to renew its licence for 2025–2026 and the courts have barred it from collecting while its appeal is pending, so it is not currently authorised to collect.',
        fees: { basis: 'not_published', join: 'No fee found, and it is not authorised to collect, so do not pay it.', checked: CHECKED } },
      { name: 'Kenya Copyright Board', abbr: 'KECOBO', status: 'active',
        does: 'The regulator: licenses and supervises CMOs and registers copyright.', website: 'https://copyright.go.ke', apply: 'https://nrr.copyright.go.ke' },
    ],
    steps: [
      'Check KECOBO’s website for the list of CMOs licensed for the 2026/27 or 2027 year before you join anyone. The 2025/26 licences ran for one year from 5 November 2025.',
      'For composition and performance rights, ask which body currently holds the licence for music authors; today that is PAVRISK.',
      'For master rights as a producer or label, check whether KAMP’s suspension has ended or PAVRISK is still collecting for it.',
      'Prepare a works list: song titles, writers with legal names and shares, and the recording details. KECOBO now requires CMOs to hold verifiable member and works lists with proof they may manage the rights.',
      'Optionally register your copyright with KECOBO as evidence of ownership.',
    ],
    watchOut: [
      'Royalties paid to a body that is not licensed may not count as valid, so check the current licence list.',
      'Licensed CMOs must follow a 70/30 rule: at least 70% of what is collected goes to rights holders.',
      'None of the Kenyan societies publishes a joining fee we could verify. Ask each what it charges and what it keeps before you pay.',
    ],
    registration: [
      { name: 'KECOBO national registry', fee: 'Not stated', basis: 'not_published', note: 'Optional. Sign up on the registry portal and upload your work; not registering does not remove any rights.', url: 'https://nrr.copyright.go.ke' },
    ],
    sources: [
      { label: 'KECOBO news and updates', url: 'https://copyright.go.ke/media-center/news-updates' },
      { label: 'The Star: PAVRISK e-Citizen system (Oct 2026)', url: 'https://www.the-star.co.ke/sasa/entertainment/2026-10-01-pavrisk-fully-operationalises-e-citizen-royalty-collection-system' },
      { label: 'KECOBO statement on CMO licensing 2025', url: 'https://copyright.go.ke/sites/default/files/downloads/Statement%20on%20CMOs%20Licensing%202025.pdf' },
      { label: 'The Standard: KECOBO suspends KAMP (Jul 2026)', url: 'https://www.standardmedia.co.ke/sports/business/article/2001551851/www.digger.co.ke' },
      { label: 'Citizen Digital: MCSK barred from collecting', url: 'https://www.citizen.digital/article/win-for-kecobo-as-mcsk-barred-from-collecting-royalties-n372276' },
      { label: 'Downtown Music Publishing Africa: Kenya CMO shake-up', url: 'https://downtownmusic.africa/kenyas-cmo-shake-up-what-the-mcsk-ban-means-for-royalty-collection-and-distribution-in-2026/' },
    ],
  },
  {
    code: 'UG', name: 'Uganda', status: 'working', checked: CHECKED,
    readyFor: 'UPRS',
    ready: [],
    readyGroups: [
      { title: 'Individual writer or composer', items: [
        'The UGX 50,000 membership fee, paid first using UPRS’s payment guide.',
        'A list of the works to register, with contribution agreements showing each contributor’s percentage share.',
        'A scanned passport-size photo and a scanned valid National ID, both as PDF.',
        'Next of kin: full name and contact details.',
        'Bank and mobile money details registered in your own name, and an active mobile number.',
        'If under 16: a parent or guardian with a valid National ID. If the creator has died: a death certificate and a court letter of administration.',
      ] },
      { title: 'Label, publisher or band', items: [
        'The UGX 50,000 membership fee.',
        'Certificate of incorporation, TIN certificate and trading licence.',
        'A signed company resolution, and a works list with percentage shares.',
        'Signed contracts between contributors, and a bank account in the entity’s name.',
      ] },
    ],
    headline: 'The Uganda Performing Right Society (UPRS) is the licensed music society, regulated by URSB, and you can join online.',
    bodies: [
      { name: 'Uganda Performing Right Society', abbr: 'UPRS', status: 'active',
        does: 'The national music CMO. Collects performance and mechanical royalties, for composers, authors, publishers, producers and performers, and is a CISAC member, so it also represents foreign repertoire in Uganda.',
        note: 'Restructured after a regulator investigation in 2019–2020 and run by a board partly appointed by URSB.', website: 'https://www.uprs.go.ug', dashboard: 'https://membership.uprs.go.ug/login',
        apply: 'https://membership.uprs.go.ug',
        payout: 'Once a year, in three payouts: general public performance, radio and TV, and foreign, online and sound recording.',
        fees: { basis: 'published', join: 'UGX 50,000 for individuals and legal entities.', recurring: 'Not stated. UPRS does not say whether the UGX 50,000 is one-off or yearly, so ask.',
          deduction: 'Not stated. Of what is paid out, UPRS splits 50% songwriter and 50% publisher (all to the songwriter if there is no publisher).',
          note: 'An earlier version of this guide said joining is free. UPRS’s current requirements page lists the fee instead.', checked: CHECKED,
          source: { label: 'UPRS membership requirements', url: 'https://www.uprs.go.ug/creators/benefits' } } },
      { name: 'Uganda Registration Services Bureau', abbr: 'URSB', status: 'active',
        does: 'Registers copyright and regulates collecting societies.', website: 'https://ursb.go.ug' },
    ],
    steps: [
      'Pay the UGX 50,000 membership fee first, using UPRS’s payment guide.',
      'Register on the UPRS membership portal and upload your documents (ID, photo, next of kin, payment details, works list with shares).',
      'Sign the membership agreement that lets UPRS manage your rights.',
      'Log in to the members portal to register each new song.',
      'Distribute through a distributor for master royalties; UPRS is separate and does not collect those.',
    ],
    watchOut: [
      'UPRS manages one bundle of rights (performing and mechanical). Sync licences you negotiate yourself.',
      'Members have historically complained about slow payouts, and UPRS pays once a year, so keep your own records of every registered song.',
      'Parliament passed a Copyright and Neighbouring Rights (Amendment) Bill on 17 March 2026 with a 70/30 rule for societies. We could not confirm presidential assent, so the rules may change.',
    ],
    registration: [
      { name: 'URSB, copyright registration', fee: 'UGX 50,000 (a search is UGX 35,000)', basis: 'published', note: 'Optional, and separate from joining UPRS. Online form, URA payment form, then email the work and proof of payment; a certificate follows.', url: 'https://ursb.go.ug' },
    ],
    sources: [
      { label: 'UPRS membership requirements and fees', url: 'https://www.uprs.go.ug/creators/benefits' },
      { label: 'Nymynet: Uganda copyright law 2026 explained (Apr 2026)', url: 'https://nymynet.com/uganda-copyright-law-2026-explained-what-it-fixes-misses-and-overlooks-part-1/' },
      { label: 'UPRS music licensing', url: 'https://www.uprs.go.ug/music-users/licence' },
      { label: 'Daily Monitor: how UPRS is rebuilding trust', url: 'https://www.monitor.co.ug/uganda/lifestyle/entertainment/how-uprs-is-rebuilding-trust-future-of-uganda-s-music-rights-5016592' },
    ],
  },
  {
    code: 'TZ', name: 'Tanzania', status: 'working', checked: CHECKED,
    readyFor: 'COSOTA (or COSOZA in Zanzibar)',
    ready: [],
    readyGroups: [
      { title: 'Individual (Form CST4)', items: [
        'Full name and any pseudonym, date and place of birth, home and contact address with phone and email.',
        'Marital status, bank details, whether you have full-time employment elsewhere, and whether you belong to another copyright society.',
        'The names of your heirs for royalties after your death.',
        'The joining fee (5,000 on the 2005 schedule; confirm the amount and currency).',
      ] },
      { title: 'Group (Form CST5)', items: [
        'Group name, date and place of foundation, registration certificate number and legal form.',
        'The representatives and members, and a signed declaration from each representative.',
        'The joining fee (10,000 on the 2005 schedule; confirm the amount and currency).',
      ] },
      { title: 'Each work (Form CST8, one per work)', items: [
        'Title, album, type and duration; creators, lyricists, arrangers and publishers.',
        'The enclosures the form lists (lyrics, cassette, CD, video, manuscript) and a signed assignment of performing, broadcasting and mechanical rights to COSOTA.',
        'The agreement between co-owners. The regulations name no ownership document, but COSOTA may weigh any evidence of ownership.',
      ] },
    ],
    headline: 'On the mainland COSOTA is both the copyright office and the collecting society; Zanzibar has its own body, COSOZA.',
    bodies: [
      { name: 'Copyright Society of Tanzania', abbr: 'COSOTA', status: 'active',
        does: 'Copyright office and collective management organisation for mainland Tanzania. Registers members and works, licenses users, and distributes royalties.', website: 'https://www.cosota.go.tz',
        fees: { basis: 'published', join: '5,000 for an individual, 10,000 for a group (2005 schedule).', recurring: '10,000 a year for an individual, 50,000 a year for a group. Declaring a work is nil.',
          deduction: 'Not published in the sources we opened.', note: 'From the 2005 regulations’ First Schedule. No currency is printed and COSOTA’s General Assembly may have changed the amounts, so confirm with COSOTA before paying.', checked: CHECKED,
          source: { label: 'WIPO Lex: registration regulations (2005)', url: 'https://www.wipo.int/wipolex/en/text/216523' } },
        payout: 'Not published in the sources we opened.' },
      { name: 'Copyright Society of Zanzibar', abbr: 'COSOZA', status: 'active',
        does: 'The equivalent body for Zanzibar, since copyright is not a union matter.' },
      { name: 'Additional licensed CMOs', status: 'unclear',
        does: 'COSOTA has begun licensing further CMOs, for example Tanzania Music Rights Society (TAMRISO). Check which body covers which rights before you choose.' },
    ],
    steps: [
      'Apply for membership of COSOTA (or COSOZA in Zanzibar) under the 2005 registration regulations.',
      'Declare each work on Form CST8, one work per form. Declaring a work costs nothing, but the annual subscription applies.',
      'The form assigns performing, broadcasting and mechanical rights in the declared works to the society.',
      'Bring the agreement between co-owners; COSOTA asks for it when you register a work.',
      'Ask COSOTA whether a newer CMO such as TAMRISO now handles music royalties you want collected.',
    ],
    watchOut: [
      'Registration is reported to be done in person at the Dar es Salaam office, so confirm current procedures before travelling.',
      'Payouts have been criticised as infrequent and small. The fee amounts come from the 2005 regulations and may have changed.',
      'If COSOTA refuses a registration, you have 30 days to ask for a hearing or reply.',
    ],
    sources: [
      { label: 'COSOTA: registration of works', url: 'https://www.cosota.go.tz/services/registration-of-works' },
      { label: 'WIPO Lex: the registration regulations (2005)', url: 'https://www.wipo.int/wipolex/en/text/216523' },
      { label: 'Daily News: first licensed music CMO (TAMRISO)', url: 'https://dailynews.co.tz/dar-artists-reap-400m-from-loyalties/' },
    ],
  },
  {
    code: 'BI', name: 'Burundi', status: 'in_flux', checked: CHECKED,
    readyFor: 'OBDA',
    ready: ['For each work: the author, the work and the production company, as OBDA’s declaration forms ask.', 'A copy of every declaration you submit.', 'Someone who can read French and Kirundi, since the forms use both.'],
    headline: 'The government office OBDA registers artists and collects royalties, but it has reported that it collects more than it can yet distribute.',
    bodies: [
      { name: 'Office Burundais du Droit d’Auteur et des Droits Voisins', abbr: 'OBDA', status: 'active',
        does: 'Government copyright office created by decree in 2011. Acts as the collecting body for authors and neighbouring rights, and is the intermediary for licensing users of works.',
        note: 'Its director said in 2025 it collects royalties regularly but did not yet distribute them for lack of suitable software. About 367 artists and 2,495 works were registered then.' },
    ],
    steps: [
      'Register as an author with OBDA and declare your works on its declaration forms (author, work, production company).',
      'Sign the act of adherence that entrusts OBDA to manage your use rights.',
      'Keep copies of every declaration; the law protects works for the author’s life plus 50 years for heirs.',
      'Use a distributor for streaming master royalties, and consider a publishing administrator for international composition income.',
    ],
    watchOut: [
      'Check with OBDA when it last paid out and how distribution works before relying on it.',
      'Documents and forms are in French and Kirundi.',
    ],
    sources: [
      { label: 'Iwacu: Nakaranga musicians and OBDA (2025)', url: 'https://www.iwacu-burundi.org/anciens-musiciens-de-nakaranga-des-destins-brises/' },
      { label: 'Music In Africa: copyright law in Burundi', url: 'https://musicinafrica.net/node/32848' },
    ],
  },
  {
    code: 'CD', name: 'DR Congo', status: 'in_flux', checked: CHECKED,
    readyFor: 'SOCODA',
    ready: ['Your membership file, plus a works list with legal names and shares.', 'Confirmation of which organisation is legally recognised, before you pay any fee.'],
    headline: 'SOCODA replaced the old SONECA, but its management has been disputed and the government has discussed a state-run structure.',
    bodies: [
      { name: 'Société Congolaise des Droits d’Auteur et des Droits Voisins', abbr: 'SOCODA', status: 'unclear',
        does: 'A cooperative that manages collective rights for authors, composers, performers and producers. Membership is by application at its headquarters.',
        note: 'Artists in the diaspora have criticised it as run like a private business, and a government plan for a state structure was reported in May 2025. A 2023 ministry communiqué suspended both SOCODA and SONECA. Press reports in 2026 mention a distribution on 15 July 2026 alongside an audit finding of over US$25 million unaccounted for; we have not seen the audit itself.',
        fees: { basis: 'not_published', join: 'No fee or requirements found. Ask before you pay.', checked: CHECKED } },
      { name: 'Société Nationale des Éditeurs, Compositeurs et Auteurs', abbr: 'SONECA', status: 'dissolved',
        does: 'The former national society (1969). Replaced by SOCODA, though people still use the name.' },
    ],
    steps: [
      'Check the current status of SOCODA and any new state body with the Ministry of Culture.',
      'If you join, submit the membership file and list your works with legal names and shares.',
      'Use a distributor for master royalties and consider an international publishing administrator for composition income.',
    ],
    watchOut: [
      'Several organisations have claimed this mandate. Confirm which one is legally recognised before paying any fee.',
      'Information here comes from fewer sources than for other countries, so verify it.',
    ],
    sources: [
      { label: 'Music In Africa: copyright legislation in the DRC', url: 'https://www.musicinafrica.net/fr/magazine/l%C3%A9gislation-relative-au-droit-d%E2%80%99auteur-en-rdc' },
      { label: 'ACP: suspension of SOCODA and SONECA (2023)', url: 'https://acp.cd/culture/kinshasa-suspension-des-activites-de-la-socoda-et-de-la-soneca/' },
      { label: 'ACP: diaspora artists on a state structure (May 2025)', url: 'https://acp.cd/culture/droit-dauteur-les-artistes-de-la-diaspora-pour-une-structure-etatique-en-rdc/' },
    ],
  },
  {
    code: 'SS', name: 'South Sudan', status: 'none', checked: CHECKED,
    readyFor: 'a future society',
    ready: ['Split sheets, dated recordings and a written list of your works.', 'A distributor account for master royalties from streaming.'],
    headline: 'Reporting says South Sudan has not enacted a modern copyright law, and no operating collecting society was found. In March 2026 the culture ministry was reported to be fast-tracking a copyright bill.',
    bodies: [
      { name: 'No collecting society found', status: 'unclear',
        does: 'A copyright policy was developed with UNESCO and EU support, and artists have been calling for the law to be passed.' },
    ],
    steps: [
      'Keep strong records: split sheets, dated recordings and a written list of your works.',
      'Use a distributor for master royalties from streaming.',
      'Consider a publishing administrator to register your compositions abroad, since there is no national society to register with.',
      'Watch for the copyright law and the creation of a CMO.',
    ],
    watchOut: [
      'The sources are news and opinion pieces rather than official ones, so check current status with the Ministry of Justice.',
    ],
    sources: [
      { label: 'Eye Radio: culture ministry fast-tracks copyright bill (Mar 2026)', url: 'https://www.eyeradio.org/culture-ministry-fast-tracks-copyright-bill-to-safeguard-creative-economy/' },
      { label: 'Radio Tamazuj: why South Sudan needs a copyright law', url: 'https://www.radiotamazuj.org/en/news/article/opinion-why-south-sudan-needs-a-copyright-law-now' },
      { label: 'Radio Tamazuj: musicians demand a copyright law', url: 'https://www.radiotamazuj.org/en/news/article/we-cant-earn-a-living-musicians-demand-copyright-law' },
    ],
  },
]

// Shown for every country, and as the main route where there is no working society.
export const INTERNATIONAL = {
  intro: 'A publishing administrator registers your compositions with societies around the world and collects composition royalties for you, usually for a commission. It does not replace a local society where a licensed one exists, and it is not the same as your distributor, which handles master royalties.',
  options: [
    { name: 'Downtown Music Publishing Africa', url: 'https://downtownmusic.africa', note: 'Registers works locally and internationally and works with African creators. Its own guide says administration deals commonly take about 10–20% commission.' },
    { name: 'Songtrust', url: 'https://www.songtrust.com', note: 'Self-serve administrator covering many territories. Its pricing page lists US$100 once per songwriter, then 15% of performance royalties and 20% of other royalties, with no annual fee. It collects only on songs that reach activity thresholds. It does not replace a local society, and its database still lists the dissolved RSAU for Rwanda, so do not rely on that entry.' },
  ],
  note: 'Fees and eligibility change, so compare current terms and read the agreement before signing. Keep ownership of your songs: an administration deal should not transfer your copyright.',
}

// The kinds of money a song can earn. Drives the Info tab. `term` is the glossary entry for the same idea.
export type MoneySide = 'recording' | 'composition' | 'either'
export interface MoneyType {
  name: string; term: string; side: MoneySide
  who: string       // who collects it
  paidTo: string    // who receives it
  detail: string    // what it covers
  example: string
  action: string    // what the artist does about it
}
export const MONEY_TYPES: MoneyType[] = [
  {
    name: 'Recording (master) royalties', term: 'master-royalties', side: 'recording',
    who: 'Your distributor', paidTo: 'Whoever owns the recording',
    detail: 'Streams and downloads of the recording itself. No society is needed.',
    example: 'A listener streams your song on a music app and the app pays your distributor, who pays you.',
    action: 'Pick a distributor and keep your recording ownership splits right.',
  },
  {
    name: 'Performance royalties', term: 'performance-royalties', side: 'composition',
    who: 'A collecting society (or an administrator abroad)', paidTo: 'The writers and publishers of the song',
    detail: 'Radio, TV, venues, bars and streaming performances of the composition.',
    example: 'Your song is played on a radio station or in a bar.',
    action: 'Register your songs with the society that applies to you.',
  },
  {
    name: 'Mechanical royalties', term: 'mechanical-royalties', side: 'composition',
    who: 'A collecting society or mechanical agency', paidTo: 'The writers and publishers of the song',
    detail: 'Reproduction of the composition, including streaming. Some societies, such as UPRS and COSOTA, handle this as well as performance.',
    example: 'Your song is downloaded, or someone records a cover of it.',
    action: 'Check whether your society covers this too, and keep your writer splits accurate.',
  },
  {
    name: 'Neighbouring rights', term: 'neighbouring-rights', side: 'recording',
    who: 'Varies by country, sometimes a separate society', paidTo: 'Performers and owners of the recording',
    detail: 'Payment when a recording is broadcast or played in public. It goes to the people who performed on and own the recording, not to the writers.',
    example: 'A radio station plays your recording, and the performers and recording owner are paid for that play.',
    action: 'Ask your society or distributor whether this is collected where you live.',
  },
  {
    name: 'Sync licensing', term: 'sync-licensing', side: 'either',
    who: 'You, directly', paidTo: 'The owners of both the song and the recording',
    detail: 'Use in a film, advert or game is negotiated with the rights holders. The society collects performance royalties when it is broadcast.',
    example: 'A company wants your song in an advert and agrees a fee with you.',
    action: 'Keep clear records of who owns what, so a deal can be agreed quickly.',
  },
]
// Every body the artist can track: the bodies in the country guide, plus the international options.
export interface TrackableBody { name: string; country: string; countryName: string; website?: string; dashboard?: string }
export const TRACKABLE: TrackableBody[] = [
  ...COUNTRIES.flatMap((c) => c.bodies.map((b) => ({ name: b.name, country: c.code, countryName: c.name, website: b.website, dashboard: b.dashboard }))),
  ...INTERNATIONAL.options.map((o) => ({ name: o.name, country: 'INT', countryName: 'International', website: o.url })),
]

export const countryNameOf = (code: string) => (code === 'INT' ? 'International' : COUNTRIES.find((c) => c.code === code)?.name ?? code)
export const websiteOf = (name: string, country: string) => TRACKABLE.find((t) => t.name === name && t.country === country)?.website
export const dashboardOf = (name: string, country: string) => TRACKABLE.find((t) => t.name === name && t.country === country)?.dashboard

// The one thing a new artist should do next, by country status. Kept short and free of jargon on purpose.
export const NEXT_STEP: Record<CountryStatus, { title: string; text: string }> = {
  working: { title: 'Your next step: join', text: 'A society is operating here. Join the one that covers music authors and composers, then register your songs with it.' },
  in_flux: { title: 'Your next step: prepare, but do not pay yet', text: 'The setup here is changing. Get your records ready, confirm directly with the body which organisation is currently licensed, and hold off on paying any fee until you have.' },
  none: { title: 'Your next step: use an administrator', text: 'There is no operating society to join here. Your distributor still pays your recording royalties, and a publishing administrator can collect composition royalties abroad for you.' },
}

// What an artist should have in hand before applying anywhere.
export const READY_LIST = [
  'The legal name of every writer on each song',
  'Your confirmed ownership splits for each song',
  'The song titles and the dates they were written or released',
  'A recording of each song, which societies often accept as proof of authorship',
]
