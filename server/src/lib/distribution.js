// Release details that distributors ask for, and the checks that go with them. Kept free of database and HTTP code so they can be
// tested on their own. The limits below are the common ones distributors set; nothing in here names a particular distributor.

const DEFAULT_CONTRIBUTOR_TITLE = 'Producer';

// The credit titles offered in the app, in display order. client/src/data/contributorTitles.ts must match;
// tests/distribution.test.js compares the two files so they cannot drift apart unnoticed.
const CREDIT_TITLES = [
    'Producer', 'DJ', 'Remixer', 'Conductor', 'Arranger', 'Adapter',
    'Recording Engineer', 'Mixing Engineer', 'Mastering Engineer', 'Assistant Engineer',
    'Co-Producer', 'Graphic Design',
];
const INSTRUMENT_TITLES = [
    'Accordion', 'Background Vocals', 'Banjo', 'Bass Guitar', 'Bassoon', 'Bells', 'Cello', 'Clarinet',
    'Drums', 'Ensemble', 'Fiddle', 'Flute', 'Guitar', 'Harmonica', 'Harp', 'Horn', 'Keyboards', 'Lute',
    'Metallophone', 'Mixed Artist', 'Oboe', 'Organ', 'Percussion', 'Piano', 'Programming', 'Rap', 'Recorder',
    'Sampled Artist', 'Saxophone', 'Synthesizer', 'Tambourine', 'Trombone', 'Trumpet', 'Viola', 'Viola de Gamba',
    'Violin', 'Vocals', 'Whistle', 'Xylophone',
];
const CONTRIBUTOR_TITLES = [...CREDIT_TITLES, ...INSTRUMENT_TITLES];

const MAX_ARTISTS = 20;
const MAX_CREDITS = 200;
const MAX_NAME = 200;

// Common upload limits.
const ART = { width: 3000, height: 3000, maxBytes: 25 * 1024 * 1024 };
const AUDIO = { mp3Kbps: 320, sampleRateHz: 44100 };

// ---- Dates ------------------------------------------------------------------------------------------------------

// "Originally released" must be on or before the sales start date. Dates are YYYY-MM-DD strings, which compare correctly as text.
// Pass the merged values (stored plus the incoming change) so a partial update is checked against what is already saved.
function checkReleaseDates({ originally_released, sales_start_date }) {
    if (originally_released && sales_start_date && originally_released > sales_start_date) {
        return 'Originally released must be on or before the sales start date.';
    }
    return null;
}

// RouteNote's schedule rules, relative to the day the release is uploaded (taken as today). Warnings only: other distributors differ.
// Sales start: at least 2 weeks out, at most 365 days out. Pre-order: before the sales start, at most 365 days out.
const MIN_LEAD_DAYS = 14;
const MAX_AHEAD_DAYS = 365;
const DAY_MS = 86400000;
const toDay = (s) => Date.parse(`${s}T00:00:00Z`);
const todayString = () => new Date().toISOString().slice(0, 10);

// today: YYYY-MM-DD (injectable for tests). Returns [{ id, message }], empty when everything is fine or a date is missing.
function scheduleWarnings({ sales_start_date, preorder_date }, today = todayString()) {
    const out = [];
    const t = toDay(today);
    const daysFromToday = (d) => Math.round((toDay(d) - t) / DAY_MS);
    if (sales_start_date) {
        const n = daysFromToday(sales_start_date);
        if (n < MIN_LEAD_DAYS) out.push({ id: 'dist-sales-start-soon', message: `Sales start is ${n < 0 ? 'in the past' : `only ${n} day${n === 1 ? '' : 's'} away`}. Some distributors, such as RouteNote, want it at least ${MIN_LEAD_DAYS} days after upload.` });
        else if (n > MAX_AHEAD_DAYS) out.push({ id: 'dist-sales-start-far', message: `Sales start is more than ${MAX_AHEAD_DAYS} days away. Some distributors, such as RouteNote, do not accept dates that far ahead.` });
    }
    if (preorder_date) {
        if (sales_start_date && preorder_date >= sales_start_date) out.push({ id: 'dist-preorder-order', message: 'The pre-order date should come before the sales start date.' });
        if (daysFromToday(preorder_date) > MAX_AHEAD_DAYS) out.push({ id: 'dist-preorder-far', message: `The pre-order date is more than ${MAX_AHEAD_DAYS} days away. Some distributors, such as RouteNote, do not accept dates that far ahead.` });
    }
    return out;
}

// ---- Primary artists and credits --------------------------------------------------------------------------------

const cleanName = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

