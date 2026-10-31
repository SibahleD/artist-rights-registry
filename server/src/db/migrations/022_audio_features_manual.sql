-- Step 22: ReccoBeats is no longer used. Playlist Projections now run on numbers the artist sets for their own song.
--
-- Rows already saved keep their numbers and keep source = 'reccobeats' so the page can say where they came from.
-- New rows are written with source = 'manual'. Nothing is deleted or rewritten.

ALTER TABLE track_audio_features ALTER COLUMN source SET DEFAULT 'manual';
