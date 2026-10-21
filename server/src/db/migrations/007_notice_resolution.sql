-- The artist's decision on a disputed notice (Step 7).
-- kept    = "keep my numbers": the dispute is closed and the same details can be sent again.
-- adopted = "use theirs": the artist changed the split to match the co-writer's correction.
ALTER TABLE collaborator_notices
  ADD COLUMN resolution      TEXT CHECK (resolution IN ('kept','adopted')),
  ADD COLUMN resolution_note TEXT,
  ADD COLUMN resolved_at     TIMESTAMPTZ,
  ADD CONSTRAINT notice_resolution_consistent CHECK ((resolution IS NULL) = (resolved_at IS NULL));
