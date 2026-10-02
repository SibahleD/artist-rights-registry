# Artist Rights Registry

A web platform that helps independent artists in Rwanda and East Africa learn what a music release requires and prepare their release metadata, including royalty splits, in one place, so it can be handed to a distributor without re-typing it.

Built as an African Leadership University (ALU) capstone project. The project proposal is *"Closing the Metadata Gap"*.

---

## Table of contents

1. [Description](#1-description)
2. [GitHub repository](#2-github-repository)
3. [Setup](#3-setup)
4. [Designs](#4-designs)
5. [Deployment plan](#5-deployment-plan)

---

## 1. Description

### The problem

Independent artists often release music without complete, correct metadata: missing ISRC/UPC codes, unclear songwriter and publisher splits, and inconsistent credits. This leads to rejected distributor uploads, unpaid royalties and ownership disputes later.

### What the app does

| Area | Features |
|---|---|
| **Accounts** | Register and log in with email and password (JWT sessions, bcrypt-hashed passwords) |
| **Artist profile** | Artist name, first and last name, contact info, streaming links (Spotify, Apple Music, SoundCloud, YouTube) and social links (Instagram, TikTok, X) |
| **Releases** | Create singles, EPs and albums, with release date, genre, UPC and ℗ / © lines |
| **Tracks** | Per-song title, composition title, ISRC, ISWC, duration, explicit flag, copyright lines and years, and audio file metadata (name, format, bitrate, sample rate, channels, size) |
| **Royalty splits** | Per-song collaborators with legal name, role and ownership percentage. Splits must total exactly 100%. |
| **Readiness check** | A release can only be marked **ready** when it has a release date, at least one track, an audio file on every track and splits totalling 100%. Problems are listed so they can be fixed. |
| **Draft / ready lock** | Drafts are fully editable. Ready releases are locked. They can be reverted to draft unless a dispute exists. |
| **Collaborations** | Collaborators are matched by email. Once they sign up or log in, songs they co-own appear under **Collaborations** with a read-only view of the splits. |
| **Metadata export** | Export a release's full metadata (release, tracks, audio and splits) as JSON for a distributor |

### Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router |
| Backend | Node.js, Express 5 |
| Database | PostgreSQL (`pg`) |
| Auth | JSON Web Tokens + bcrypt, `express-rate-limit` on the auth routes |

### Project structure

```
artist-rights-registry/
├── client/                    # React + TypeScript frontend
│   └── src/
│       ├── api.ts             # fetch wrapper (adds the JWT, normalises errors)
│       ├── auth.tsx           # auth context
│       ├── types.ts           # API response / request types
│       ├── index.css          # global styles and design tokens
│       ├── components/        # Layout, TrackEditor, shared UI
│       └── pages/             # Home, Discography, ListingForm, ReleaseView, ...
└── server/                    # Express API
    └── src/
        ├── index.js           # app entry point
        ├── db/                # pool.js and schema.sql
        ├── middleware/        # JWT auth
        ├── routes/            # route definitions
        └── controllers/       # request handling and database queries
```

### API overview

All routes are prefixed with `/api`. Everything except register and login requires `Authorization: Bearer <token>`.

| Method | Route | Purpose |
|---|---|---|
| POST | `/auth/register`, `/auth/login`, `/auth/logout` | Account access |
| GET, PATCH | `/users/me` | Read or update the profile |
| GET | `/users/me/links` | List the artist's links |
| PUT, DELETE | `/users/me/links/:platform` | Add, update or remove a link |
| POST, GET | `/releases` | Create or list your releases (`?status=draft\|ready`) |
| GET, PATCH, DELETE | `/releases/:id` | Read, update or delete a draft release |
| POST | `/releases/:id/ready`, `/releases/:id/revert` | Mark ready or revert to draft |
| POST, GET | `/releases/:releaseId/tracks` | Create or list tracks |
| GET, PATCH, DELETE | `/releases/:releaseId/tracks/:trackId` | Read, update or delete a track |
| PUT | `/releases/:releaseId/tracks/order` | Reorder tracks |
| PUT, DELETE | `/releases/:releaseId/tracks/:trackId/audio` | Set or remove audio metadata |
| GET, PUT | `/releases/:releaseId/tracks/:trackId/collaborators` | Read or replace the splits |
| GET | `/shared-tracks`, `/shared-tracks/:trackId` | Songs you collaborate on |
| GET | `/health` | Health check (outside `/api`) |

### Data model

PostgreSQL schema: [`server/src/db/schema.sql`](server/src/db/schema.sql).

- **users** has one-to-many **artist_links** (one row per platform).
- **users** has one-to-many **releases**, which have one-to-many **tracks**.
- A **track** has at most one **audio_specs** row and many **collaborators** (the splits).
- A collaborator may be linked to a **user** or only to an invited email until that person signs up.
- Constraints enforce the rules in the database as well as the API: valid ISRC, ISWC and UPC formats, `ready` requires a release date, one split row per person per track, and ownership between 0 and 100.
- The schema also contains **media**, **disputes**, **dispute_splits** and **dispute_responses** tables for planned features (artwork, avatars and split disputes). The API does not use them yet.

### Roadmap

- Split disputes (accept, counter, comment), already modelled in the schema
- Cover artwork and profile pictures
- Settings page (username, password change, account deletion)
- Distributor-specific export formats

---

## 2. GitHub repository and Video Walkthrough

**GitHub Link**

```
https://github.com/SibahleD/artist-rights-registry
```

**Video Walkthrough**

```
https://youtu.be/NuNfMltoPyc
```

---

## 3. Setup

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | 22 LTS (20.19 or newer) |
| npm | Comes with Node |
| PostgreSQL | 13 or newer |
| Git | Any recent version |

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/<your-repository>.git
cd <your-repository>
```

### 2. Create the database

```bash
# creates an empty database called artist_rights
createdb -U postgres artist_rights

# creates all tables and constraints
psql -U postgres -d artist_rights -f server/src/db/schema.sql
```

On Windows, run these from the SQL Shell (psql) or add PostgreSQL's `bin` folder to your `PATH`.

> `schema.sql` creates tables without `IF NOT EXISTS`. To start over, drop the database and repeat this step.

### 3. Configure and start the backend

```bash
cd server
npm install
```

Create `server/.env`:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/artist_rights
JWT_SECRET=replace-with-a-long-random-string
PORT=4000
NODE_ENV=development
```

Generate a strong secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Start the API:

```bash
npm run dev
```

Check that it works at <http://localhost:4000/health>, which should return `{"status":"ok"}`.

### 4. Configure and start the frontend

In a second terminal:

```bash
cd client
npm install
```

Create `client/.env`:

```env
VITE_API_URL=http://localhost:4000/api
```

Start the dev server:

```bash
npm run dev
```

Open the URL Vite prints, usually <http://localhost:5173>, then register an account.

### Useful commands

| Where | Command | What it does |
|---|---|---|
| `client` | `npm run dev` | Dev server with hot reload |
| `client` | `npm run build` | Type-check and build to `client/dist` |
| `client` | `npm run preview` | Serve the production build locally |
| `client` | `npm run lint` | Run oxlint |
| `server` | `npm run dev` | Run the API with auto-restart |

### Troubleshooting

| Problem | Likely cause |
|---|---|
| `Cannot reach the server` in the app | The API isn't running, or `VITE_API_URL` is wrong. Restart the client after editing `.env`. |
| `password authentication failed` | Wrong password in `DATABASE_URL` |
| `relation "users" does not exist` | `schema.sql` was not run against `artist_rights` |
| `secretOrPrivateKey must have a value` | `JWT_SECRET` is missing from `server/.env` |
| Browser CORS error | Start the API first and check the port matches `VITE_API_URL` |


---

## 4. Designs

```
https://www.figma.com/design/GydtWf28Zd0euZayfW1RPL/Untitled?node-id=2046-262&t=VfeWID24C8KMZMQq-1
```

### Screens designed

Login, Home, Discography, Artist Profile, Release (album, EP and single) edit, Track edit, and Settings.
All sthe aforementioned screens are available in the `docs/designs/` directory.

### Circuit Diagram

The circuit diagram can be found in the `docs/` directory.

The diagram shows three tiers. The React client in the browser sends JSON over HTTP to the Express API, and the API's controllers run SQL against PostgreSQL through a connection pool.

Auth: the login token travels as a Bearer header on every request except register and login. The auth routes also have a rate limiter, preventing multiple requests from the same IP.
Routes: the API mounts four route groups under /api: auth, users, releases and shared-tracks. Tracks and collaborators sit under releases.


## 5. Deployment plan

The app is not deployed yet. This is the plan for taking it live. It uses managed services with free tiers, so there are no servers to maintain.

### Target architecture

```
Browser ──HTTPS──▶ Frontend (static site, Vercel)
   │
   └────HTTPS──▶ API (Node web service, Render) ──▶ PostgreSQL (managed, Render)
```

| Component | Host | Why |
|---|---|---|
| Frontend (`client/`) | Vercel | Static hosting with a CDN, automatic builds from GitHub |
| API (`server/`) | Render web service | Runs Node directly from the repo, with environment variables and HTTPS |
| Database | Render PostgreSQL| Managed Postgres with backups, in the same region as the API |
