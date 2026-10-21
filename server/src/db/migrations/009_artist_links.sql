-- Artist links share one structure with release store links: a service (from a fixed list, or 'other' with a label) and a URL.
-- The old primary key (user_id, platform) allowed one link per platform; the new one allows several, with the URL kept unique per user.

ALTER TABLE artist_links DROP CONSTRAINT IF EXISTS artist_links_platform_check;
ALTER TABLE artist_links DROP CONSTRAINT IF EXISTS artist_links_pkey;

ALTER TABLE artist_links
    ADD COLUMN id         UUID NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN service    TEXT,
    ADD COLUMN label      TEXT,
    ADD COLUMN kind       TEXT,
    ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE artist_links SET
    service = platform,
    label = CASE platform
        WHEN 'spotify'     THEN 'Spotify'
        WHEN 'apple_music' THEN 'Apple Music'
        WHEN 'soundcloud'  THEN 'SoundCloud'
        WHEN 'youtube'     THEN 'YouTube'
        WHEN 'instagram'   THEN 'Instagram'
        WHEN 'tiktok'      THEN 'TikTok'
        WHEN 'x'           THEN 'X (Twitter)'
        ELSE platform
    END,
    kind = CASE WHEN platform IN ('instagram', 'tiktok', 'x') THEN 'social' ELSE 'streaming' END;

ALTER TABLE artist_links
    ALTER COLUMN service SET NOT NULL,
    ALTER COLUMN label   SET NOT NULL,
    ALTER COLUMN kind    SET NOT NULL,
    ADD PRIMARY KEY (id),
    ADD CONSTRAINT artist_links_kind_check CHECK (kind IN ('streaming', 'social', 'store', 'other')),
    ADD CONSTRAINT artist_links_label_check CHECK (length(btrim(label)) BETWEEN 1 AND 60),
    ADD CONSTRAINT uq_artist_links_user_url UNIQUE (user_id, url);

ALTER TABLE artist_links DROP COLUMN platform;

CREATE INDEX idx_artist_links_user ON artist_links (user_id);
