-- READ ONLY. Schema/permissions and aggregate identity checks only; no secrets or user rows.
BEGIN READ ONLY;
SET LOCAL statement_timeout='20s';
SELECT section, detail::text FROM (
 SELECT '01_identity' AS section, jsonb_build_object(
   'users',(SELECT count(*) FROM public.users),
   'duplicateGroups',(SELECT count(*) FROM (SELECT lower(btrim(email)) FROM public.users WHERE email IS NOT NULL GROUP BY lower(btrim(email)) HAVING count(*)>1) d),
   'emptyEmails',(SELECT count(*) FROM public.users WHERE coalesce(btrim(email),'')=''),
   'testEmailMatches',(SELECT count(*) FROM public.users WHERE lower(btrim(email))='suporte@palmup.com.br'),
   'postgresVersion',current_setting('server_version')) AS detail
 UNION ALL SELECT '02_columns',jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',udt_name,'nullable',is_nullable,'default',CASE WHEN column_name='senha' THEN NULL ELSE column_default END) ORDER BY table_name,ordinal_position)
 FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('users','user_agent_access','password_reset_tokens','email_templates')
 UNION ALL SELECT '03_constraints',jsonb_agg(jsonb_build_object('table',n.nspname||'.'||t.relname,'name',c.conname,'definition',pg_get_constraintdef(c.oid)) ORDER BY n.nspname,t.relname,c.conname)
 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class t ON t.oid=c.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
 WHERE (n.nspname='public' AND t.relname IN ('users','user_agent_access','password_reset_tokens','email_templates')) OR (c.contype='f' AND c.confrelid='public.users'::regclass)
 UNION ALL SELECT '04_rls',jsonb_agg(jsonb_build_object('table',c.relname,'rls',c.relrowsecurity,'forced',c.relforcerowsecurity,'owner',pg_get_userbyid(c.relowner)) ORDER BY c.relname)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN ('users','user_agent_access','password_reset_tokens','email_templates','admin_user_revisions','admin_user_audit','admin_user_invitations')
 UNION ALL SELECT '05_policies',coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.tablename,p.policyname),'[]'::jsonb)
 FROM pg_policies p WHERE schemaname='public' AND tablename IN ('users','user_agent_access','password_reset_tokens','email_templates','admin_user_revisions','admin_user_audit','admin_user_invitations')
 UNION ALL SELECT '06_privileges',jsonb_agg(jsonb_build_object('role',r.rolname,'table',t.relname,'select',has_table_privilege(r.rolname,t.oid,'SELECT'),'insert',has_table_privilege(r.rolname,t.oid,'INSERT'),'update',has_table_privilege(r.rolname,t.oid,'UPDATE'),'delete',has_table_privilege(r.rolname,t.oid,'DELETE'),'schemaUsage',has_schema_privilege(r.rolname,'public','USAGE')) ORDER BY r.rolname,t.relname)
 FROM pg_roles r CROSS JOIN pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE r.rolname IN ('anon','authenticated','service_role') AND n.nspname='public' AND t.relkind='r' AND t.relname IN ('users','user_agent_access','password_reset_tokens','email_templates')
 UNION ALL SELECT '07_triggers',coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'definition',pg_get_triggerdef(t.oid),'function',t.tgfoid::regprocedure::text) ORDER BY c.relname,t.tgname),'[]'::jsonb)
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('users','user_agent_access','password_reset_tokens','email_templates') AND NOT t.tgisinternal
 UNION ALL SELECT '08_objects',jsonb_build_object('revisions',to_regclass('public.admin_user_revisions'),'audit',to_regclass('public.admin_user_audit'),'invitations',to_regclass('public.admin_user_invitations'),'normalizedIndex',to_regclass('public.admin_users_email_normalized_uidx'),'sha256',to_regprocedure('pg_catalog.sha256(bytea)'),'authRole',to_regprocedure('auth.role()'))
 UNION ALL SELECT '09_admin_functions',coalesce(jsonb_agg(jsonb_build_object('name',p.proname,'args',pg_get_function_identity_arguments(p.oid),'securityDefiner',p.prosecdef,'config',p.proconfig,'acl',p.proacl::text) ORDER BY p.proname),'[]'::jsonb)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'admin_users_%'
 UNION ALL SELECT '10_indexes',jsonb_agg(jsonb_build_object('table',tablename,'name',indexname,'definition',indexdef) ORDER BY tablename,indexname)
 FROM pg_indexes WHERE schemaname='public' AND tablename IN ('users','user_agent_access','password_reset_tokens','email_templates')
) audit ORDER BY section;
COMMIT;
