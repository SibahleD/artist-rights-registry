-- Artist names must be unique across accounts, ignoring case and surrounding spaces.
-- Usernames are already unique (migration 001) and emails are already unique and lowercase (migration 001).
-- Deleted accounts are skipped, so a name frees up when its owner deletes their account.
--
-- If this migration stops with "duplicate artist names", rename the accounts it lists and run it again.
-- To see the duplicates yourself:
--   SELECT lower(btrim(artist_name)) AS name, count(*), array_agg(email) AS emails
--   FROM users WHERE deleted_at IS NULL
--   GROUP BY 1 HAVING count(*) > 1;

DO $$
DECLARE dupes text;
BEGIN
    SELECT string_agg(name || ' (' || n || ' accounts)', ', ') INTO dupes
    FROM (
        SELECT lower(btrim(artist_name)) AS name, count(*) AS n
        FROM users WHERE deleted_at IS NULL
        GROUP BY 1 HAVING count(*) > 1
    ) d;
    IF dupes IS NOT NULL THEN
        RAISE EXCEPTION 'duplicate artist names: %. Rename these accounts, then run the migration again.', dupes;
    END IF;
END $$;

CREATE UNIQUE INDEX uq_users_artist_name ON users (lower(btrim(artist_name))) WHERE deleted_at IS NULL;
