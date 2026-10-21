-- Step 8: settings. Preferences, password-change tracking, and email-change tokens.
ALTER TABLE users
    ADD COLUMN preferences        JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN password_changed_at TIMESTAMPTZ;

-- email_tokens now serves two purposes: confirming a new account ('verify') and
-- confirming a changed address ('email_change', which carries the new address).
ALTER TABLE email_tokens
    ADD COLUMN kind      TEXT NOT NULL DEFAULT 'verify' CHECK (kind IN ('verify','email_change')),
    ADD COLUMN new_email TEXT CHECK (new_email IS NULL OR new_email = lower(new_email)),
    ADD CONSTRAINT email_tokens_change_has_address CHECK ((kind = 'email_change') = (new_email IS NOT NULL));
