-- Step 15: streaming stats for the Performance and Earnings pages.
--
-- stream_stats holds one row per artist, ISRC, platform and month. Rows are keyed by ISRC (not track id)
-- so figures imported before a track has its ISRC still line up once it is added, and figures for
-- tracks that are not in the app yet are kept rather than thrown away. The app joins them to tracks
-- through tracks.isrc and releases.owner_id.
--
-- period is always the first day of the month. Re-importing the same month for the same platform
-- replaces the earlier figure (the importer upserts on the unique key).
-- stream_imports is the log of each import, so the artist can see what was loaded and when.

CREATE TABLE stream_imports (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source         TEXT NOT NULL CHECK (source IN ('csv', 'manual', 'api')),
    platform       TEXT CHECK (platform IS NULL OR platform ~ '^[a-z0-9_]{1,40}$'),
    file_name      TEXT CHECK (file_name IS NULL OR length(file_name) <= 255),
    rows_read      INTEGER NOT NULL DEFAULT 0 CHECK (rows_read >= 0),
    rows_saved     INTEGER NOT NULL DEFAULT 0 CHECK (rows_saved >= 0),
    rows_skipped   INTEGER NOT NULL DEFAULT 0 CHECK (rows_skipped >= 0),
    note           TEXT CHECK (note IS NULL OR length(note) <= 1000),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stream_imports_user ON stream_imports (user_id, created_at DESC);

CREATE TABLE stream_stats (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    isrc        TEXT NOT NULL CHECK (isrc ~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$'),
    platform    TEXT NOT NULL CHECK (platform ~ '^[a-z0-9_]{1,40}$'),
    period      DATE NOT NULL CHECK (EXTRACT(DAY FROM period) = 1),
    streams     BIGINT NOT NULL CHECK (streams >= 0),
    import_id   UUID REFERENCES stream_imports(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_stream_stats UNIQUE (user_id, isrc, platform, period)
);
CREATE INDEX idx_stream_stats_user_period ON stream_stats (user_id, period);
CREATE INDEX idx_stream_stats_isrc ON stream_stats (isrc);
