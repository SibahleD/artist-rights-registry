-- Step 24: schema cleanup after the November review.
-- Removes columns and tables that nothing reads or writes, and slims glossary_progress to the terms a user understands.
-- Dropped data: users.contact_info (the profile no longer asks for it; email is the contact) and any 'learning' marks.
-- Runs inside the migration runner's transaction, so a failure leaves the database as it was.

-- Contact info: email is enough.
ALTER TABLE users DROP COLUMN IF EXISTS contact_info;

-- Never written by any code.
ALTER TABLE media DROP COLUMN IF EXISTS color_space;

-- Left over from the removed "acknowledge unconfirmed co-writers" bypass (confirmed splits are now required before ready).
ALTER TABLE releases DROP COLUMN IF EXISTS unconfirmed_acknowledged_at;

-- Disputes run through collaborator_notices. These three tables from the baseline were never written to.
DROP TABLE IF EXISTS dispute_responses;
DROP TABLE IF EXISTS dispute_splits;
DROP TABLE IF EXISTS disputes;

-- Glossary: every term counts as "still learning" until marked, so only understood terms are stored.
DELETE FROM glossary_progress WHERE status <> 'understood';
ALTER TABLE glossary_progress DROP COLUMN status;
