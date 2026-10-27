-- Step 14: password reset. Reset links reuse email_tokens with a third kind.
-- The 'verify' and 'email_change' kinds are unchanged.
ALTER TABLE email_tokens DROP CONSTRAINT IF EXISTS email_tokens_kind_check;
ALTER TABLE email_tokens
    ADD CONSTRAINT email_tokens_kind_check CHECK (kind IN ('verify','email_change','password_reset'));
