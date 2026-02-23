-- Fix recursive RLS policies on public.users (error code 42P17)
-- Run this in Supabase SQL Editor.

BEGIN;

-- Remove known recursive policies from previous schema versions.
DROP POLICY IF EXISTS admin_view_all ON public.users;
DROP POLICY IF EXISTS "Usuários podem ver seus próprios dados" ON public.users;
DROP POLICY IF EXISTS "Usuarios podem ver seus proprios dados" ON public.users;
DROP POLICY IF EXISTS "Apenas administradores podem ver todos os usuários" ON public.users;
DROP POLICY IF EXISTS "Apenas administradores podem ver todos os usuarios" ON public.users;
DROP POLICY IF EXISTS users_select_own ON public.users;
DROP POLICY IF EXISTS users_update_own ON public.users;

-- Ensure RLS is enabled.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Schema variant A: users.auth_id exists (newer schema)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'auth_id'
  ) THEN
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

  -- Schema variant B: users.id is mapped to auth.uid() (legacy schema)
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'id'
  ) THEN
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
END
$$;

COMMIT;
