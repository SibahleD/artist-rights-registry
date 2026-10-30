const n = (k, d) => (process.env[k] !== undefined ? Number(process.env[k]) : d);
module.exports = {
  enabled: process.env.PILOT_LIMITS !== 'off',
  maxReleasesPerUser: n('MAX_RELEASES_PER_USER', 0),   // 0 = no limit on how many releases an artist can make  
  maxTracksPerRelease: n('MAX_TRACKS_PER_RELEASE', 0),   // 0 = no limit on songs per release
  maxAudioBytes: n('MAX_AUDIO_BYTES', 200 * 1024 * 1024),   // a 5-minute song: FLAC ~30 MB, 16-bit WAV ~50 MB, 24-bit/96 kHz WAV ~175 MB
  maxCoverBytes: n('MAX_COVER_BYTES', 25 * 1024 * 1024),   // the most the database accepts for artwork (migration 001); distributors ask for under 25 MB
  maxAvatarBytes: n('MAX_AVATAR_BYTES', 2 * 1024 * 1024),   // the most the database accepts for a profile photo (migration 001); phone photos are 1-2 MB
  maxUserBytes: n('MAX_USER_BYTES', 2 * 1024 * 1024 * 1024),   // room for a full 10-song release as WAV, with its cover
  maxPlatformBytes: n('MAX_PLATFORM_BYTES', 10 * 1024 * 1024 * 1024),   // keep this below the free space on the upload disk
  maxNoticesPerDay: n('MAX_NOTICES_PER_DAY', 20),
  maxReleaseLinks: n('MAX_RELEASE_LINKS', 10),
  maxArtistLinks: n('MAX_ARTIST_LINKS', 12),
  maxSocieties: n('MAX_SOCIETIES', 10),
};