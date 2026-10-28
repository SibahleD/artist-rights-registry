-- Step 16: the artist's own link to their member dashboard at a society (optional, private to them).
-- Only web addresses are accepted, so a stored value can always be opened as a normal link.
ALTER TABLE user_societies
    ADD COLUMN dashboard_url TEXT
    CHECK (dashboard_url IS NULL OR (char_length(dashboard_url) <= 500 AND dashboard_url ~* '^https?://[^[:space:]]+$'));
