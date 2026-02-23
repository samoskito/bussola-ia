-- ============================================================
-- AUDIT + HARDENING RLS (Supabase / Postgres)
-- File: scripts/audit-and-harden-rls.sql
-- ============================================================
-- What this script does:
-- 1) Audits current RLS/policies in public schema
-- 2) Enables RLS for all public tables
-- 3) Fixes users policies (without recursive admin policy)
-- 4) Creates owner-only policies for tables with user_id
-- 5) Explicitly blocks password_reset_tokens from anon/authenticated
-- 6) Prints a post-check report
--
-- Safe to run multiple times (idempotent style).
-- Run in Supabase SQL Editor as privileged user.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0) Pre-audit snapshot
-- ------------------------------------------------------------
-- Tables without RLS
SELECT
  'PRECHECK_TABLES_WITHOUT_RLS' AS check_name,
  c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
  AND c.relrowsecurity = false
ORDER BY c.relname;

-- Tables with RLS but no policies
SELECT
  'PRECHECK_RLS_WITHOUT_POLICIES' AS check_name,
  t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p
  ON p.schemaname = t.schemaname
 AND p.tablename = t.tablename
WHERE t.schemaname = 'public'
GROUP BY t.tablename
HAVING COUNT(p.*) = 0
ORDER BY t.tablename;

-- ------------------------------------------------------------
-- 1) Enable RLS on all tables in public
-- ------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE FORMAT(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      r.schemaname, r.tablename
    );
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 2) Optional helper: try to backfill users.auth_id by email
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'auth_id'
  ) THEN
    EXECUTE '
      UPDATE public.users u
      SET auth_id = au.id
      FROM auth.users au
      WHERE u.auth_id IS NULL
        AND LOWER(u.email) = LOWER(au.email)
    ';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3) users table policies (NO recursive admin policy)
-- ------------------------------------------------------------
DO $$
BEGIN
  -- Remove common problematic/legacy policies first
  EXECUTE 'DROP POLICY IF EXISTS admin_view_all ON public.users';
  EXECUTE 'DROP POLICY IF EXISTS user_self_access ON public.users';
  EXECUTE 'DROP POLICY IF EXISTS users_select_own ON public.users';
  EXECUTE 'DROP POLICY IF EXISTS users_update_own ON public.users';
  EXECUTE 'DROP POLICY IF EXISTS "Usuários podem ver seus próprios dados" ON public.users';
  EXECUTE 'DROP POLICY IF EXISTS "Usuarios podem ver seus proprios dados" ON public.users';
  EXECUTE 'DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios dados" ON public.users';
  EXECUTE 'DROP POLICY IF EXISTS "Usuarios podem atualizar seus proprios dados" ON public.users';

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'auth_id'
  ) THEN
    -- Preferred schema: users.auth_id references auth.users.id
    EXECUTE '
      CREATE POLICY users_select_own
      ON public.users
      FOR SELECT
      USING (auth.uid() = auth_id)
    ';

    EXECUTE '
      CREATE POLICY users_update_own
      ON public.users
      FOR UPDATE
      USING (auth.uid() = auth_id)
      WITH CHECK (auth.uid() = auth_id)
    ';
  ELSE
    -- Legacy fallback: compare auth.uid() with users.id as text
    EXECUTE '
      CREATE POLICY users_select_own
      ON public.users
      FOR SELECT
      USING (auth.uid()::text = id::text)
    ';

    EXECUTE '
      CREATE POLICY users_update_own
      ON public.users
      FOR UPDATE
      USING (auth.uid()::text = id::text)
      WITH CHECK (auth.uid()::text = id::text)
    ';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4) Generic owner-only policies for tables with user_id
-- ------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.table_schema, c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'user_id'
      AND c.table_name <> 'users'
  LOOP
    EXECUTE FORMAT('DROP POLICY IF EXISTS rls_self_select ON %I.%I', r.table_schema, r.table_name);
    EXECUTE FORMAT('DROP POLICY IF EXISTS rls_self_insert ON %I.%I', r.table_schema, r.table_name);
    EXECUTE FORMAT('DROP POLICY IF EXISTS rls_self_update ON %I.%I', r.table_schema, r.table_name);
    EXECUTE FORMAT('DROP POLICY IF EXISTS rls_self_delete ON %I.%I', r.table_schema, r.table_name);

    EXECUTE FORMAT(
      'CREATE POLICY rls_self_select ON %I.%I FOR SELECT USING (auth.uid()::text = user_id::text)',
      r.table_schema, r.table_name
    );
    EXECUTE FORMAT(
      'CREATE POLICY rls_self_insert ON %I.%I FOR INSERT WITH CHECK (auth.uid()::text = user_id::text)',
      r.table_schema, r.table_name
    );
    EXECUTE FORMAT(
      'CREATE POLICY rls_self_update ON %I.%I FOR UPDATE USING (auth.uid()::text = user_id::text) WITH CHECK (auth.uid()::text = user_id::text)',
      r.table_schema, r.table_name
    );
    EXECUTE FORMAT(
      'CREATE POLICY rls_self_delete ON %I.%I FOR DELETE USING (auth.uid()::text = user_id::text)',
      r.table_schema, r.table_name
    );
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 5) Optional public-read policy for site_images
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'site_images'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS public_read_site_images ON public.site_images';
    EXECUTE '
      CREATE POLICY public_read_site_images
      ON public.site_images
      FOR SELECT
      USING (true)
    ';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 6) password_reset_tokens must be server-only
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'password_reset_tokens'
  ) THEN
    EXECUTE 'ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS deny_all_password_reset_tokens ON public.password_reset_tokens';
    EXECUTE '
      CREATE POLICY deny_all_password_reset_tokens
      ON public.password_reset_tokens
      FOR ALL
      USING (false)
      WITH CHECK (false)
    ';
  END IF;
END $$;

COMMIT;

-- ------------------------------------------------------------
-- 7) Post-check report
-- ------------------------------------------------------------
-- Remaining tables without RLS (should be none in public)
SELECT
  'POSTCHECK_TABLES_WITHOUT_RLS' AS check_name,
  c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
  AND c.relrowsecurity = false
ORDER BY c.relname;

-- Policy count per table
SELECT
  'POSTCHECK_POLICY_COUNT' AS check_name,
  t.tablename,
  COUNT(p.*) AS policy_count
FROM pg_tables t
LEFT JOIN pg_policies p
  ON p.schemaname = t.schemaname
 AND p.tablename = t.tablename
WHERE t.schemaname = 'public'
GROUP BY t.tablename
ORDER BY t.tablename;

