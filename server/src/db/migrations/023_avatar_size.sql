-- Step 23: profile photos may be up to 4 MB (was 2 MB). The Netlify Function request limit (~4.5 MB) is the real ceiling.
-- The size rule in migration 001 is an unnamed table CHECK, so find it by its contents, drop it and add it back named.
DO $$
DECLARE c record;
BEGIN
    FOR c IN SELECT conname FROM pg_constraint
             WHERE conrelid = 'media'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%2097152%'
    LOOP
        EXECUTE format('ALTER TABLE media DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

ALTER TABLE media ADD CONSTRAINT media_kind_size_check CHECK (
    (kind = 'avatar'  AND release_id IS NULL     AND size_bytes <= 4194304)
 OR (kind = 'artwork' AND release_id IS NOT NULL AND size_bytes <= 26214400)
);
