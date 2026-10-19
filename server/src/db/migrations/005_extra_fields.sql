-- Step 4: extra metadata fields.

-- Collaborators: two new roles, IPI, writer status, publisher details.
ALTER TABLE collaborators DROP CONSTRAINT IF EXISTS collaborators_role_check;
ALTER TABLE collaborators ADD CONSTRAINT collaborators_role_check
    CHECK (role IN ('composer','songwriter','lyricist','arranger','publisher','producer','performer','other'));

ALTER TABLE collaborators
    ADD COLUMN ipi TEXT CHECK (ipi IS NULL OR ipi ~ '^[0-9]{9,11}$'),
    ADD COLUMN writer_status TEXT CHECK (writer_status IS NULL OR writer_status IN
        ('joined','not_joined','has_administrator','authorized_artist','bought_out','unknown')),
    ADD COLUMN publisher_name TEXT CHECK (publisher_name IS NULL OR length(btrim(publisher_name)) > 0),
    ADD COLUMN is_self_published BOOLEAN NOT NULL DEFAULT false,
    ADD CONSTRAINT collaborators_publisher_consistency CHECK (NOT (is_self_published AND publisher_name IS NOT NULL));

-- Tracks: where the song comes from, version label, language.
ALTER TABLE tracks
    ADD COLUMN origin TEXT NOT NULL DEFAULT 'original'
        CHECK (origin IN ('original','cover','arrangement','sample')),
    ADD COLUMN version_title TEXT,
    ADD COLUMN language TEXT CHECK (language IS NULL OR language ~ '^[a-z]{2,3}$');

-- Releases: label and language.
ALTER TABLE releases
    ADD COLUMN label_name TEXT,
    ADD COLUMN language TEXT CHECK (language IS NULL OR language ~ '^[a-z]{2,3}$');

-- Users: profile details used to pre-fill credits and registrations.
ALTER TABLE users
    ADD COLUMN country TEXT CHECK (country IS NULL OR country ~ '^[A-Z]{2}$'),
    ADD COLUMN nationality TEXT,
    ADD COLUMN roles TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN society_name TEXT,
    ADD COLUMN ipi TEXT CHECK (ipi IS NULL OR ipi ~ '^[0-9]{9,11}$'),
    ADD COLUMN publisher_name TEXT;
