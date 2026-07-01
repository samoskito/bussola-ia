-- Admin lifetime access cleanup
-- Run this in Supabase SQL Editor after deploying the code change.
-- It makes current admin users consistent with the app rule:
-- admins do not expire and can test/use every registered agent.

BEGIN;

UPDATE public.users
SET
  data_expiracao = NULL,
  plano = 'Todas',
  updated_at = NOW()
WHERE nivel = 'admin';

UPDATE public.user_agent_access uaa
SET
  enabled = TRUE,
  expires_at = NULL,
  updated_at = NOW()
FROM public.users users
WHERE users.id = uaa.user_id
  AND users.nivel = 'admin';

INSERT INTO public.user_agent_access (user_id, agent_type, enabled, expires_at)
SELECT users.id, agent.agent_type, TRUE, NULL
FROM public.users users
CROSS JOIN (
  VALUES
    ('comunicacao'),
    ('apresentacao'),
    ('conversas_dificeis'),
    ('postagem')
) AS agent(agent_type)
WHERE users.nivel = 'admin'
ON CONFLICT (user_id, agent_type)
DO UPDATE SET
  enabled = EXCLUDED.enabled,
  expires_at = EXCLUDED.expires_at,
  updated_at = NOW();

COMMIT;

SELECT id, email, nome, nivel, plano, data_expiracao
FROM public.users
WHERE nivel = 'admin'
ORDER BY email;

SELECT users.email, uaa.agent_type, uaa.enabled, uaa.expires_at
FROM public.users users
JOIN public.user_agent_access uaa ON uaa.user_id = users.id
WHERE users.nivel = 'admin'
ORDER BY users.email, uaa.agent_type;
