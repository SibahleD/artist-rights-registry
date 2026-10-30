const pool = require('../db/pool');
const { creditStatuses } = require('./notices');
const { copyrightLine } = require('../lib/copyright');

// Everything that leaves the server in an export is picked from these lists. Nothing is copied wholesale,
// so internal ids, owner ids and co-writer emails can never leak by accident when a column is added.
const RELEASE_KEYS = ['title', 'release_type', 'album_artist', 'genre', 'release_date', 'upc', 'p_line', 'c_line',
    'label_name', 'language', 'status', 'created_at', 'ready_at',
    'album_version', 'is_compilation', 'has_lyrics', 'has_cover_versions', 'explicit', 'secondary_genre',
    'originally_released', 'preorder_date', 'sales_start_date'];
const TRACK_KEYS = ['track_number', 'title', 'composition_title', 'artist_name', 'genre', 'isrc', 'iswc',
    'duration_seconds', 'explicit', 'composition_copyright_year', 'composition_copyright',
    'recording_copyright_year', 'recording_copyright', 'origin', 'version_title', 'language',
    'has_lyrics', 'preview_start_seconds'];
const AUDIO_KEYS = ['file_name', 'format', 'bitrate_kbps', 'sample_rate_hz', 'channels', 'size_bytes'];
const CREDIT_KEYS = ['legal_name', 'role', 'ipi', 'writer_status', 'publisher_name', 'is_self_published', 'is_featured'];
const ARTWORK_KEYS = ['mime_type', 'width', 'height', 'size_bytes'];

const pick = (row, keys) => Object.fromEntries(keys.map((k) => [k, row?.[k] ?? null]));
const iso = (v) => (v instanceof Date ? v.toISOString() : v ?? null);

// Pure shaping step, so it can be tested without a database. Rows may carry ids; none of them come out.
// artists: primary artist names in order. contributors: [{ track_number | null, position, name, title }] (producer-style credits).
function shapeExport({ release, tracks, audio, collaborators, statuses, artwork, artists = [], contributors = [], now = new Date() }) {
    const shapeContributors = (list) => list.map((c, i) => ({ position: i + 1, name: c.name, title: c.title }));
    const audioByTrack = new Map(audio.map((a) => [a.track_id, a]));
    const creditsByTrack = new Map();
    for (const c of collaborators) {
        if (!creditsByTrack.has(c.track_id)) creditsByTrack.set(c.track_id, []);
        creditsByTrack.get(c.track_id).push(c);
    }
    // The form leaves some release-level and track-level fields blank, so fill them from what the artist did enter.
    const first = tracks[0];
    const firstGenre = tracks.map((t) => t.genre).find((g) => g && String(g).trim()) ?? null;
    return {
        export_version: 1,
        exported_at: now.toISOString(),
        release: {
            ...pick(release, RELEASE_KEYS),
            genre: release.genre || firstGenre || null,
            p_line: release.p_line || copyrightLine('℗', first?.recording_copyright_year, first?.recording_copyright),
            c_line: release.c_line || copyrightLine('©', first?.composition_copyright_year, first?.composition_copyright),
            created_at: iso(release.created_at),
            ready_at: iso(release.ready_at),
            artwork: artwork ? pick(artwork, ARTWORK_KEYS) : null,
            // The artist list the album artist stands in for when none was entered, so a consumer never gets an empty list.
            primary_artists: artists.length ? artists : [release.album_artist].filter(Boolean),
            contributors: shapeContributors(contributors.filter((c) => c.track_number === null || c.track_number === undefined)),
        },
        tracks: tracks.map((t) => {
          const credits = creditsByTrack.get(t.id) ?? [];
          const featured = credits.filter((c) => c.is_featured).map((c) => c.legal_name);
          return {
            ...pick(t, TRACK_KEYS),
            display_title: featured.length ? `${t.title} (feat. ${featured.join(', ')})` : t.title,
            featured_artists: featured,
            contributors: shapeContributors(contributors.filter((c) => c.track_number === t.track_number)),
            artist_name: t.artist_name || release.album_artist || null,
            genre: t.genre || release.genre || firstGenre || null,
            audio: audioByTrack.has(t.id) ? pick(audioByTrack.get(t.id), AUDIO_KEYS) : null,
            credits: credits.map((c, i) => ({
                position: i + 1,
                ...pick(c, CREDIT_KEYS),
                is_featured: !!c.is_featured,
                ownership_percent: Number(c.ownership_percent),
                confirmation: statuses.get(c.id) ?? 'unconfirmed',
            })),
          };
        }),
    };
}

async function buildExport(release) {
    const [tracks, audio, collaborators, artwork, statuses, artists, contributors] = await Promise.all([
        pool.query(`SELECT id, ${TRACK_KEYS.join(', ')} FROM tracks WHERE release_id = $1 ORDER BY track_number`, [release.id]),
        pool.query(`SELECT a.track_id, ${AUDIO_KEYS.map((k) => `a.${k}`).join(', ')}
                    FROM audio_specs a JOIN tracks t ON t.id = a.track_id WHERE t.release_id = $1`, [release.id]),
        pool.query(`SELECT c.id, c.track_id, c.ownership_percent, ${CREDIT_KEYS.map((k) => `c.${k}`).join(', ')}
                    FROM collaborators c JOIN tracks t ON t.id = c.track_id
                    WHERE t.release_id = $1 ORDER BY t.track_number, c.created_at, c.id`, [release.id]),
        pool.query(`SELECT ${ARTWORK_KEYS.join(', ')} FROM media WHERE release_id = $1 AND kind = 'artwork'`, [release.id]),
        creditStatuses(release),
        pool.query(`SELECT name FROM release_artists WHERE release_id = $1 ORDER BY position`, [release.id]),
        pool.query(`SELECT t.track_number, c.name, c.title
                    FROM release_credits c LEFT JOIN tracks t ON t.id = c.track_id
                    WHERE c.release_id = $1 ORDER BY t.track_number NULLS FIRST, c.position`, [release.id]),
    ]);
    return shapeExport({
        release, tracks: tracks.rows, audio: audio.rows, collaborators: collaborators.rows,
        statuses, artwork: artwork.rows[0] ?? null,
        artists: artists.rows.map((r) => r.name), contributors: contributors.rows,
    });
}

// Keys anywhere in the object that look like internal ids: `id`, `*_id`, `*Id`.
function findIdKeys(value, path = '$') {
    const found = [];
    if (Array.isArray(value)) value.forEach((v, i) => found.push(...findIdKeys(v, `${path}[${i}]`)));
    else if (value && typeof value === 'object' && !(value instanceof Date)) {
        for (const [k, v] of Object.entries(value)) {
            if (k === 'id' || /_id$/.test(k) || /Id$/.test(k)) found.push(`${path}.${k}`);
            found.push(...findIdKeys(v, `${path}.${k}`));
        }
    }
    return found;
}

module.exports = { buildExport, shapeExport, findIdKeys };
