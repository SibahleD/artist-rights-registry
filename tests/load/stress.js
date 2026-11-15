// Stress test: keep raising the number of users to find where the system starts to slow down or fail (about 9 minutes).
// Change the peak with -e PEAK=150. Thresholds are loose on purpose: the goal is to see the breaking point, not to pass.
import { setupData, teardownData, userAction, reportThresholds, MODE } from './lib.js'

const PEAK = Number(__ENV.PEAK || 100)
export const options = {
  teardownTimeout: '5m', // deleting the test accounts can take a while; the default of 60 s cut it short in one run
  stages: [
    { duration: '1m', target: Math.round(PEAK * 0.25) },
    { duration: '2m', target: Math.round(PEAK * 0.5) },
    { duration: '2m', target: Math.round(PEAK * 0.75) },
    { duration: '2m', target: PEAK },
    { duration: '2m', target: 0 },
  ],
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: { http_req_failed: ['rate<0.10'], ...reportThresholds() },
  tags: { test: 'stress', mode: MODE },
}
export function setup() { return setupData() }
export function teardown(data) { teardownData(data) }
export default function (data) { userAction(data) }
