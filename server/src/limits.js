const n = (k, d) => (process.env[k] !== undefined ? Number(process.env[k]) : d);
const MB = 1024 * 1024;
const enabled = process.env.PILOT_LIMITS !== 'off';

// The most the database and the server will ever accept. These apply when PILOT_LIMITS=off, so removing the pilot caps
// never removes the safety net.
// Images are sent through the Netlify Function, which rejects request bodies over about 6 MB (about 4.5 MB of real file once
// base64-encoded), so 4 MB is the practical ceiling. Migration 023 lets the database hold 4 MB avatars.
// Audio does not go through the function: the browser uploads it straight to the Supabase bucket. 50 MB fits a 5-minute FLAC
// (~30 MB) and matches Supabase's default per-file limit; raise MAX_AUDIO_BYTES and the bucket's own limit together.
const HARD_CAPS = { audio: 50 * MB, cover: 4 * MB, avatar: 4 * MB };

const maxAudioBytes = n('MAX_AUDIO_BYTES', HARD_CAPS.audio);    // MP3 and FLAC only: a 5-minute song is ~5-12 MB as MP3 and ~30 MB as FLAC
const maxCoverBytes = n('MAX_COVER_BYTES', HARD_CAPS.cover);    // limited by the Netlify Function request size, not the database
const maxAvatarBytes = n('MAX_AVATAR_BYTES', HARD_CAPS.avatar); // limited by the Netlify Function request size (and migration 023)

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
