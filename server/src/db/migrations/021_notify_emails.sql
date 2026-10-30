-- Step 6: opt-in settings. Optional notification emails are OFF unless the artist switches them on.
-- Preferences live in users.preferences (JSONB), so no column change is needed; this makes the
-- off state explicit for every existing account. Existing keys keep their names:
-- analytics_opt_in and play_counts_opt_in (both default false) are the analytics and play-count toggles.
UPDATE users
SET preferences = preferences || '{"notify_emails": false}'::jsonb
WHERE NOT (preferences ? 'notify_emails');
