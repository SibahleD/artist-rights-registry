# Track Record

A web platform that helps independent artists in Rwanda and East Africa learn what a music release requires and prepare complete, correct release metadata (including royalty splits) in one place, so it can be handed to a distributor without re-typing it.

Built as an African Leadership University (ALU) capstone project, *"Closing the Metadata Gap"*. (The repository and early documents use the working name *Artist Rights Registry*.)

| | |
|---|---|
| **Walkthrough video** | `ADD VIDEO LINK` |
| **Technical report (PDF)** | `ADD REPORT LINK` |
| **Live app** | `ADD LIVE URL` |
| **Repository** | https://github.com/SibahleD/artist-rights-registry |
| **Designs (Figma)** | https://www.figma.com/design/GydtWf28Zd0euZayfW1RPL/Untitled?node-id=2046-262&t=VfeWID24C8KMZMQq-1 |

---

## Table of contents

1. [Overview](#1-overview)
2. [Features](#2-features)
3. [Technical requirements](#3-technical-requirements)
4. [Installation](#4-installation)
5. [Configuration](#5-configuration)
6. [Testing](#6-testing)
7. [Repository structure](#7-repository-structure)
8. [Architecture and key algorithms](#8-architecture-and-key-algorithms)
9. [Deployment](#9-deployment)
10. [Known limitations](#10-known-limitations)

---

## 1. Overview

Independent artists often release music with incomplete or wrong metadata: missing ISRC/UPC codes, unclear songwriter and publisher splits, inconsistent credits and misspelt artist names. Distributors reject these uploads, royalties go unpaid, and ownership disputes follow.

Track Record gives the artist a guided workspace to build a release, a readiness check that explains exactly what is missing, a co-writer approval flow for splits, and an export (JSON and a Chrome extension) that carries the finished metadata to a distributor.

## 2. Features

| Area | What it does |
|---|---|
| **Accounts** | Register, log in, email verification, password reset, change email, change password, export or delete your data. JWT sessions, bcrypt-hashed passwords, rate-limited auth routes. |
| **Artist profile** | Artist name, legal name, avatar, streaming and social links, collecting-society memberships. |
| **Releases** | Singles, EPs and albums with release date, genre, UPC, label, language, credits, primary and featured artists, cover art. |
| **Tracks** | Per-song title, ISRC, ISWC, explicit flag, copyright lines and years, credits, audio upload with automatic inspection of format, duration, bitrate and sample rate. |
| **Royalty splits** | Per-song collaborators with legal name, role, IPI, writer status, publisher and ownership percent. Must total exactly 100%. |
| **Co-writer notices** | Each co-writer receives an emailed link to accept or dispute their share. Reminders, expiry and resolution are tracked. |
| **Readiness check** | Errors block "mark ready", warnings advise, with a direct link to fix each problem. Includes a spelling-conflict check across artist names. |
| **Draft / ready lock** | Ready releases are locked and can be reverted to draft. |
| **Metadata export** | JSON export of the whole release, plus a Chrome extension that fills a distributor's form from a ready release. |
| **Audio analysis** | A 30-second clip is cut in the browser and analysed for audio features, then scored against nine playlist types ("playlist fit"). |
| **Streams and earnings** | Import distributor CSV statistics, view performance by track, platform and month, and see estimated earnings with low, typical and high ranges. |
| **Learning** | Glossary of industry terms with per-user progress, and a Rwanda guide. |

## 3. Technical requirements

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 6, Vite 8, React Router 7, jsPDF |
| Backend | Node.js, Express 5, `pg`, `bcrypt`, `jsonwebtoken`, `multer`, `music-metadata`, `image-size`, `nodemailer`, `express-rate-limit` |
| Database | PostgreSQL 13 or newer (21 SQL migrations) |
| Testing | Node's built-in test runner (`node --test`) |
| Extension | Chrome (Manifest V3), plain JavaScript |
| Hosting | Netlify (static site and serverless API), Supabase (PostgreSQL) |

| Tool | Version |
|---|---|
| Node.js | 22.12 or newer |
| npm | Comes with Node |
| PostgreSQL | 13 or newer |
| Browser | Current Chrome, Edge, Firefox or Safari |

Hardware: any machine that runs Node 22 and PostgreSQL. No GPU or special hardware.

## 4. Installation

### 1. Clone

```bash
git clone https://github.com/SibahleD/artist-rights-registry.git
cd artist-rights-registry
```

### 2. Create the database

```bash
createdb -U postgres artist_rights
```

### 3. Start the API

```bash
cd server
npm install
cp .env.example .env        # then edit .env, see Configuration
npm run migrate             # creates every table
npm run dev                 # http://localhost:4000
```

Check <http://localhost:4000/health> returns `{"status":"ok"}` and <http://localhost:4000/health/db> confirms the database connection.

With `MAIL_TRANSPORT=console` and `DEV_OUTBOX=true` (the defaults in `.env.example`) emails are printed to the server log, so you can click verification and reset links without an email provider.

### 4. Start the web app

```bash
cd client
npm install
echo "VITE_API_URL=http://localhost:4000/api" > .env
npm run dev                 # http://localhost:5173/app/
```

### 5. Load the Chrome extension (optional)

Open `chrome://extensions`, switch on Developer mode, choose **Load unpacked** and pick the `extension` folder. See [`extension/README.md`](extension/README.md).

### Useful commands

| Where | Command | What it does |
|---|---|---|
| `server` | `npm run dev` | API with auto-restart |
| `server` | `npm run migrate` | Apply database migrations |
| `server` | `npm test` | Run all server tests |
| `client` | `npm run dev` | Dev server with hot reload |
| `client` | `npm run build` | Type-check and build to `client/dist` |
| `client` | `npm run lint` | Run oxlint |

## 5. Configuration

Copy `server/.env.example` to `server/.env`. The important variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `JWT_SECRET`, `EMAIL_HASH_KEY` | Long random secrets (required) |
| `APP_URL` | Public address of the web app **including `/app`**. Used in every emailed link. In production the server refuses to start if it is missing or points at localhost. |
| `MAIL_TRANSPORT` | `console` for development, `smtp` for real email |
| `MAIL_FROM`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Required when `MAIL_TRANSPORT=smtp` |
| `MAX_AUDIO_BYTES`, `MAX_COVER_BYTES`, `MAX_AVATAR_BYTES`, `MAX_USER_BYTES` | Upload limits (defaults 200 MB, 25 MB, 2 MB, 2 GB) |
| `VITE_API_URL` (client, build time) | API address the web app calls |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 6. Testing

The server has 186 test cases across 30 files in `server/tests/`, and the extension has 17 more in `extension/test/`.

```bash
cd server
npm test                                  # unit and validation tests, no database needed
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/artist_rights_test npm test   # also runs the database integration tests
```

| Strategy | Where | What it covers |
|---|---|---|
| Unit | `splits`, `codes`, `streams`, `playlistFit`, `account`, `tokens`, `upc` tests | Validators and algorithms with valid, invalid and edge inputs |
| Integration | `*-db.test.js`, `checks`, `lifecycle`, `uniqueNames` | Real SQL against a test database: lifecycle locking, readiness, imports, exports |
| Security and abuse | `rateLimits`, `password-reset`, `emailhash`, `mailer` tests | Rate limits, one-time reset tokens, hashed email lookup, production mail guard |
| UI and extension | `extension/test/` | Form filling, label parity, popup behaviour (needs `jsdom`, see extension README) |

## 7. Repository structure

```
.
├── client/                      React + TypeScript web app (served under /app)
│   ├── src/
│   │   ├── pages/               One component per screen
│   │   ├── components/          Reusable UI: editors, pickers, charts, layout
│   │   ├── lib/                 Pure logic: earnings, CSV parsing, distribution checks, PDFs
│   │   ├── data/                Reference data (platform rates, distributors)
│   │   ├── api.ts               fetch wrapper: JWT, errors, uploads
│   │   └── auth.tsx             Auth context
│   └── landing/                 Marketing page
├── server/
│   ├── src/
│   │   ├── routes/              URL to controller mapping
│   │   ├── controllers/         HTTP handling and queries
│   │   ├── services/            Business logic: readiness, notices, mail, storage, media
│   │   ├── lib/                 Pure validators and algorithms (no I/O)
│   │   ├── middleware/          Auth and rate limiting
│   │   ├── db/                  Pool and 21 SQL migrations
│   │   └── appUrl.js            Single source for emailed links
│   └── tests/                   Node test runner suites
├── extension/                   Chrome extension that fills distributor forms
├── netlify/functions/           API wrapper and hourly notice sweep
└── netlify.toml
```

## 8. Architecture and key algorithms

The server is layered: **routes** (URLs) call **controllers** (HTTP and queries), which call **services** (business rules) and **lib** (pure functions with no I/O). Validators return `{ value }` or `{ error }`, so they are reusable and easy to test. The client mirrors this: pages compose components, and pure logic lives in `client/src/lib`.

| Problem | Solution | File |
|---|---|---|
| Splits must total exactly 100% | Convert to integer cents before summing, so `33.33 x 3` cannot drift, and account for shares held by removed co-writers | `server/src/lib/splits.js` |
| Catch artist names spelt differently | Unicode normalisation plus Levenshtein edit distance (single-row dynamic programming) | `server/src/services/readiness.js` |
| Large messy CSV imports | Per-row validation, skip with reason, merge duplicates with a hash map keyed by ISRC, platform and month | `server/src/lib/streams.js` |
| Playlist fit score | Weighted average of piecewise-linear closeness to feature ranges | `server/src/lib/playlistFit.js` |
| Reset and notice links | 256-bit random token, only its SHA-256 hash stored, one-time use | `server/src/services/tokens.js` |
| Audio checks | Inspect the real container and codec, not the file extension | `server/src/services/mediaInspect.js` |

## 9. Deployment

Netlify serves the static client and runs the Express app as a function. Supabase provides PostgreSQL. Required Netlify environment variables: `NODE_ENV=production`, `APP_URL`, `DATABASE_URL`, `JWT_SECRET`, `EMAIL_HASH_KEY`, `MAIL_TRANSPORT=smtp`, `MAIL_FROM`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and `VITE_API_URL=/api` for the build. Set `TRUST_PROXY=1` so rate limits see real client IPs.

## 10. Known limitations

- Uploaded audio and artwork are stored on local disk (`UPLOAD_DIR`). Netlify Functions have no persistent disk and cap request bodies at about 6 MB, so uploads need either Supabase Storage with signed uploads or a host with a disk. This is the main item left for production.
- Playlist fit and earnings are rules of thumb and estimates, not forecasts. The interface labels them as such.
- The extension's RouteNote selectors were tested only against the included mock page and must be checked against the live form.
- The extension and client have no automated browser tests beyond the extension unit tests.
