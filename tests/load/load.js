// Load test: ramp to 20 users, hold, ramp down (about 5 minutes). Typical expected traffic.
// Change the peak with -e PEAK=30.
import { setupData, teardownData, userAction, thresholds, MODE } from './lib.js'

const PEAK = Number(__ENV.PEAK || 20)
export const options = {
  teardownTimeout: '5m', // deleting the test accounts can take a while; the default of 60 s cut it short in one run
  stages: [
    { duration: '1m', target: PEAK },   // ramp up
    { duration: '3m', target: PEAK },   // hold
    { duration: '1m', target: 0 },      // ramp down
  ],
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: thresholds(800),
  tags: { test: 'load', mode: MODE },
}
export function setup() { return setupData() }
export function teardown(data) { teardownData(data) }
export default function (data) { userAction(data) }
