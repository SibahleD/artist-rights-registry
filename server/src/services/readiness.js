const pool = require('../db/pool');
const { noticeReadiness } = require('./notices');
const { distributionChecks } = require('../lib/distribution');

// Check levels: error blocks "mark ready", warn is worth a look but never blocks, info is only advice.
const ORDER = { error: 0, warn: 1, info: 2 };
const IPI_ROLES = ['composer', 'songwriter', 'lyricist', 'arranger', 'publisher'];

const normalise = (s) => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function editDistance(a, b) {
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let diag = prev[0];
        prev[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const keep = prev[j];
            prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
            diag = keep;
        }
    }
    return prev[b.length];
}

// names: [{ label, name }]. Returns the distinct spellings that look like the same artist written differently:
// same letters with different case, spacing or punctuation, or one character apart on a name of 5+ characters.
function spellingConflicts(names) {
    const variants = new Map(); // trimmed spelling -> labels
    for (const { label, name } of names) {
        const n = typeof name === 'string' ? name.trim() : '';
        if (!n) continue;
        if (!variants.has(n)) variants.set(n, []);
        variants.get(n).push(label);
    }
    const list = [...variants.keys()];
    const clash = new Set();
    for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
            const a = normalise(list[i]), b = normalise(list[j]);
            if (a === b || (Math.min(a.length, b.length) >= 5 && editDistance(a, b) <= 1)) {
                clash.add(list[i]); clash.add(list[j]);
            }
        }
    }
    return [...clash].map((name) => ({ name, labels: variants.get(name) }));
}

const trackList = (nums) => (nums.length === 1 ? `track ${nums[0]}` : `tracks ${nums.join(', ')}`);

async function readinessChecks(release) {
    const edit = `/releases/${release.id}/edit`;
    const splitsPage = `/releases/${release.id}/splits`;
    const checks = [];
    const add = (level, id, message, fix, extra = {}) => checks.push({ id, level, message, fix, ...extra });

    if (!release.release_date) add('error', 'release-date', 'Release date is required.', edit);

    const { rows: tracks } = await pool.query(
        `SELECT t.track_number, t.title, t.artist_name, t.isrc, t.iswc,
                EXISTS (SELECT 1 FROM audio_files f WHERE f.track_id = t.id) AS has_audio,
                (SELECT COALESCE(SUM(c.ownership_percent), 0) FROM collaborators c WHERE c.track_id = t.id) AS split_total
         FROM tracks t
         WHERE t.release_id = $1
         ORDER BY t.track_number`,
        [release.id]
    );
    if (tracks.length === 0) add('error', 'no-tracks', 'At least one track is required.', edit);

    // Cover art is an uploaded image, stored in `media`.
    const { rowCount: artworkCount } = await pool.query(
        `SELECT 1 FROM media WHERE release_id = $1 AND kind = 'artwork'`, [release.id]);
    if (artworkCount === 0) add('error', 'release-artwork', 'Cover art is required. Upload a square JPEG or PNG.', edit);
    for (const t of tracks) {
        const fix = `${edit}?track=${t.track_number}`;
        if (!t.has_audio) add('error', 'track-audio', `Track ${t.track_number} ("${t.title}") has no audio file.`, fix, { track: t.track_number });
        if (Math.round(Number(t.split_total) * 100) !== 10000) {
            add('error', 'track-splits', `Track ${t.track_number} ("${t.title}") splits must total 100% (currently ${Number(t.split_total)}%).`, fix, { track: t.track_number });
        }
    }

    // Co-writer state comes from the notices.
    const notice = await noticeReadiness(release);
    for (const it of notice.items) {
        add(it.level, it.id, it.message, splitsPage, { track: it.trackNumber });
    }

    // Artist-name spelling, across the release and its tracks.
    const conflicts = spellingConflicts([
        { label: 'release', name: release.album_artist },
        ...tracks.map((t) => ({ label: `track ${t.track_number}`, name: t.artist_name })),
    ]);
    if (conflicts.length > 1) {
        const shown = conflicts.map((c) => `"${c.name}" (${c.labels.join(', ')})`).join(' and ');
        add('warn', 'artist-name-spelling',
            `The artist name is spelled more than one way: ${shown}. Stores can treat these as different artists, so pick one spelling.`, edit);
    }

    // Details distributors ask for: warnings and advice only, because requirements differ between distributors.
    const [artwork, audio, artists] = await Promise.all([
        pool.query(`SELECT width, height, size_bytes FROM media WHERE release_id = $1 AND kind = 'artwork'`, [release.id]),
        pool.query(`SELECT t.track_number, a.format, a.bitrate_kbps, a.sample_rate_hz
                    FROM audio_specs a JOIN tracks t ON t.id = a.track_id WHERE t.release_id = $1 ORDER BY t.track_number`, [release.id]),
        pool.query(`SELECT name FROM release_artists WHERE release_id = $1 ORDER BY position`, [release.id]),
    ]);
    const lyrics = await pool.query(`SELECT track_number, has_lyrics FROM tracks WHERE release_id = $1 ORDER BY track_number`, [release.id]);
    for (const c of distributionChecks({
        release, tracks: lyrics.rows, audio: audio.rows, artwork: artwork.rows[0] ?? null,
        artists: artists.rows.map((r) => r.name), edit,
    })) add(c.level, c.id, c.message, c.fix, c.track ? { track: c.track } : {});

    // Optional identifiers: advice only, never blocking.
    const noIsrc = tracks.filter((t) => !t.isrc).map((t) => t.track_number);
    if (noIsrc.length) add('info', 'isrc-missing', `No ISRC yet on ${trackList(noIsrc)}. Your distributor can issue one if you don't have it.`, edit);
    const noIswc = tracks.filter((t) => !t.iswc).map((t) => t.track_number);
    if (noIswc.length) add('info', 'iswc-missing', `No ISWC yet on ${trackList(noIswc)}. It is only issued once the work is registered with a rights society, so this is normal early on.`, edit);
    if (!release.upc) add('info', 'upc-missing', 'No UPC yet. Most distributors assign one when you upload.', edit);

    const { rows: writers } = await pool.query(
        `SELECT t.track_number, c.legal_name
         FROM collaborators c JOIN tracks t ON t.id = c.track_id
         WHERE t.release_id = $1 AND NOT c.removed_by_writer AND c.ipi IS NULL
           AND c.ownership_percent > 0 AND c.role = ANY($2)
         ORDER BY t.track_number, c.created_at, c.id`,
        [release.id, IPI_ROLES]
    );
    if (writers.length) {
        const shown = writers.slice(0, 5).map((w) => `${w.legal_name} (track ${w.track_number})`).join(', ');
        add('info', 'ipi-missing',
            `No IPI number for ${shown}${writers.length > 5 ? ` and ${writers.length - 5} more` : ''}. Only add it if the writer has one; rights societies use it to match credits.`, edit);
    }

    return checks.map((c, i) => [c, i]).sort((a, b) => ORDER[a[0].level] - ORDER[b[0].level] || a[1] - b[1]).map(([c]) => c);
}

// The blocking messages only, as plain strings.
const errorsOf = (checks) => checks.filter((c) => c.level === 'error').map((c) => c.message);
async function readinessProblems(release) { return errorsOf(await readinessChecks(release)); }

module.exports = { readinessChecks, readinessProblems, errorsOf, spellingConflicts };
