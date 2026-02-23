-- Create table used by customizable SMTP e-mail templates
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  updated_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_template_key
  ON public.email_templates (template_key);

-- Optional hardening
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Only service role should operate this table through server routes.
DROP POLICY IF EXISTS deny_all_email_templates ON public.email_templates;
CREATE POLICY deny_all_email_templates
  ON public.email_templates
  FOR ALL
  USING (false)
  WITH CHECK (false);
