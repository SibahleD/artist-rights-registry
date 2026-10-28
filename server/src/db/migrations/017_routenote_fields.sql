-- Step 17 (Phase 5): the fields RouteNote asks for that the app did not hold yet.
--
-- Every new column is optional, so existing releases and tracks are unaffected and nothing here blocks "mark ready".
-- The date rule (originally released on or before sales start) is enforced here as well as in the API.
-- release_artists is the ordered list of primary artists; release_credits holds producer-style credits with a
-- title (Producer, Mixing Engineer, Vocals...) either for the whole release (track_id NULL) or for one track.
-- The list of allowed titles lives in server/src/lib/routenote.js and client/src/data/contributorTitles.ts.

ALTER TABLE releases
    ADD COLUMN album_version        TEXT CHECK (album_version IS NULL OR length(btrim(album_version)) BETWEEN 1 AND 200),
    ADD COLUMN is_compilation       BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN has_lyrics           BOOLEAN,
    ADD COLUMN explicit             TEXT CHECK (explicit IS NULL OR explicit IN ('explicit', 'not_explicit', 'cleaned')),
    ADD COLUMN secondary_genre      TEXT CHECK (secondary_genre IS NULL OR length(btrim(secondary_genre)) BETWEEN 1 AND 100),
    ADD COLUMN originally_released  DATE,
    ADD COLUMN preorder_date        DATE,
    ADD COLUMN sales_start_date     DATE,
    ADD CONSTRAINT releases_original_before_sales
        CHECK (originally_released IS NULL OR sales_start_date IS NULL OR originally_released <= sales_start_date);

ALTER TABLE tracks
    ADD COLUMN has_lyrics             BOOLEAN,
    ADD COLUMN preview_start_seconds  INTEGER CHECK (preview_start_seconds IS NULL OR preview_start_seconds >= 0);

CREATE TABLE release_artists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    release_id  UUID NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL CHECK (position > 0),
    name        TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
    UNIQUE (release_id, position)
);
CREATE UNIQUE INDEX uq_release_artists_name ON release_artists (release_id, lower(btrim(name)));

CREATE TABLE release_credits (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    release_id  UUID NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
    track_id    UUID REFERENCES tracks(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL CHECK (position > 0),
    name        TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
    title       TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 60)
);
CREATE INDEX idx_release_credits_release ON release_credits (release_id, track_id, position);
