-- Create table used by custom SMTP password reset flow
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email
  ON public.password_reset_tokens (email);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash
  ON public.password_reset_tokens (token_hash);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
  ON public.password_reset_tokens (expires_at);

-- Optional hardening
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role should operate this table through server routes.
DROP POLICY IF EXISTS deny_all_password_reset_tokens ON public.password_reset_tokens;
CREATE POLICY deny_all_password_reset_tokens
  ON public.password_reset_tokens
  FOR ALL
  USING (false)
  WITH CHECK (false);

