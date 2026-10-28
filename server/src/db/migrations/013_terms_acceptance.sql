-- Step 13: record when each user accepted the Terms and Conditions, and which version.
-- Existing accounts stay NULL (they signed up before the terms existed).
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS terms_version     TEXT;