-- Step 25: Spotify for Artists "audience timeline" export, kept in its own table.
--
-- This file is artist-level (one row per day for the whole catalogue), not per song, so it does not fit
-- stream_stats (which is keyed by ISRC, platform and month). One row per artist and day; re-importing a
-- file replaces the days it contains.

CREATE TABLE spotify_audience_daily (
    user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day                      DATE NOT NULL,
    listeners                INTEGER NOT NULL CHECK (listeners >= 0),
    monthly_listeners        INTEGER NOT NULL CHECK (monthly_listeners >= 0),
    monthly_active_listeners INTEGER NOT NULL CHECK (monthly_active_listeners >= 0),
    super_listeners          INTEGER NOT NULL CHECK (super_listeners >= 0),
    streams                  INTEGER NOT NULL CHECK (streams >= 0),
    playlist_adds            INTEGER NOT NULL CHECK (playlist_adds >= 0),
    saves                    INTEGER NOT NULL CHECK (saves >= 0),
    followers                INTEGER NOT NULL CHECK (followers >= 0),
    file_name                TEXT CHECK (file_name IS NULL OR length(file_name) <= 255),
    imported_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, day)
);
