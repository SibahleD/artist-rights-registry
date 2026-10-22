-- Step 12: the societies (PRO / CMO) an artist plans to join, has applied to, or is registered with.
-- Private to the user: every query is scoped to user_id, and the member number is never shown to anyone else.
CREATE TABLE user_societies (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body_name      TEXT        NOT NULL CHECK (char_length(body_name) BETWEEN 1 AND 120),
    country        TEXT        NOT NULL CHECK (country ~ '^([A-Z]{2}|INT)$'),   -- ISO code, or INT for international options
    status         TEXT        NOT NULL CHECK (status IN ('planned', 'applied', 'registered')),
    registered_on  DATE,
    member_ref     TEXT        CHECK (member_ref IS NULL OR char_length(member_ref) <= 100),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_societies_registered_on_check CHECK (registered_on IS NULL OR status = 'registered')
);

-- One row per body per user, ignoring case in the name.
CREATE UNIQUE INDEX user_societies_unique ON user_societies (user_id, country, lower(body_name));
CREATE INDEX idx_user_societies_user ON user_societies (user_id);