// body: { primary_artists: string[], credits: [{ track_number: number | null, name, title }] }
// trackNumbers: the track numbers that exist on this release. Returns { artists, credits } or { error }.
function parseContributors(body, trackNumbers) {
    const b = body && typeof body === 'object' ? body : {};
    const rawArtists = b.primary_artists ?? [];
    const rawCredits = b.credits ?? [];
    if (!Array.isArray(rawArtists) || !Array.isArray(rawCredits)) return { error: 'Primary artists and credits must be lists.' };
    if (rawArtists.length > MAX_ARTISTS) return { error: `A release can have at most ${MAX_ARTISTS} primary artists.` };
    if (rawCredits.length > MAX_CREDITS) return { error: `A release can have at most ${MAX_CREDITS} credits.` };

    const artists = [];
    const seen = new Set();
    for (const a of rawArtists) {
        const name = cleanName(a);
        if (!name) return { error: 'A primary artist name cannot be empty.' };
        if (name.length > MAX_NAME) return { error: `Names must be at most ${MAX_NAME} characters.` };
        const key = name.toLowerCase();
        if (seen.has(key)) return { error: `"${name}" is listed twice as a primary artist.` };
        seen.add(key);
        artists.push(name);
    }

    const credits = [];
    const seenCredit = new Set();
    for (const c of rawCredits) {
        const name = cleanName(c?.name);
        if (!name) return { error: 'A credit needs a name.' };
        if (name.length > MAX_NAME) return { error: `Names must be at most ${MAX_NAME} characters.` };
        const title = c.title === undefined || c.title === null || c.title === '' ? DEFAULT_CONTRIBUTOR_TITLE : c.title;
        if (!CONTRIBUTOR_TITLES.includes(title)) return { error: `"${title}" is not one of the credit titles.` };
        const track = c.track_number === undefined || c.track_number === null ? null : c.track_number;
        if (track !== null && (!Number.isInteger(track) || !trackNumbers.includes(track))) {
            return { error: `Credit for "${name}" refers to track ${track}, which is not on this release.` };
        }
        const key = `${track}|${name.toLowerCase()}|${title}`;
        if (seenCredit.has(key)) return { error: `"${name}" is credited as ${title} twice${track ? ` on track ${track}` : ''}.` };
        seenCredit.add(key);
        credits.push({ track_number: track, name, title });
    }
    return { artists, credits };
}

// ---- Checks shown on the readiness screen -----------------------------------------------------------------------
// Everything here is a warning or advice, never a blocker, because requirements differ between distributors.
// Each check has the same shape as the checks in services/readiness.js.

const trackList = (nums) => (nums.length === 1 ? `track ${nums[0]}` : `tracks ${nums.join(', ')}`);
const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(1);

// release: release row; tracks: [{ track_number, has_lyrics }]; audio: [{ track_number, format, bitrate_kbps, sample_rate_hz }];
// artwork: { width, height, size_bytes } | null; artists: string[]. `edit` is the release's edit route.
function distributionChecks({ release, tracks = [], audio = [], artwork = null, artists = [], edit, today }) {
    const checks = [];
    const add = (level, id, message, extra = {}) => checks.push({ id, level, message, fix: edit, ...extra });

    if (!release.sales_start_date) add('warn', 'dist-sales-start', 'Add a sales start date: the first day the release can be sold or streamed.');
    if (!release.originally_released) add('warn', 'dist-originally-released', 'Add the date the music was first released. For new music, use the release date.');
    const dateProblem = checkReleaseDates(release);
    if (dateProblem) add('error', 'dist-date-order', dateProblem);
    for (const w of scheduleWarnings(release, today)) add('warn', w.id, w.message);

    if (artists.length === 0) add('info', 'dist-primary-artists', release.album_artist ? `No primary artists listed, so the album artist ("${release.album_artist}") will be used.` : 'No primary artists listed, so the album artist will be used.');

    if (artwork) {
        if (artwork.width !== ART.width || artwork.height !== ART.height) {
            add('warn', 'dist-art-size', `Cover art is ${artwork.width} x ${artwork.height} px. It should be ${ART.width} x ${ART.height} px.`);
        }
        if (artwork.size_bytes >= ART.maxBytes) {
            add('warn', 'dist-art-bytes', `Cover art is ${mb(artwork.size_bytes)} MB. It should be under 25 MB.`);
        }
    }

    const badAudio = [];
    for (const a of audio) {
        const fmt = String(a.format || '').toLowerCase();
        const okRate = a.sample_rate_hz === AUDIO.sampleRateHz;
        const ok = (fmt === 'flac' && okRate) || (fmt === 'mp3' && okRate && a.bitrate_kbps === AUDIO.mp3Kbps);
        if (!ok) badAudio.push(a.track_number);
    }
    if (badAudio.length) {
        add('warn', 'dist-audio-spec', `Audio on ${trackList(badAudio)} may be refused by distributors. Use MP3 at 320 kbps and 44.1 kHz, or FLAC at 44.1 kHz.`, { track: badAudio[0] });
    }

    const noLyrics = tracks.filter((t) => t.has_lyrics === null || t.has_lyrics === undefined).map((t) => t.track_number);
    if (noLyrics.length) add('info', 'dist-track-lyrics', `Say whether ${trackList(noLyrics)} has lyrics, yes or no. Distributors ask for this.`);

    return checks;
}

// The artwork rules no check can verify. The app shows them as a list and asks the artist to confirm.
const ART_NOT_ALLOWED = [
    'Web addresses (URLs) or contact details',
    'Pornographic images',
    'Pricing or sales information',
    'Copyrighted images you do not have the right to use',
    'Scans of a CD',
    'Blurry or pixelated images',
    'A colour space other than RGB',
];

module.exports = {
    DEFAULT_CONTRIBUTOR_TITLE, CREDIT_TITLES, INSTRUMENT_TITLES, CONTRIBUTOR_TITLES,
    ART, AUDIO, ART_NOT_ALLOWED, MAX_ARTISTS, MAX_CREDITS,
    checkReleaseDates, scheduleWarnings, parseContributors, distributionChecks,
};
