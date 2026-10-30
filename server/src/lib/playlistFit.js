// Turns audio features into "playlist projections": how closely a song's sound matches the typical sound of a kind of playlist.
//
// This is a rule of thumb, not a forecast. It does not know about real playlists, listeners or streams. Each playlist type
// lists the feature ranges that usually describe it. A song scores 100 for a feature inside the range, and less the further
// outside it falls. A playlist's fit is the weighted average of its rules.

const FEATURE_KEYS = ['acousticness', 'danceability', 'energy', 'instrumentalness', 'liveness', 'loudness', 'speechiness', 'tempo', 'valence'];
const UNIT = ['acousticness', 'danceability', 'energy', 'instrumentalness', 'liveness', 'speechiness', 'valence'];
const RANGES = { ...Object.fromEntries(UNIT.map((k) => [k, [0, 1]])), loudness: [-60, 5], tempo: [0, 300] };

// Keeps only the nine numbers, in their valid ranges. Anything else the service sends back is dropped.
// Returns null when the three core measures (energy, danceability, valence) are not all there, because the fits would be guesses.
function cleanFeatures(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const out = {};
    for (const k of FEATURE_KEYS) {
        const v = Number(raw[k]);
        if (raw[k] === null || raw[k] === undefined || raw[k] === '' || !Number.isFinite(v)) continue;
        const [lo, hi] = RANGES[k];
        out[k] = Math.min(hi, Math.max(lo, v));
    }
    return ['energy', 'danceability', 'valence'].every((k) => k in out) ? out : null;
}

// A rule: feature, the range that fits (lo to hi), how far outside it the score falls to zero (soft), its weight, and the
// phrase used to explain the fit when the song matches it well.
const rule = (feature, lo, hi, soft, weight, phrase) => ({ feature, lo, hi, soft, weight, phrase });

const PLAYLISTS = [
    { id: 'workout', label: 'Workout and gym', rules: [
        rule('energy', 0.7, 1, 0.35, 3, 'high energy'), rule('tempo', 120, 170, 35, 2, 'a driving tempo'),
        rule('danceability', 0.5, 1, 0.3, 1, 'a steady beat'), rule('acousticness', 0, 0.4, 0.4, 1, 'a produced sound')] },
    { id: 'party', label: 'Party and dance', rules: [
        rule('danceability', 0.7, 1, 0.3, 3, 'very danceable'), rule('energy', 0.6, 1, 0.3, 2, 'high energy'),
        rule('valence', 0.5, 1, 0.4, 1, 'an upbeat mood'), rule('tempo', 95, 135, 30, 1, 'a dance tempo')] },
    { id: 'feelgood', label: 'Feel-good and summer', rules: [
        rule('valence', 0.6, 1, 0.35, 3, 'an upbeat mood'), rule('energy', 0.5, 0.9, 0.3, 2, 'good energy'),
        rule('danceability', 0.55, 1, 0.3, 1, 'an easy groove')] },
    { id: 'chill', label: 'Chill and relax', rules: [
        rule('energy', 0, 0.5, 0.3, 3, 'low energy'), rule('tempo', 60, 110, 30, 1, 'a relaxed tempo'),
        rule('acousticness', 0.2, 1, 0.4, 1, 'a soft sound'), rule('loudness', -30, -8, 8, 1, 'a gentle volume')] },
    { id: 'focus', label: 'Focus and study', rules: [
        rule('instrumentalness', 0.5, 1, 0.4, 3, 'mostly instrumental'), rule('energy', 0.1, 0.6, 0.3, 2, 'calm energy'),
        rule('speechiness', 0, 0.1, 0.15, 1, 'few spoken words')] },
    { id: 'latenight', label: 'Late night and moody', rules: [
        rule('valence', 0, 0.45, 0.3, 3, 'a darker mood'), rule('energy', 0.2, 0.65, 0.3, 2, 'restrained energy'),
        rule('tempo', 60, 115, 30, 1, 'a slower tempo')] },
    { id: 'acoustic', label: 'Acoustic and unplugged', rules: [
        rule('acousticness', 0.6, 1, 0.4, 3, 'an acoustic sound'), rule('energy', 0, 0.6, 0.3, 1, 'gentle energy')] },
    { id: 'roadtrip', label: 'Road trip and sing-along', rules: [
        rule('valence', 0.45, 0.9, 0.3, 2, 'a positive mood'), rule('energy', 0.55, 0.9, 0.3, 2, 'good energy'),
        rule('tempo', 90, 140, 30, 1, 'a mid tempo'), rule('speechiness', 0, 0.2, 0.2, 1, 'sung rather than spoken'),
        rule('instrumentalness', 0, 0.2, 0.3, 1, 'clear vocals')] },
    { id: 'rap', label: 'Rap and spoken word', rules: [
        rule('speechiness', 0.25, 0.7, 0.2, 3, 'lots of spoken words'), rule('energy', 0.5, 0.95, 0.3, 1, 'strong energy')] },
];

// 1 inside the range, falling in a straight line to 0 at `soft` outside it.
const closeness = (x, { lo, hi, soft }) => (x >= lo && x <= hi ? 1 : Math.max(0, 1 - (x < lo ? lo - x : x - hi) / soft));

const band = (fit) => (fit >= 75 ? 'Strong fit' : fit >= 55 ? 'Good fit' : fit >= 35 ? 'Possible fit' : 'Weak fit');

// Every playlist type with its fit (0 to 100), best first. `why` names up to two things that match well.
function projections(features) {
    const f = cleanFeatures(features);
    if (!f) return [];
    return PLAYLISTS.map((p) => {
        let sum = 0, weights = 0;
        const hits = [];
        for (const r of p.rules) {
            if (!(r.feature in f)) continue;
            const c = closeness(f[r.feature], r);
            sum += c * r.weight; weights += r.weight;
            if (c >= 0.8) hits.push({ phrase: r.phrase, score: c * r.weight });
        }
        const fit = weights ? Math.round((sum / weights) * 100) : 0;
        const why = hits.sort((a, b) => b.score - a.score).slice(0, 2).map((h) => h.phrase);
        return { id: p.id, label: p.label, fit, band: band(fit), why };
    }).sort((a, b) => b.fit - a.fit || a.label.localeCompare(b.label));
}

// A few plain words about the sound, e.g. ["High energy", "Very danceable", "Upbeat", "112 BPM"].
function describe(features) {
    const f = cleanFeatures(features);
    if (!f) return [];
    const out = [];
    out.push(f.energy >= 0.7 ? 'High energy' : f.energy >= 0.4 ? 'Medium energy' : 'Low energy');
    out.push(f.danceability >= 0.7 ? 'Very danceable' : f.danceability >= 0.5 ? 'Danceable' : 'Not very danceable');
    out.push(f.valence >= 0.6 ? 'Upbeat' : f.valence >= 0.35 ? 'Balanced mood' : 'Moody');
    if (f.acousticness >= 0.6) out.push('Acoustic');
    if (f.instrumentalness >= 0.5) out.push('Mostly instrumental');
    if (f.speechiness >= 0.33) out.push('Lots of spoken words');
    if ('tempo' in f && f.tempo > 0) out.push(`${Math.round(f.tempo)} BPM`);
    return out;
}

module.exports = { FEATURE_KEYS, PLAYLISTS, cleanFeatures, projections, describe, closeness };
