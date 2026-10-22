-- Step 13: record when each user accepted the Terms and Conditions, and which version.
-- Existing accounts stay NULL (they signed up before the terms existed).
ALTER TABLE users
    ADD COLUMN terms_accepted_at TIMESTAMPTZ,
    ADD COLUMN terms_version     TEXT;
