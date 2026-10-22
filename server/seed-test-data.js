#!/usr/bin/env node
/*
 * Seeds two linked TEST artists so every feature of the app can be exercised:
 *
 *   Juice WRLD       juicewrld.test@example.com
 *   The Kid LAROI    kidlaroi.test@example.com
 *
 * Each artist gets (see docs/TEST_ACCOUNTS.md for the full map):
 *   - 2 Released          (ready + released_at + store links)
 *   - 2 Yet to release    (ready, not marked released)
 *   - 2 Drafts            (one incomplete, one that passes every readiness check)
 *   - 2 Awaiting approval (drafts with a pending / a disputed co-writer notice)
 *   - 2 Collaborations    (tracks on the OTHER artist's ready releases)
 *   plus profile, avatar, artist links, societies, glossary progress, preferences.
 *
 * Usage (from /server):   node scripts/seed-test-data.js
 * Re-running is safe: it deletes the two test users (and everything they own) first.
 * It refuses to run in production or against a non-local database unless you pass --force.
 *
 * IDENTIFIERS: codes tagged `real` below were checked against public catalogue pages.
 * Every other ISRC starts ZZTS and every other UPC starts 99 so they can never be mistaken
 * for real ones. Replace them with real codes if you want real-looking data.
 */
const path = require('path');
const zlib = require('zlib');
const fs = require('fs');
const bcrypt = require('bcrypt');

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const pool = require('./src/db/pool');
const storage = require('./src/services/storage');
const { emailHash, NOTICE_VERSION } = require('./src/services/notices');
const { newToken } = require('./src/services/tokens');

const PASSWORD = 'Passw0rd!Test';
const APP_URL = process.env.APP_URL || 'http://localhost:5173/app';
const TERMS_VERSION = '2026-10-22';
const FORCE = process.argv.includes('--force');

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------
function assertSafe() {
    if (process.env.NODE_ENV === 'production' && !FORCE) {
        throw new Error('NODE_ENV is production. Refusing to seed test data (use --force only if you are sure).');
    }
    const url = process.env.DATABASE_URL || '';
    if (!/(localhost|127\.0\.0\.1|@postgres|@db[:/])/.test(url) && !FORCE) {
        throw new Error('DATABASE_URL does not look like a local database. Pass --force if this really is a test database.');
    }
    if (!process.env.EMAIL_HASH_KEY) throw new Error('EMAIL_HASH_KEY is not set in server/.env (needed to build co-writer notices).');
}

// ---------------------------------------------------------------------------
// Identifier helpers
// ---------------------------------------------------------------------------
// UPC-A check digit from the first 11 digits.
function upcA(base11) {
    const d = base11.split('').map(Number);
    const odd = d.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
    const even = d.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0);
    return base11 + ((10 - ((odd * 3 + even) % 10)) % 10);
}
const fakeUpc = (n) => upcA(`99000000${String(n).padStart(3, '0')}`);   // 12 digits, starts 99
const fakeIsrc = (tag, n) => `ZZTS${tag}${String(2600000 + n)}`;        // ZZTS + 1 letter + 7 digits = 12 chars

// ---------------------------------------------------------------------------
// Generated media (no external files needed)
// ---------------------------------------------------------------------------
const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
})();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function pngChunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
}
function hsl(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
    return [f(0), f(8), f(4)];
}
// Square vertical-gradient PNG. Rows are constant so it compresses to a few KB.
function makePng(size, hue) {
    const stride = size * 3 + 1;
    const raw = Buffer.alloc(stride * size);
    for (let y = 0; y < size; y++) {
        const [r, g, b] = hsl((hue + (y / size) * 50) % 360, 0.7, 0.62 - 0.3 * (y / size));
        const o = y * stride;
        for (let x = 0; x < size; x++) { raw[o + 1 + x * 3] = r; raw[o + 2 + x * 3] = g; raw[o + 3 + x * 3] = b; }
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })), pngChunk('IEND', Buffer.alloc(0)),
    ]);
}
// A short sine tone as a valid 16-bit mono WAV. Each track gets its own pitch.
const WAV_SECONDS = 3;
function makeWav(freq, rate = 16000) {
    const n = rate * WAV_SECONDS;
    const b = Buffer.alloc(44 + n * 2);
    b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
    b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24);
    b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) {
        const env = Math.min(1, i / 800, (n - i) / 800);
        b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 0.3 * env * 32767), 44 + i * 2);
    }
    return b;
}

