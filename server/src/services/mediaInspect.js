const { imageSize } = require('image-size');

let mm;
const loadMm = () => (mm ||= import('music-metadata'));

async function inspectAudio(buffer) {
    let meta;
    try {
        const { parseBuffer } = await loadMm();
        meta = await parseBuffer(buffer, undefined, { duration: true });
    } catch {
        return { error: 'That file could not be read as audio. Use an MP3, WAV, FLAC or AAC file.' };
    }
    const f = meta.format;
    const container = f.container || '';
    const codec = f.codec || '';
    let format, mime, ext;
    if (container === 'WAVE') { format = 'wav'; mime = 'audio/wav'; ext = 'wav'; }
    else if (container === 'FLAC') { format = 'flac'; mime = 'audio/flac'; ext = 'flac'; }
    else if (container === 'MPEG' && /Layer 3/.test(codec)) { format = 'mp3'; mime = 'audio/mpeg'; ext = 'mp3'; }
    else if (/AAC/.test(codec) && /ADTS|M4A|MPEG-4/.test(container + codec)) { format = 'aac'; mime = 'audio/aac'; ext = 'aac'; }
    else return { error: 'Only MP3, WAV, FLAC and AAC files are accepted.' };

    return {
        format, mime, ext,
        bitrateKbps: f.bitrate ? Math.round(f.bitrate / 1000) : null,
        sampleRateHz: f.sampleRate ? Math.round(f.sampleRate) : null,
        channels: f.numberOfChannels || null,
        durationSeconds: f.duration ? Math.round(f.duration) : null,
    };
}

function inspectImage(buffer) {
    let info;
    try { info = imageSize(buffer); } catch { return { error: 'That file could not be read as an image.' }; }
    const kinds = { jpg: 'image/jpeg', png: 'image/png' };
    if (!kinds[info.type] || !info.width || !info.height) return { error: 'Only JPEG and PNG images are accepted.' };
    return { mime: kinds[info.type], width: info.width, height: info.height };
}

module.exports = { inspectAudio, inspectImage };