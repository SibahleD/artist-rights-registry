--------------------
-- USER
--------------------

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    contact_info TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

--------------------
-- RELEASE
--------------------

CREATE TABLE releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    creation_date DATE NOT NULL,
    release_type TEXT NOT NULL CHECK (release_type IN ('solo', 'collaborative')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'locked')),
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_at TIMESTAMPTZ
);


--------------------
-- TRACK
--------------------

CREATE TABLE tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    release_id UUID NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    isrc TEXT,
    iswc TEXT,
    genre TEXT,
    duration_secs INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

--------------------
-- COLLABORATOR
--------------------

CREATE TABLE collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    invited_email TEXT,
    ownership_percentage NUMERIC(5,2) NOT NULL CHECK (ownership_percentage > 0 AND ownership_percentage <= 100),
    confirmed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (user_id IS NOT NULL OR invited_email IS NOT NULL)
);

--------------------
-- CREDIT
--------------------

CREATE TABLE credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    invited_email TEXT,
    role TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (user_id IS NOT NULL OR invited_email IS NOT NULL)
);

--------------------
-- DISPUTE
--------------------

CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    disputor_id UUID NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'contested', 'resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

--------------------
-- DISPUTE
--------------------

CREATE TABLE dispute_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
    responder_id UUID NOT NULL REFERENCES users(id),
    response_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

--------------------
-- INDEXES
--------------------

CREATE INDEX idx_releases_owner ON releases(owner_id);
CREATE INDEX idx_tracks_release ON tracks(release_id);
CREATE INDEX idx_collaborators_track ON collaborators(track_id);
CREATE INDEX idx_credits_track ON credits(track_id);
CREATE INDEX idx_disputes_track ON disputes(track_id);
CREATE INDEX idx_dispute_responses_dispute ON dispute_responses(dispute_id);