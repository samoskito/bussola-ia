BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.chats
  DROP CONSTRAINT IF EXISTS chats_agent_type_check;

ALTER TABLE public.chats
  ADD CONSTRAINT chats_agent_type_check
  CHECK (agent_type IN ('comunicacao', 'apresentacao', 'conversas_dificeis', 'postagem'));

DO $$
DECLARE
  users_id_type TEXT;
  user_id_sql_type TEXT;
  access_user_id_type TEXT;
BEGIN
  SELECT udt_name
  INTO users_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'id';

  IF users_id_type IS NULL THEN
    RAISE EXCEPTION 'public.users.id column was not found';
  END IF;

  user_id_sql_type := CASE users_id_type
    WHEN 'uuid' THEN 'UUID'
    WHEN 'int4' THEN 'INTEGER'
    WHEN 'int8' THEN 'BIGINT'
    ELSE NULL
  END;

  IF user_id_sql_type IS NULL THEN
    RAISE EXCEPTION 'public.users.id type % is not supported for user_agent_access.user_id', users_id_type;
  END IF;

  IF to_regclass('public.user_agent_access') IS NULL THEN
    EXECUTE format($create_table$
      CREATE TABLE public.user_agent_access (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id %s NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        agent_type TEXT NOT NULL CHECK (agent_type IN ('comunicacao', 'apresentacao', 'conversas_dificeis', 'postagem')),
        enabled BOOLEAN NOT NULL DEFAULT true,
        expires_at DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (user_id, agent_type)
      )
    $create_table$, user_id_sql_type);
  ELSE
    SELECT udt_name
    INTO access_user_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_agent_access'
      AND column_name = 'user_id';

    IF access_user_id_type IS DISTINCT FROM users_id_type THEN
      RAISE EXCEPTION 'public.user_agent_access.user_id type % does not match public.users.id type %',
        access_user_id_type,
        users_id_type;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_agent_access_user_id
  ON public.user_agent_access(user_id);

CREATE INDEX IF NOT EXISTS idx_user_agent_access_agent_type
  ON public.user_agent_access(agent_type);

CREATE INDEX IF NOT EXISTS idx_user_agent_access_enabled
  ON public.user_agent_access(enabled);

CREATE INDEX IF NOT EXISTS idx_user_agent_access_expires_at
  ON public.user_agent_access(expires_at);

ALTER TABLE public.user_agent_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_agent_access_service_role_all ON public.user_agent_access;
CREATE POLICY user_agent_access_service_role_all
  ON public.user_agent_access FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_plano_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_plano_check
  CHECK (
    plano IS NULL OR plano IN (
      'Todas',
      'Comunicação Executiva',
      'Apresentação para Reunião de Resultados',
      'Conversas Dificeis',
      'Postagem no Linkedin',
      'Personalizado',
      'Ambas'
    )
  );

-- Rollout warning: normalizing existing plans to 'Todas' must ship atomically
-- with app code that understands users.plano = 'Todas' and user_agent_access.
UPDATE public.users
SET plano = 'Todas';

INSERT INTO public.user_agent_access (user_id, agent_type, enabled, expires_at)
SELECT u.id, agent.agent_type, true, u.data_expiracao
FROM public.users u
CROSS JOIN (
  VALUES
    ('comunicacao'),
    ('apresentacao'),
    ('conversas_dificeis'),
    ('postagem')
) AS agent(agent_type)
ON CONFLICT (user_id, agent_type)
DO UPDATE SET
  enabled = EXCLUDED.enabled,
  expires_at = EXCLUDED.expires_at,
  updated_at = NOW();

COMMENT ON TABLE public.user_agent_access IS 'Permissoes por usuario e agente de IA. Tabela gerenciada principalmente pelas APIs server-side com service role.';
COMMENT ON COLUMN public.users.plano IS 'Resumo comercial/manual: Todas, Personalizado, Ambas legado ou nome de uma IA. Permissao efetiva fica em user_agent_access.';

COMMIT;