// ---------------------------------------------------------------------------
// Test people
// ---------------------------------------------------------------------------
const EXT = {
    ext1: { name: 'Test Producer One', email: 'producer.one.test@example.com' },
    ext2: { name: 'Test Writer Two', email: 'writer.two.test@example.com' },
    feat: { name: 'Featured Artist Test', email: null },
};

const USERS = {
    juice: {
        email: 'juicewrld.test@example.com', artist: 'Juice WRLD', first: 'Jarad', last: 'Higgins', username: 'juicewrld',
        contact: 'juicewrld.test@example.com', country: 'US', nationality: 'American',
        roles: ['songwriter', 'performer', 'composer'], ipi: '99900000001', publisher: 'Test Publishing Co.',
        prefs: { analytics_opt_in: true, play_counts_opt_in: false, notify_disputes: true, notify_approvals: true },
        hue: 265,
        links: [
            { service: 'spotify', label: 'Spotify', kind: 'streaming', url: 'https://open.spotify.com/search/Juice%20WRLD' },
            { service: 'apple_music', label: 'Apple Music', kind: 'streaming', url: 'https://music.apple.com/us/search?term=Juice%20WRLD' },
            { service: 'instagram', label: 'Instagram', kind: 'social', url: 'https://www.instagram.com/juicewrld.test' },
            { service: 'other', label: 'Official site (test)', kind: 'other', url: 'https://example.com/juicewrld-test' },
        ],
        societies: [
            { body_name: 'Songtrust', country: 'INT', status: 'registered', registered_on: '2024-03-01', member_ref: 'TEST-JW-0001' },
            { body_name: 'Performing and Audio-Visual Rights Society of Kenya', country: 'KE', status: 'applied' },
            { body_name: 'Copyright Society of Tanzania', country: 'TZ', status: 'planned' },
        ],
        glossary: [['isrc', 'understood'], ['upc', 'understood'], ['metadata', 'understood'], ['ipi', 'learning'], ['split-sheet', 'learning']],
    },
    laroi: {
        email: 'kidlaroi.test@example.com', artist: 'The Kid LAROI', first: 'Charlton', last: 'Howard', username: 'thekidlaroi',
        contact: 'kidlaroi.test@example.com', country: 'US', nationality: null,
        roles: ['songwriter', 'performer'], ipi: '99900000002', publisher: null,
        prefs: { analytics_opt_in: false, play_counts_opt_in: true, notify_disputes: false, notify_approvals: true },
        hue: 20,
        links: [
            { service: 'spotify', label: 'Spotify', kind: 'streaming', url: 'https://open.spotify.com/search/The%20Kid%20LAROI' },
            { service: 'youtube', label: 'YouTube', kind: 'streaming', url: 'https://www.youtube.com/results?search_query=The+Kid+LAROI' },
            { service: 'tiktok', label: 'TikTok', kind: 'social', url: 'https://www.tiktok.com/@kidlaroi.test' },
        ],
        societies: [
            { body_name: 'Uganda Performing Right Society', country: 'UG', status: 'registered', registered_on: '2025-06-15', member_ref: 'TEST-KL-0002' },
            { body_name: 'Downtown Music Publishing Africa', country: 'INT', status: 'planned' },
            { body_name: 'Music Copyright Society of Kenya', country: 'KE', status: 'applied' },
        ],
        glossary: [['p-line', 'understood'], ['c-line', 'understood'], ['cover-license', 'learning'], ['sample-clearance', 'learning']],
    },
};

