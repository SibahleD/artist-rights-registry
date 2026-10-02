
-- ---------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------

CREATE TABLE users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email          TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
    password_hash  TEXT NOT NULL,
    artist_name    TEXT NOT NULL CHECK (length(btrim(artist_name)) > 0),
    contact_info   TEXT,
    first_name     TEXT,
    last_name      TEXT,
    username       TEXT CHECK (username ~ '^[a-z0-9_.]{3,30}$'),
    deleted_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_users_username ON users (username) WHERE username IS NOT NULL;

-- ---------------------------------------------------------------------
-- Artist Links
-- ---------------------------------------------------------------------

CREATE TABLE artist_links (
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform  TEXT NOT NULL CHECK (platform IN
              ('spotify','apple_music','soundcloud','youtube','instagram','tiktok','x')),
    url       TEXT NOT NULL CHECK (length(url) BETWEEN 1 AND 500),
    PRIMARY KEY (user_id, platform)
);

-- ---------------------------------------------------------------------
-- Releases
-- ---------------------------------------------------------------------

CREATE TABLE releases (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title          TEXT NOT NULL CHECK (length(btrim(title)) > 0),
    release_type   TEXT NOT NULL DEFAULT 'single' CHECK (release_type IN ('single','ep','album')),
    album_artist   TEXT NOT NULL CHECK (length(btrim(album_artist)) > 0),
    genre          TEXT,
    creation_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    release_date   DATE,
    upc            TEXT CHECK (upc IS NULL OR upc ~ '^[0-9]{12,13}$'),
    p_line         TEXT,
    c_line         TEXT,
    status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    ready_at       TIMESTAMPTZ,
    CHECK ((status = 'ready') = (ready_at IS NOT NULL)),
    CHECK (status = 'draft' OR release_date IS NOT NULL)
);
CREATE INDEX idx_releases_owner_status ON releases (owner_id, status);

-- ---------------------------------------------------------------------
-- Tracks
-- ---------------------------------------------------------------------

