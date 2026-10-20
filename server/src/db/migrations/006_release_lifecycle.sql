-- Step 6: "released" sits beside draft/ready instead of widening releases.status,
-- because status is tied by constraints to ready_at and release_date.
ALTER TABLE releases ADD COLUMN released_at TIMESTAMPTZ;
ALTER TABLE releases ADD CONSTRAINT releases_released_requires_ready
    CHECK (released_at IS NULL OR status = 'ready');

CREATE TABLE release_links (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    release_id  UUID NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
    store       TEXT NOT NULL CHECK (length(btrim(store)) > 0),
    url         TEXT NOT NULL CHECK (url ~ '^https?://' AND length(url) <= 500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (release_id, url)
);
CREATE INDEX idx_release_links_release ON release_links (release_id);
