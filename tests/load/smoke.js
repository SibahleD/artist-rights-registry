// Smoke test: 1 virtual user for 1 minute. Confirms the scripts and the system work before any real load.
import { setupData, teardownData, userAction, thresholds, MODE, BASE } from './lib.js'

export const options = {
  vus: 1,
  duration: '1m',
  thresholds: thresholds(800),
  tags: { test: 'smoke', mode: MODE },
}
export function setup() { return setupData() }
export function teardown(data) { teardownData(data) }
export default function (data) { userAction(data) }
