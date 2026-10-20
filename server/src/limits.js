const n = (k, d) => (process.env[k] !== undefined ? Number(process.env[k]) : d);
module.exports = {
  enabled: process.env.PILOT_LIMITS !== 'off',
  maxReleasesPerUser: n('MAX_RELEASES_PER_USER', 5),  
  maxTracksPerRelease: n('MAX_TRACKS_PER_RELEASE', 10),
  maxAudioBytes: n('MAX_AUDIO_BYTES', 20 * 1024 * 1024),
  maxCoverBytes: n('MAX_COVER_BYTES', 10 * 1024 * 1024),
  maxAvatarBytes: n('MAX_AVATAR_BYTES', 500 * 1024),
  maxUserBytes: n('MAX_USER_BYTES', 45 * 1024 * 1024),
  maxPlatformBytes: n('MAX_PLATFORM_BYTES', 900 * 1024 * 1024),
  maxNoticesPerDay: n('MAX_NOTICES_PER_DAY', 20),
  maxReleaseLinks: n('MAX_RELEASE_LINKS', 10),
};