// Distributors the helper may fill. Fill only runs on a page whose host matches an ENABLED entry.
// Real distributors start switched off: read a distributor's terms on automation first, then switch it on in the popup.
// `hosts` match the page's hostname exactly or as a parent domain (tunecore.com also covers www.tunecore.com).
// `extra` lets a distributor add or override field patterns once you have looked at its real form (see README).
const DISTRIBUTORS = [
  { id: 'mock', name: 'Mock distributor (test page)', hosts: ['localhost', '127.0.0.1'], enabledByDefault: true, extra: {} },
  { id: 'distrokid', name: 'DistroKid', hosts: ['distrokid.com'], enabledByDefault: false, extra: {} },
  { id: 'tunecore', name: 'TuneCore', hosts: ['tunecore.com'], enabledByDefault: false, extra: {} },
  { id: 'cdbaby', name: 'CD Baby', hosts: ['cdbaby.com'], enabledByDefault: false, extra: {} },
  { id: 'amuse', name: 'Amuse', hosts: ['amuse.io'], enabledByDefault: false, extra: {} },
  { id: 'routenote', name: 'RouteNote', hosts: ['routenote.com'], enabledByDefault: false, extra: {} },
]

function distributorFor(hostname, enabledMap) {
  return DISTRIBUTORS.find((d) =>
    (enabledMap[d.id] ?? d.enabledByDefault) && d.hosts.some((h) => hostname === h || hostname.endsWith('.' + h))) || null
}
