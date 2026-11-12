# Postman / Newman: core workflow tests

58 requests, 117 assertions covering authentication, releases, tracks, splits, readiness and export,
co-writer notices, the Chrome extension's API calls, access control and cleanup. Later requests use ids
saved by earlier ones, so run the collection top to bottom.

## One-time setup
```bash
npm install --save-dev newman newman-reporter-htmlextra   # in the repo root or a tools/ folder
```

## Run against a local server (the default)
Start the server with a test database and the dev outbox on (the outbox lets the notice tests read the co-writer's link):
```bash
# server/.env  (local only, never in production)
DEV_OUTBOX=true
AUTH_RATE_LIMIT=1000
NOTICE_RATE_LIMIT=1000
ACCOUNT_RATE_LIMIT=1000
API_RATE_LIMIT=10000
```
```bash
cd server && npm run migrate && npm start
newman run postman/track-record-core.postman_collection.json \
  -e postman/local.postman_environment.json \
  --reporters cli,htmlextra \
  --reporter-htmlextra-export reports/newman-local.html \
  --reporter-htmlextra-title "Track Record API: core workflows (local)" \
  --delay-request 30
```
Screenshot the terminal summary and the HTML report for section 4.5.4 / 4.5.5.

## Run against the deployed Netlify site: read-only only
The full collection creates real users and sends real emails, so do not point it at production.
Run only the health checks there:
```bash
newman run postman/track-record-core.postman_collection.json \
  -e postman/netlify.postman_environment.json --folder "00 Health"
```

## Notes
- Each run registers new accounts (`qa+<timestamp>@example.com`) and deletes its release at the end. Use a throwaway local database.
- "Mark ready" currently exercises the rejection path (the test release has no audio or artwork). To cover the accept path, add an audio upload and artwork step before it.
- The 06 folder needs `DEV_OUTBOX=true`; skip it with `--folder` selections if it is off.
- Rate limits: the production auth limit is 10 requests per 15 minutes per IP, and one run makes about 10 auth calls. Use the relaxed values in `env/server.env` for Newman; a second run within 15 minutes on production limits would return 429s. The limiters-on and relaxed comparison belongs in the k6 load tests (`env/limiters-on.env`).
