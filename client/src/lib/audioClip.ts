// Cuts a 30-second WAV clip out of a song, in the browser, so only a short clip (about 2.6 MB) is ever sent for analysis.
// ReccoBeats reads the first 30 seconds of what it is given, MP3 / OGG / WAV / AIFF, up to 5 MB. A mono 16-bit WAV at
// 44.1 kHz is 30 x 44,100 x 2 bytes, about 2.6 MB, so it always fits.

export const CLIP_SECONDS = 30
const RATE = 44100

/** Where the clip starts. The preview start if the artist set one, otherwise the middle of the song (the intro is rarely typical). */
export function clipStart(durationSeconds: number | null | undefined, preferred: number | null | undefined): number {
  if (!durationSeconds || durationSeconds <= CLIP_SECONDS) return 0
  const latest = Math.max(0, Math.floor(durationSeconds) - CLIP_SECONDS)
  if (preferred !== null && preferred !== undefined && preferred >= 0) return Math.min(Math.floor(preferred), latest)
  return Math.floor(latest / 2)
}

/** 16-bit PCM mono WAV. */
export function encodeWav(samples: Float32Array, rate: number): Blob {
  const data = new DataView(new ArrayBuffer(44 + samples.length * 2))
  const text = (at: number, s: string) => { for (let i = 0; i < s.length; i++) data.setUint8(at + i, s.charCodeAt(i)) }
  text(0, 'RIFF'); data.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE'); text(12, 'fmt ')
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 1, true)
  data.setUint32(24, rate, true); data.setUint32(28, rate * 2, true); data.setUint16(32, 2, true); data.setUint16(34, 16, true)
  text(36, 'data'); data.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]))
    data.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true)
  }
  return new Blob([data], { type: 'audio/wav' })
}

/** Averages every channel into one. */
export function toMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0]
  const out = new Float32Array(channels[0].length)
  for (const c of channels) for (let i = 0; i < out.length; i++) out[i] += c[i] / channels.length
  return out
}

/** Decodes the song (the browser resamples it to 44.1 kHz) and returns a 30-second mono WAV and where in the song it starts. */
export async function makeClip(song: Blob, preferredStart: number | null | undefined): Promise<{ clip: Blob; start: number }> {
  const ctx = new AudioContext({ sampleRate: RATE })
  try {
    let decoded: AudioBuffer
    try { decoded = await ctx.decodeAudioData(await song.arrayBuffer()) }
    catch { throw new Error('This browser could not read that audio file. Try an MP3 or WAV version of the song.') }
    const start = clipStart(decoded.duration, preferredStart)
    const mono = toMono(Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i)))
    const from = Math.min(mono.length, Math.round(start * decoded.sampleRate))
    const clip = mono.slice(from, from + CLIP_SECONDS * decoded.sampleRate)
    if (clip.length < decoded.sampleRate * 3) throw new Error('That song is too short to analyse.')
    return { clip: encodeWav(clip, decoded.sampleRate), start }
  } finally { void ctx.close() }
}
