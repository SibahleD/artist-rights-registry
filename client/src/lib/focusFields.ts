// Which part of the edit form each readiness check points at. The key is the check id from the server.
// Checks that open another page (the splits page) get no focus parameter.
const FIELD_FOR_CHECK: Record<string, string> = {
  'release-date': 'release-date',
  'release-artwork': 'cover-art',
  'no-tracks': 'song-info',
  'track-audio': 'track-audio',
  'track-splits': 'track-splits',
  'dist-sales-start': 'sales-start',
  'dist-sales-start-soon': 'sales-start',
  'dist-sales-start-far': 'sales-start',
  'dist-originally-released': 'originally-released',
  'dist-date-order': 'originally-released',
  'dist-preorder-order': 'preorder',
  'dist-preorder-far': 'preorder',
  'dist-primary-artists': 'primary-artists',
  'dist-art-size': 'cover-art',
  'dist-art-bytes': 'cover-art',
  'dist-audio-spec': 'track-audio',
  'dist-track-lyrics': 'track-lyrics',
  'isrc-missing': 'track-isrc',
  'upc-missing': 'upc',
}

// Adds ?focus=<field> to a fix link that opens the edit form.
export function fixLink(fix: string, checkId: string): string {
  const field = FIELD_FOR_CHECK[checkId]
  if (!field || !/\/edit(\?|$)/.test(fix)) return fix
  return `${fix}${fix.includes('?') ? '&' : '?'}focus=${field}`
}
