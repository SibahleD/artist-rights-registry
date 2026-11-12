# Lighthouse page-speed tests

`lighthouse.mjs` audits 7 pages (3 public, 4 signed-in) under 3 network profiles, 3 runs each,
and writes HTML + JSON reports and a summary table.

| Profile | What it simulates |
|---|---|
| mobile | Lighthouse's standard mobile test: Moto G Power, slow 4G (150 ms latency, 1.6 Mbps), 4x CPU slowdown |
| desktop | Lighthouse's desktop preset (fast connection) |
| constrained | A weak mobile connection (400 ms latency, 400 Kbps, 4x CPU slowdown). Use it for the "simulating latency" requirement |

Every run starts from a fresh browser, so it measures a first visit with an empty cache.

## Setup (once, repo root)
```bash
npm install --save-dev lighthouse @playwright/test
npx playwright install chromium
```
Add to `.gitignore`: `reports/`

## Run
```bash
# 1. The live site (best: real CDN and real network path from where you are)
node perf/lighthouse.mjs

# 2. A local production build (never use `npm run dev`: the dev server is not representative)
cd client && npm run build && npm run preview     # serves on http://localhost:4173
TARGET=http://localhost:4173 API=http://localhost:4000/api node perf/lighthouse.mjs
```

### Signed-in pages
Create one dedicated test account on the target by hand (not with the Postman collection), then:
```bash
LH_EMAIL=you@example.com LH_PASSWORD='...' node perf/lighthouse.mjs
```
The script logs in once and gives the token to each browser run. If a row says "redirected to login, invalid",
the token was not accepted and that row must not be used.
Without these variables only the public pages are tested.

Optional settings: `RUNS=5`, `PROFILES=mobile,desktop`, `OUT=reports/lighthouse-local`.

## Output
```
reports/lighthouse/
  summary.md                     medians for every page and profile (paste into the chapter)
  mobile/home-median.html        the median run per page: open this one and screenshot it
  mobile/home-run1.html/.json    every individual run
```

## One-off alternative (a single page, with the viewer)
```bash
npx lighthouse https://trackrecordrw.netlify.app --preset=desktop --view
npx lighthouse https://trackrecordrw.netlify.app/app/login --view
```

## Screenshots for 4.5.6
1. The terminal while the script runs, then the `summary.md` table.
2. The median HTML report for: landing, login and home, for mobile and desktop (top section with the four scores and the metrics).
3. The same pages under `constrained`, to show behaviour on a poor connection.
4. In one report, expand "Serve static assets with an efficient cache policy" (the caching evidence).

## Reading the results
- Performance, Accessibility, Best practices and SEO are scored 0 to 100 (90+ is good).
- Core numbers to discuss: FCP and LCP (when content appears), TBT (how long the page is unresponsive), CLS (layout jumping), Speed Index, and total transfer size.
- Mobile scores are always lower than desktop. That is expected, so compare each profile with itself, not with each other.
- Scores vary between runs (network and machine noise). That is why the table uses the median of 3 and the run count is stated. Close other apps while testing.

## What Lighthouse does not cover
- Graceful failure (offline, 500s, slow API) and repeat-visit caching behaviour: test these in Playwright.
- Load and resource use: k6.
