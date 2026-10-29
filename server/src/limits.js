const n = (k, d) => (process.env[k] !== undefined ? Number(process.env[k]) : d);
module.exports = {
  enabled: process.env.PILOT_LIMITS !== 'off',
  maxReleasesPerUser: n('MAX_RELEASES_PER_USER', 5),  
  maxTracksPerRelease: n('MAX_TRACKS_PER_RELEASE', 10),
  maxAudioBytes: n('MAX_AUDIO_BYTES', 100 * 1024 * 1024),   // a 5-minute FLAC is about 30 MB, a WAV about 50 MB
  maxCoverBytes: n('MAX_COVER_BYTES', 25 * 1024 * 1024),   // the most the database accepts for artwork (migration 001); distributors ask for under 25 MB
  maxAvatarBytes: n('MAX_AVATAR_BYTES', 500 * 1024),
  maxUserBytes: n('MAX_USER_BYTES', 1024 * 1024 * 1024),   // room for a full 10-song release as FLAC, with its cover
  maxPlatformBytes: n('MAX_PLATFORM_BYTES', 10 * 1024 * 1024 * 1024),   // keep this below the free space on the upload disk
  maxNoticesPerDay: n('MAX_NOTICES_PER_DAY', 20),
  maxReleaseLinks: n('MAX_RELEASE_LINKS', 10),
  maxArtistLinks: n('MAX_ARTIST_LINKS', 12),
  maxSocieties: n('MAX_SOCIETIES', 10),
};