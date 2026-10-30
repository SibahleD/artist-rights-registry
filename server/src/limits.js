const n = (k, d) => (process.env[k] !== undefined ? Number(process.env[k]) : d);
const MB = 1024 * 1024;
const enabled = process.env.PILOT_LIMITS !== 'off';

// The most the database and the server will ever accept. These apply when PILOT_LIMITS=off, so removing the pilot caps
// never removes the safety net (migration 001 allows 2 MB avatars and 25 MB artwork).
const HARD_CAPS = { audio: 200 * MB, cover: 25 * MB, avatar: 2 * MB };

const maxAudioBytes = n('MAX_AUDIO_BYTES', HARD_CAPS.audio);    // a 5-minute song: FLAC ~30 MB, 16-bit WAV ~50 MB, 24-bit/96 kHz WAV ~175 MB
const maxCoverBytes = n('MAX_COVER_BYTES', HARD_CAPS.cover);    // the most the database accepts for artwork (migration 001); distributors ask for under 25 MB
const maxAvatarBytes = n('MAX_AVATAR_BYTES', HARD_CAPS.avatar); // the most the database accepts for a profile photo (migration 001); phone photos are 1-2 MB

module.exports = {
  enabled,
  maxReleasesPerUser: n('MAX_RELEASES_PER_USER', 0),   // 0 = no limit on how many releases an artist can make
  maxTracksPerRelease: n('MAX_TRACKS_PER_RELEASE', 0),   // 0 = no limit on songs per release
  maxAudioBytes,
  maxCoverBytes,
  maxAvatarBytes,
  maxUserBytes: n('MAX_USER_BYTES', 2 * 1024 * MB),   // room for a full 10-song release as WAV, with its cover
  maxPlatformBytes: n('MAX_PLATFORM_BYTES', 10 * 1024 * MB),   // keep this below the free space on the upload disk
  maxNoticesPerDay: n('MAX_NOTICES_PER_DAY', 20),
  maxReleaseLinks: n('MAX_RELEASE_LINKS', 10),
  maxArtistLinks: n('MAX_ARTIST_LINKS', 12),
  maxSocieties: n('MAX_SOCIETIES', 10),
  // The size caps in force right now. Upload code should read these, so every path agrees with what the app shows.
  effective: {
    audioBytes: enabled ? maxAudioBytes : HARD_CAPS.audio,
    coverBytes: enabled ? maxCoverBytes : HARD_CAPS.cover,
    avatarBytes: enabled ? maxAvatarBytes : HARD_CAPS.avatar,
  },
};
