CREATE TABLE collaborator_notices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id         UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  email_hash       TEXT NOT NULL,
  email            TEXT,
  co_writer_name   TEXT,
  role             TEXT NOT NULL,
  share_percent    NUMERIC(5,2) NOT NULL,
  token_hash       TEXT NOT NULL UNIQUE,
  notice_version   TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','confirmed','disputed','removed','expired','cancelled')),
  note             TEXT,
  sent_by          UUID NOT NULL REFERENCES users(id),
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  reminder_sent_at TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ NOT NULL,
  responded_at     TIMESTAMPTZ,
  consent_at       TIMESTAMPTZ,
  UNIQUE (track_id, email_hash)
);
CREATE INDEX idx_notices_track ON collaborator_notices (track_id);

ALTER TABLE collaborators ADD COLUMN removed_by_writer BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE releases      ADD COLUMN unconfirmed_acknowledged_at TIMESTAMPTZ;