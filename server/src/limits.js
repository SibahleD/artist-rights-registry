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

const maxAudioBytes = n('MAX_AUDIO_BYTES', HARD_CAPS.audio);
const maxCoverBytes = n('MAX_COVER_BYTES', HARD_CAPS.cover);
const maxAvatarBytes = n('MAX_AVATAR_BYTES', HARD_CAPS.avatar);

module.exports = {
  enabled,
  maxReleasesPerUser: n('MAX_RELEASES_PER_USER', 0),   // 0 = no limit
  maxTracksPerRelease: n('MAX_TRACKS_PER_RELEASE', 0), 
  maxAudioBytes,
  maxCoverBytes,
  maxAvatarBytes,
  maxUserBytes: n('MAX_USER_BYTES', 2 * 1024 * MB),
  maxPlatformBytes: n('MAX_PLATFORM_BYTES', 10 * 1024 * MB), 
  maxNoticesPerDay: n('MAX_NOTICES_PER_DAY', 20),
  maxReleaseLinks: n('MAX_RELEASE_LINKS', 10),
  maxArtistLinks: n('MAX_ARTIST_LINKS', 12),
  maxSocieties: n('MAX_SOCIETIES', 10),
  effective: {
    audioBytes: enabled ? maxAudioBytes : HARD_CAPS.audio,
    coverBytes: enabled ? maxCoverBytes : HARD_CAPS.cover,
    avatarBytes: enabled ? maxAvatarBytes : HARD_CAPS.avatar,
  },
};
