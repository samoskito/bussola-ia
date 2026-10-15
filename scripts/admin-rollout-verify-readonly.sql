BEGIN READ ONLY;
SET LOCAL timezone='UTC';
WITH test AS (SELECT id FROM public.users WHERE lower(btrim(email))='suporte@palmup.com.br'), s AS (
 SELECT 'users' name,coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]'::jsonb) data FROM public.users t WHERE id NOT IN (SELECT id FROM test)
 UNION ALL SELECT 'user_agent_access',coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]'::jsonb) FROM public.user_agent_access t WHERE user_id NOT IN (SELECT id FROM test)
 UNION ALL SELECT 'password_reset_tokens',coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]'::jsonb) FROM public.password_reset_tokens t
 UNION ALL SELECT 'email_templates',coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]'::jsonb) FROM public.email_templates t
) SELECT name,jsonb_array_length(data) count,md5(data::text) digest FROM s ORDER BY name;
SELECT jsonb_build_object(
 'testUsers',(SELECT count(*) FROM public.users WHERE lower(btrim(email))='suporte@palmup.com.br'),
 'ordinaryLevel',(SELECT bool_and(nivel='user') FROM public.users WHERE lower(btrim(email))='suporte@palmup.com.br'),
 'fourEnabledUntil22',(SELECT count(*) FROM public.user_agent_access WHERE user_id IN (SELECT id FROM public.users WHERE lower(btrim(email))='suporte@palmup.com.br') AND enabled AND expires_at='2026-10-22'),
 'auditActions',(SELECT jsonb_agg(action ORDER BY created_at) FROM public.admin_user_audit WHERE user_id IN (SELECT id FROM public.users WHERE lower(btrim(email))='suporte@palmup.com.br')),
 'inviteStates',(SELECT jsonb_agg(jsonb_build_object('action',action,'deliveryStatus',delivery_status,'used',used_at IS NOT NULL,'invalidated',invalidated_at IS NOT NULL,'expiresAt',expires_at) ORDER BY created_at) FROM public.admin_user_invitations WHERE user_id IN (SELECT id FROM public.users WHERE lower(btrim(email))='suporte@palmup.com.br'))
) AS test_summary;
COMMIT;
