// The services an artist can link to. Keep the ids in step with client/src/data/services.ts.
const KINDS = ['streaming', 'social', 'store', 'other'];

const SERVICES = [
    ['spotify', 'Spotify', 'streaming'],
    ['apple_music', 'Apple Music', 'streaming'],
    ['youtube', 'YouTube', 'streaming'],
    ['youtube_music', 'YouTube Music', 'streaming'],
    ['soundcloud', 'SoundCloud', 'streaming'],
    ['deezer', 'Deezer', 'streaming'],
    ['tidal', 'Tidal', 'streaming'],
    ['amazon_music', 'Amazon Music', 'streaming'],
    ['boomplay', 'Boomplay', 'streaming'],
    ['audiomack', 'Audiomack', 'streaming'],
    ['instagram', 'Instagram', 'social'],
    ['tiktok', 'TikTok', 'social'],
    ['x', 'X (Twitter)', 'social'],
    ['facebook', 'Facebook', 'social'],
    ['bandcamp', 'Bandcamp', 'store'],
    ['beatport', 'Beatport', 'store'],
    ['itunes', 'iTunes Store', 'store'],
];
const BY_ID = Object.fromEntries(SERVICES.map(([id, label, kind]) => [id, { id, label, kind }]));

const LABEL_MAX = 60;
const URL_MAX = 500;

// Validates one artist link. `existing` is the stored row when updating: fields missing from `body` keep their value.
function parseLinkInput(body, existing = null) {
    const b = body && typeof body === 'object' ? body : {};
    const pick = (k) => (k in b ? b[k] : existing?.[k]);

    const service = pick('service');
    if (typeof service !== 'string' || (service !== 'other' && !BY_ID[service])) {
        return { error: 'Choose a service from the list.' };
    }

    let label;
    let kind;
    if (service === 'other') {
        const raw = pick('label');
        label = typeof raw === 'string' ? raw.trim() : '';
        if (!label || label.length > LABEL_MAX) return { error: `Enter a name for this link (up to ${LABEL_MAX} characters).` };
        kind = 'kind' in b ? b.kind : existing?.kind ?? 'other';
        if (!KINDS.includes(kind)) return { error: `Kind must be one of: ${KINDS.join(', ')}.` };
    } else {
        ({ label, kind } = BY_ID[service]);
    }

    const rawUrl = pick('url');
    const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    let ok = url.length > 0 && url.length <= URL_MAX && /^https:\/\//i.test(url);
    if (ok) {
        try { ok = new URL(url).protocol === 'https:'; } catch { ok = false; }
    }
    if (!ok) return { error: `Enter the full web address, starting with https:// (up to ${URL_MAX} characters).` };

    return { link: { service, label, kind, url } };
}

module.exports = { SERVICES, BY_ID, KINDS, parseLinkInput };
