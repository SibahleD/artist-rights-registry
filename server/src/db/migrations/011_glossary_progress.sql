-- Step 11: glossary progress. Which terms a user has marked as understood or still learning.
CREATE TABLE glossary_progress (
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    term_id     TEXT        NOT NULL CHECK (term_id ~ '^[a-z0-9-]{1,64}$'),
    status      TEXT        NOT NULL CHECK (status IN ('understood', 'learning')),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, term_id)
);