// ---------------------------------------------------------------------------
// Releases. state: 'released' | 'ready' | 'draft'.   date: ISO string or day offset from today.
// Credits: who = self | other | ext1 | ext2 | feat.  notice = confirmed (default) | pending | disputed | none
// ---------------------------------------------------------------------------
const REAL = true;
const links = (...stores) => stores.map(([store, url]) => ({ store, url }));
const SP = (q) => ['Spotify', `https://open.spotify.com/search/${encodeURIComponent(q)}`];
const AM = (q) => ['Apple Music', `https://music.apple.com/us/search?term=${encodeURIComponent(q)}`];
const AMK = (q) => ['Audiomack', `https://audiomack.com/search?q=${encodeURIComponent(q)}`];
const YM = (q) => ['YouTube Music', `https://music.youtube.com/search?q=${encodeURIComponent(q)}`];
const DZ = (q) => ['Deezer', `https://www.deezer.com/search/${encodeURIComponent(q)}`];

const C = (who, role, pct, extra = {}) => ({ who, role, pct, ...extra });

const RELEASES = {
    juice: [
        // ---- Released x2 ---------------------------------------------------
        {
            title: 'Goodbye & Good Riddance', type: 'album', state: 'released', date: '2018-05-23', genre: 'Hip-hop / Rap',
            upc: '602567787136', realUpc: REAL, label: 'Test Label Co.', lang: 'en', art: true,
            links: links(SP('Goodbye & Good Riddance'), AM('Goodbye & Good Riddance')),
            tracks: [
                { title: 'Lucid Dreams', isrc: 'USUG11800685', realIsrc: REAL, explicit: 'explicit', origin: 'sample', genre: 'Hip-hop / Rap',
                  credits: [C('self', 'songwriter', 70, { ipi: '99900000001', ws: 'joined', selfPub: true }), C('ext1', 'producer', 30)] },
                { title: 'All Girls Are the Same', isrc: 'auto', explicit: 'explicit', credits: [C('self', 'songwriter', 100)] },
                { title: 'Lean Wit Me', isrc: 'auto', explicit: 'explicit', iswc: 'T-999.000.001-1',
                  credits: [C('self', 'songwriter', 75), C('ext2', 'lyricist', 25)] },
            ],
        },
        {
            title: 'Lucid Dreams (Remix)', type: 'single', state: 'released', date: '2021-05-28', genre: 'Hip-hop / Rap',
            upc: 'auto', label: 'Test Label Co.', lang: 'en', art: true, links: links(SP('Lucid Dreams Remix'), AMK('Lucid Dreams Remix')),
            tracks: [
                { title: 'Lucid Dreams (Remix)', version: 'Remix', isrc: 'USUG12100801', realIsrc: REAL, explicit: 'explicit', origin: 'sample',
                  credits: [C('self', 'songwriter', 100), C('feat', 'performer', 0, { featured: true })] },
            ],
        },
        // ---- Yet to release x2 ---------------------------------------------
        {
            title: 'Go', type: 'single', state: 'ready', date: 21, genre: 'Hip-hop / Rap', upc: 'auto', label: 'Test Label Co.', lang: 'en', art: true,
            artist: 'Juice WRLD & The Kid LAROI',
            tracks: [{ title: 'Go', isrc: 'auto', explicit: 'explicit', credits: [C('self', 'songwriter', 50), C('other', 'songwriter', 50)] }],
        },
        {
            title: 'Fighting Demons (Test EP)', type: 'ep', state: 'ready', date: -10, genre: 'Hip-hop / Rap', upc: 'auto', label: 'Test Label Co.', lang: 'en', art: true,
            tracks: [
                { title: 'Righteous', isrc: 'auto', explicit: 'explicit', credits: [C('self', 'songwriter', 100)] },
                { title: 'Already Dead', isrc: 'auto', explicit: 'explicit', credits: [C('self', 'songwriter', 80), C('other', 'performer', 20)] },
            ],
        },
        // ---- Drafts x2 -------------------------------------------------------
        {
            title: 'The Party Never Ends (draft - incomplete)', type: 'album', state: 'draft', date: null, genre: 'Hip-hop / Rap', upc: null, art: false,
            tracks: [
                { title: 'Intro', artist: 'Juice Wrld', audio: false, credits: [C('self', 'songwriter', 100)] },   // spelling clash -> warning
                { title: 'Interlude', audio: false, credits: [C('self', 'songwriter', 60), C('ext1', 'producer', 40, { notice: 'none' })] },
            ],
        },
        {
            title: 'Wishing Well (draft - ready to mark)', type: 'single', state: 'draft', date: 45, genre: 'Hip-hop / Rap', upc: 'auto', label: 'Test Label Co.', lang: 'en', art: true,
            tracks: [{ title: 'Wishing Well', isrc: 'auto', explicit: 'explicit', credits: [C('self', 'songwriter', 80), C('ext1', 'producer', 20)] }],
        },
        // ---- Awaiting approval x2 (drafts with open notices) -----------------
        {
            title: 'Bandit (awaiting - pending notice)', type: 'single', state: 'draft', date: 60, genre: 'Hip-hop / Rap', upc: 'auto', art: true,
            tracks: [{ title: 'Bandit', isrc: 'auto', explicit: 'explicit', credits: [C('self', 'songwriter', 60), C('ext1', 'songwriter', 40, { notice: 'pending' })] }],
        },
        {
            title: 'Robbery (awaiting - disputed notice)', type: 'single', state: 'draft', date: 75, genre: 'Hip-hop / Rap', upc: 'auto', art: true,
            tracks: [{ title: 'Robbery', isrc: 'auto', explicit: 'explicit',
                       credits: [C('self', 'songwriter', 70), C('ext2', 'songwriter', 30, { notice: 'disputed', note: 'I believe my share should be 40%.' })] }],
        },
    ],
    laroi: [
        // ---- Released x2 ---------------------------------------------------
        {
            title: 'F*CK LOVE 3: OVER YOU', type: 'album', state: 'released', date: '2021-07-23', genre: 'Pop', upc: 'auto', label: 'Test Label Co.', lang: 'en', art: true,
            links: links(SP('F*CK LOVE 3 OVER YOU'), YM('F*CK LOVE 3 OVER YOU')),
            tracks: [
                { title: 'Without You', isrc: 'auto', explicit: 'explicit', credits: [C('self', 'songwriter', 100)] },
                { title: 'So Done', isrc: 'auto', explicit: 'explicit', credits: [C('self', 'songwriter', 70), C('ext1', 'producer', 30)] },
                { title: 'Not Fair', isrc: 'auto', explicit: 'explicit', iswc: 'T-999.000.002-2', credits: [C('self', 'songwriter', 100)] },
            ],
        },
        {
            title: 'STAY', type: 'single', state: 'released', date: '2021-07-09', genre: 'Pop', upc: 'auto', label: 'Test Label Co.', lang: 'en', art: true,
            links: links(SP('STAY Kid LAROI'), AM('STAY Kid LAROI'), DZ('STAY Kid LAROI')),
            tracks: [{ title: 'STAY', isrc: 'auto', explicit: 'explicit', credits: [C('self', 'songwriter', 100), C('feat', 'performer', 0, { featured: true })] }],
        },
        // ---- Yet to release x2 ---------------------------------------------
        {
            title: 'Reminds Me of You', type: 'single', state: 'ready', date: 21, genre: 'Pop', upc: 'auto', label: 'Test Label Co.', lang: 'en', art: true,
            artist: 'The Kid LAROI & Juice WRLD',
            tracks: [{ title: 'Reminds Me of You', isrc: 'auto', explicit: 'explicit', origin: 'cover',
                       credits: [C('self', 'songwriter', 40), C('other', 'songwriter', 40), C('ext2', 'songwriter', 20)] }],
        },
        {
            title: 'THE FIRST TIME (Test EP)', type: 'ep', state: 'ready', date: -12, genre: 'Pop', upc: 'auto', label: 'Test Label Co.', lang: 'en', art: true,
            tracks: [
                { title: 'Love Again', isrc: 'auto', explicit: 'not_explicit', credits: [C('self', 'songwriter', 100)] },
                { title: 'Where Does Your Spirit Go?', isrc: 'auto', explicit: 'not_explicit', credits: [C('self', 'songwriter', 75), C('other', 'songwriter', 25)] },
            ],
        },
        // ---- Drafts x2 -------------------------------------------------------
        {
            title: 'Thousand Miles (draft - incomplete)', type: 'single', state: 'draft', date: null, genre: 'Pop', upc: null, art: false,
            tracks: [{ title: 'Thousand Miles', artist: 'The Kid Laroi', audio: false, credits: [C('self', 'songwriter', 100)] }],  // spelling clash
        },
        {
            title: 'Over You (draft - ready to mark)', type: 'single', state: 'draft', date: 40, genre: 'Pop', upc: 'auto', label: 'Test Label Co.', lang: 'en', art: true,
            tracks: [{ title: 'Over You', isrc: 'auto', explicit: 'not_explicit', credits: [C('self', 'songwriter', 80), C('ext1', 'producer', 20)] }],
        },
        // ---- Awaiting approval x2 --------------------------------------------
        {
            title: 'Need You Most (awaiting - pending notice)', type: 'single', state: 'draft', date: 55, genre: 'Pop', upc: 'auto', art: true,
            tracks: [{ title: 'Need You Most', isrc: 'auto', explicit: 'explicit', credits: [C('self', 'songwriter', 65), C('ext2', 'songwriter', 35, { notice: 'pending' })] }],
        },
        {
            title: 'Still Chose You (awaiting - disputed notice)', type: 'single', state: 'draft', date: 70, genre: 'Pop', upc: 'auto', art: true,
            tracks: [{ title: 'Still Chose You', isrc: 'auto', explicit: 'explicit',
                       credits: [C('self', 'songwriter', 60), C('ext1', 'producer', 40, { notice: 'disputed', note: 'We agreed 50/50 on the session sheet.' })] }],
        },
    ],
};

