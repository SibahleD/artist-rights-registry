-- Step 19: audio features estimated from a 30-second clip, used for the Playlist Projections on the Performance page.
--
-- One row per song. `features` holds the nine numbers ReccoBeats returns (acousticness, danceability, energy,
-- instrumentalness, liveness, loudness, speechiness, tempo, valence). The playlist fit scores are worked out from them
-- when they are read, so changing the rules never needs a data fix. Deleting the song deletes its row.

CREATE TABLE track_audio_features (
    track_id           UUID PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
    features           JSONB NOT NULL,
    clip_start_seconds INTEGER NOT NULL DEFAULT 0 CHECK (clip_start_seconds >= 0),
    source             TEXT NOT NULL DEFAULT 'reccobeats',
    analysed_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
