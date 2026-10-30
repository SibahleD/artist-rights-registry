// Asks ReccoBeats to estimate audio features from a short audio clip. No API key is needed.
// Their limits: MP3, OGG, WAV or AIFF, up to 5 MB, and only the first 30 seconds are analysed.
// The clip is sent once and not kept here. Only the nine numbers that come back are stored.
const { cleanFeatures } = require('../lib/playlistFit');

const URL_ = process.env.RECCOBEATS_URL || 'https://api.reccobeats.com/v1/analysis/audio-features';
const MAX_CLIP_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 40000;

class FeatureError extends Error {
    constructor(message, status = 502) { super(message); this.status = status; }
}

// A real WAV file starts with RIFF....WAVE. Checked here so a wrong upload is refused before it leaves the server.
const looksLikeWav = (buf) => Buffer.isBuffer(buf) && buf.length > 44 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WAVE';

async function extractFeatures(buffer, fetchImpl = fetch) {
    if (!looksLikeWav(buffer)) throw new FeatureError('That clip is not a WAV file.', 400);
    if (buffer.length > MAX_CLIP_BYTES) throw new FeatureError('That clip is over 5 MB.', 413);

    const body = new FormData();
    body.append('audioFile', new Blob([buffer], { type: 'audio/wav' }), 'clip.wav');

    let res;
    try {
        res = await fetchImpl(URL_, { method: 'POST', body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
        throw new FeatureError('Could not reach the audio analysis service. Try again in a moment.', 503);
    }
    if (res.status === 429) {
        const wait = Number(res.headers && res.headers.get && res.headers.get('retry-after'));
        throw new FeatureError(`The audio analysis service is busy.${wait ? ` Try again in about ${wait} seconds.` : ' Try again in a minute.'}`, 503);
    }
    if (!res.ok) throw new FeatureError('The audio analysis service could not read that clip.', 502);

    const data = await res.json().catch(() => null);
    const features = cleanFeatures(data);
    if (!features) throw new FeatureError('The audio analysis service sent back something unexpected.', 502);
    return features;
}

module.exports = { extractFeatures, looksLikeWav, FeatureError, MAX_CLIP_BYTES };
