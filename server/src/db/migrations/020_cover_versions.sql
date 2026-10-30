-- Step 20: whether a release contains cover versions, which distributors ask for.
-- NULL means unanswered (older releases, and new ones until the artist chooses), so it is not treated as "No".
ALTER TABLE releases ADD COLUMN has_cover_versions BOOLEAN;