CREATE TABLE tracks (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    release_id                  UUID NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
    track_number                INTEGER NOT NULL CHECK (track_number > 0),
    title                       TEXT NOT NULL CHECK (length(btrim(title)) > 0),
    composition_title           TEXT,
    artist_name                 TEXT,
    genre                       TEXT,
    isrc                        TEXT CHECK (isrc IS NULL OR isrc ~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$'),
    iswc                        TEXT CHECK (iswc IS NULL OR iswc ~ '^T-[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]$'),
    duration_seconds            INTEGER CHECK (duration_seconds IS NULL OR duration_seconds > 0),
    explicit                    TEXT CHECK (explicit IN ('explicit','not_explicit','cleaned')),
    composition_copyright_year  SMALLINT CHECK (composition_copyright_year BETWEEN 1900 AND 2100),
    composition_copyright       TEXT,
    recording_copyright_year    SMALLINT CHECK (recording_copyright_year BETWEEN 1900 AND 2100),
    recording_copyright         TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_track_number UNIQUE (release_id, track_number) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_tracks_release ON tracks (release_id);
CREATE INDEX idx_tracks_isrc ON tracks (isrc) WHERE isrc IS NOT NULL;
CREATE UNIQUE INDEX uq_tracks_release_isrc ON tracks (release_id, isrc) WHERE isrc IS NOT NULL;


-- ---------------------------------------------------------------------
-- Audio Specs
-- ---------------------------------------------------------------------

CREATE TABLE audio_specs (
    track_id         UUID PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
    file_name        TEXT NOT NULL,
    format           TEXT NOT NULL CHECK (format IN ('mp3','flac','wav','aac','other')),
    bitrate_kbps     INTEGER CHECK (bitrate_kbps > 0),
    sample_rate_hz   INTEGER CHECK (sample_rate_hz > 0),
    channels         SMALLINT CHECK (channels > 0),
    size_bytes       BIGINT CHECK (size_bytes > 0),
    recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Collaborators
-- ---------------------------------------------------------------------

CREATE TABLE collaborators (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id           UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    user_id            UUID REFERENCES users(id),
    invited_email      TEXT CHECK (invited_email IS NULL OR invited_email = lower(invited_email)),
    legal_name         TEXT NOT NULL CHECK (length(btrim(legal_name)) > 0),
    role               TEXT NOT NULL DEFAULT 'songwriter'
                       CHECK (role IN ('composer','songwriter','publisher','producer','performer','other')),
    ownership_percent  NUMERIC(5,2) NOT NULL CHECK (ownership_percent >= 0 AND ownership_percent <= 100),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collaborators_track ON collaborators (track_id);
CREATE INDEX idx_collaborators_user  ON collaborators (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_collaborators_email ON collaborators (invited_email) WHERE invited_email IS NOT NULL;
CREATE UNIQUE INDEX uq_collaborators_track_user  ON collaborators (track_id, user_id)       WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX uq_collaborators_track_email ON collaborators (track_id, invited_email) WHERE invited_email IS NOT NULL;

-- ---------------------------------------------------------------------
-- Media
-- ---------------------------------------------------------------------

CREATE TABLE media (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind         TEXT NOT NULL CHECK (kind IN ('avatar','artwork')),
    owner_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    release_id   UUID REFERENCES releases(id) ON DELETE CASCADE,
    mime_type    TEXT NOT NULL CHECK (mime_type IN ('image/jpeg','image/png')),
    width        INTEGER NOT NULL CHECK (width > 0),
    height       INTEGER NOT NULL CHECK (height > 0),
    color_space  TEXT,
    size_bytes   INTEGER NOT NULL,
    data         BYTEA NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (size_bytes = octet_length(data)),
    CHECK ((kind = 'avatar'  AND release_id IS NULL AND size_bytes <= 2097152)
        OR (kind = 'artwork' AND release_id IS NOT NULL AND size_bytes <= 26214400))
);
CREATE UNIQUE INDEX uq_media_avatar  ON media (owner_id)   WHERE kind = 'avatar';
CREATE UNIQUE INDEX uq_media_artwork ON media (release_id) WHERE kind = 'artwork';

-- ---------------------------------------------------------------------
-- Disputes
-- ---------------------------------------------------------------------

CREATE TABLE disputes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id     UUID NOT NULL REFERENCES tracks(id) ON DELETE RESTRICT,
    raised_by    UUID NOT NULL REFERENCES users(id),
    reason       TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
    status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','contested','resolved')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at  TIMESTAMPTZ,
    CHECK ((status = 'resolved') = (resolved_at IS NOT NULL))
);
CREATE INDEX idx_disputes_track ON disputes (track_id);
CREATE UNIQUE INDEX uq_disputes_one_unresolved ON disputes (track_id) WHERE status <> 'resolved';

-- ---------------------------------------------------------------------
-- Dispute Splits
-- ---------------------------------------------------------------------

CREATE TABLE dispute_splits (
    dispute_id        UUID NOT NULL REFERENCES disputes(id) ON DELETE RESTRICT,
    collaborator_id   UUID NOT NULL REFERENCES collaborators(id) ON DELETE RESTRICT,
    percent_before    NUMERIC(5,2) NOT NULL CHECK (percent_before   BETWEEN 0 AND 100),
    percent_proposed  NUMERIC(5,2) NOT NULL CHECK (percent_proposed BETWEEN 0 AND 100),
    PRIMARY KEY (dispute_id, collaborator_id)
);

-- ---------------------------------------------------------------------
-- Dispute Responses
-- ---------------------------------------------------------------------

CREATE TABLE dispute_responses (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id    UUID NOT NULL REFERENCES disputes(id) ON DELETE RESTRICT,
    responder_id  UUID NOT NULL REFERENCES users(id),
    action        TEXT NOT NULL CHECK (action IN ('accept','counter','comment')),
    message       TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (action = 'accept' OR length(btrim(coalesce(message, ''))) > 0)
);
CREATE INDEX idx_dispute_responses_dispute ON dispute_responses (dispute_id);
