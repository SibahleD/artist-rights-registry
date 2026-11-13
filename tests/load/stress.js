// Stress test: keep raising the number of users to find where the system starts to slow down or fail (about 9 minutes).
// Change the peak with -e PEAK=150. Thresholds are loose on purpose: the goal is to see the breaking point, not to pass.
import { setupData, teardownData, userAction, MODE } from './lib.js'

const PEAK = Number(__ENV.PEAK || 100)
export const options = {
  stages: [
    { duration: '1m', target: Math.round(PEAK * 0.25) },
    { duration: '2m', target: Math.round(PEAK * 0.5) },
    { duration: '2m', target: Math.round(PEAK * 0.75) },
    { duration: '2m', target: PEAK },
    { duration: '2m', target: 0 },
  ],
  thresholds: { http_req_failed: ['rate<0.10'] },
  tags: { test: 'stress', mode: MODE },
}
export function setup() { return setupData() }
export function teardown(data) { teardownData(data) }
export default function (data) { userAction(data) }