// ---------------------------------------------------------------------------
// Database work
// ---------------------------------------------------------------------------
const dayStr = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const ago = (days) => new Date(Date.now() - days * 86400000);

async function resetTestData(client) {
    const emails = Object.values(USERS).map((u) => u.email);
    const { rows } = await client.query('SELECT id FROM users WHERE email = ANY($1)', [emails]);
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const keys = (await client.query('SELECT storage_key FROM audio_files WHERE owner_id = ANY($1)', [ids])).rows.map((r) => r.storage_key);
    await client.query('DELETE FROM collaborators WHERE user_id = ANY($1)', [ids]);
    await client.query('DELETE FROM releases WHERE owner_id = ANY($1)', [ids]);   // tracks, notices, media, links cascade
    await client.query('DELETE FROM users WHERE id = ANY($1)', [ids]);            // links, societies, glossary, tokens cascade
    return keys;
}

async function createUser(client, u, hash) {
    const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, artist_name, contact_info, first_name, last_name, username,
                            email_verified_at, country, nationality, roles, ipi, publisher_name, preferences,
                            terms_accepted_at, terms_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7, now(), $8,$9,$10,$11,$12,$13, now(), $14) RETURNING id`,
        [u.email, hash, u.artist, u.contact, u.first, u.last, u.username, u.country, u.nationality, u.roles, u.ipi, u.publisher,
         JSON.stringify(u.prefs), TERMS_VERSION]);
    const id = rows[0].id;
    for (const l of u.links) {
        await client.query('INSERT INTO artist_links (user_id, service, label, kind, url) VALUES ($1,$2,$3,$4,$5)', [id, l.service, l.label, l.kind, l.url]);
    }
    for (const s of u.societies) {
        await client.query(
            'INSERT INTO user_societies (user_id, body_name, country, status, registered_on, member_ref) VALUES ($1,$2,$3,$4,$5,$6)',
            [id, s.body_name, s.country, s.status, s.registered_on || null, s.member_ref || null]);
    }
    for (const [term, status] of u.glossary) {
        await client.query('INSERT INTO glossary_progress (user_id, term_id, status) VALUES ($1,$2,$3)', [id, term, status]);
    }
    const avatar = makePng(256, u.hue);
    await client.query(
        `INSERT INTO media (kind, owner_id, mime_type, width, height, size_bytes, data) VALUES ('avatar',$1,'image/png',256,256,$2,$3)`,
        [id, avatar.length, avatar]);
    return { ...u, id, fullName: `${u.first} ${u.last}` };
}

async function createRelease(client, owner, other, spec, ctx) {
    const idx = ctx.counter++;
    const isDraft = spec.state === 'draft';
    const released = spec.state === 'released';
    const date = typeof spec.date === 'number' ? dayStr(spec.date) : spec.date;
    const upc = spec.upc === 'auto' ? fakeUpc(idx) : spec.upc;
    const readyAt = isDraft ? null : ago(30);
    const releasedAt = released ? ago(14) : null;

    const { rows } = await client.query(
        `INSERT INTO releases (owner_id, title, release_type, album_artist, genre, release_date, upc, p_line, c_line,
                               label_name, language, status, ready_at, released_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [owner.id, spec.title, spec.type, spec.artist || owner.artist, spec.genre || null, date || null, upc || null,
         date ? `℗ ${date.slice(0, 4)} Test Label Co.` : null, date ? `© ${date.slice(0, 4)} Test Label Co.` : null,
         spec.label || null, spec.lang || null, isDraft ? 'draft' : 'ready', readyAt, releasedAt]);
    const releaseId = rows[0].id;

    if (spec.art) {
        const png = makePng(1400, (owner.hue + idx * 37) % 360);
        await client.query(
            `INSERT INTO media (kind, owner_id, release_id, mime_type, width, height, size_bytes, data) VALUES ('artwork',$1,$2,'image/png',1400,1400,$3,$4)`,
            [owner.id, releaseId, png.length, png]);
    }
    for (const l of spec.links || []) {
        await client.query('INSERT INTO release_links (release_id, store, url, created_at) VALUES ($1,$2,$3,clock_timestamp())', [releaseId, l.store, l.url]);
    }

    const people = {
        self: { name: owner.fullName, email: null, user: null },
        other: { name: other.fullName, email: other.email, user: other.id },
        ext1: { name: EXT.ext1.name, email: EXT.ext1.email, user: null },
        ext2: { name: EXT.ext2.name, email: EXT.ext2.email, user: null },
        feat: { name: EXT.feat.name, email: null, user: null },
    };

    let n = 0;
    for (const t of spec.tracks) {
        n++;
        const trackIdx = ctx.trackCounter++;
        const isrc = t.isrc === 'auto' ? fakeIsrc(owner === ctx.first ? 'J' : 'K', trackIdx) : t.isrc || null;
        const year = (date || dayStr(0)).slice(0, 4);
        const hasAudio = t.audio !== false;
        const { rows: tr } = await client.query(
            `INSERT INTO tracks (release_id, track_number, title, artist_name, genre, isrc, iswc, duration_seconds, explicit,
                                 composition_copyright_year, composition_copyright, recording_copyright_year, recording_copyright,
                                 origin, version_title, language)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
            [releaseId, n, t.title, t.artist || spec.artist || owner.artist, t.genre || spec.genre || null, isrc, t.iswc || null,
             hasAudio ? WAV_SECONDS : null, t.explicit || null,
             hasAudio ? Number(year) : null, hasAudio ? `${owner.artist} / Test Publishing Co.` : null,
             hasAudio ? Number(year) : null, hasAudio ? 'Test Label Co.' : null,
             t.origin || 'original', t.version || null, spec.lang || null]);
        const trackId = tr[0].id;

        if (hasAudio) {
            const wav = makeWav(220 + (trackIdx % 12) * 40);
            const key = storage.newKey('audio', 'wav');
            await storage.put(key, wav);
            ctx.storedKeys.push(key);
            await client.query('INSERT INTO audio_files (track_id, owner_id, storage_key, mime_type, size_bytes) VALUES ($1,$2,$3,$4,$5)',
                [trackId, owner.id, key, 'audio/wav', wav.length]);
            await client.query(
                `INSERT INTO audio_specs (track_id, file_name, format, bitrate_kbps, sample_rate_hz, channels, size_bytes) VALUES ($1,$2,'wav',256,16000,1,$3)`,
                [trackId, `${t.title.replace(/[^\w ()-]/g, '')}.wav`, wav.length]);
        }

        for (const c of t.credits) {
            const p = people[c.who];
            await client.query(
                `INSERT INTO collaborators (track_id, user_id, invited_email, legal_name, role, ownership_percent, ipi, writer_status,
                                            publisher_name, is_self_published, is_featured)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                [trackId, p.user, p.email, p.name, c.role, c.pct, c.ipi || null, c.ws || null, null, !!c.selfPub, !!c.featured]);

            if (!p.email || c.notice === 'none') continue;
            const status = c.notice || 'confirmed';
            const { raw, hash } = newToken();
            const answered = status === 'confirmed' || status === 'disputed';
            await client.query(
                `INSERT INTO collaborator_notices (track_id, email_hash, email, co_writer_name, role, share_percent, token_hash, notice_version,
                                                   status, note, sent_by, sent_at, expires_at, responded_at, consent_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
                [trackId, emailHash(p.email), p.email, p.name, c.role, c.pct, hash, NOTICE_VERSION, status,
                 status === 'disputed' ? c.note || null : null, owner.id, ago(20), new Date(Date.now() + 14 * 86400000),
                 answered ? ago(19) : null, status === 'confirmed' ? ago(19) : null]);
            if (status === 'pending') ctx.tokens.push({ release: spec.title, owner: owner.artist, who: p.name, link: `${APP_URL}/notice/${raw}` });
            if (status === 'disputed') ctx.tokens.push({ release: spec.title, owner: owner.artist, who: p.name, link: `${APP_URL}/notice/${raw}`, disputed: true });
        }
    }
    return releaseId;
}

async function main() {
    assertSafe();
    const client = await pool.connect();
    const ctx = { counter: 1, trackCounter: 1, storedKeys: [], tokens: [], first: null };
    let oldKeys = [];
    try {
        const hash = await bcrypt.hash(PASSWORD, 10);
        await client.query('BEGIN');
        oldKeys = await resetTestData(client);

        const juice = await createUser(client, USERS.juice, hash);
        const laroi = await createUser(client, USERS.laroi, hash);
        ctx.first = juice;

        for (const spec of RELEASES.juice) await createRelease(client, juice, laroi, spec, ctx);
        for (const spec of RELEASES.laroi) await createRelease(client, laroi, juice, spec, ctx);

        await client.query('COMMIT');
        await Promise.all(oldKeys.map((k) => storage.delete(k)));

        console.log('\nTest data created.\n');
        console.log('  Juice WRLD     ', USERS.juice.email, '/', PASSWORD);
        console.log('  The Kid LAROI  ', USERS.laroi.email, '/', PASSWORD);
        console.log('\nCo-writer links (open while logged out to test the public notice page):');
        for (const t of ctx.tokens) console.log(`  [${t.disputed ? 'disputed' : 'pending '}] ${t.owner} - ${t.release} -> ${t.who}\n      ${t.link}`);
        console.log('\nNote: a disputed notice link is already answered; use it only to see how the page treats it. Pending ones are single-use per answer.\n');
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        await Promise.all(ctx.storedKeys.map((k) => storage.delete(k)));
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
