-- Private result: never log, screenshot, or version returned data. Encrypt locally.
-- Recovery scope: four existing source tables affected by the administrative rollout.
BEGIN READ ONLY;
SET LOCAL statement_timeout='40s';
SET LOCAL timezone='UTC';
WITH snapshots AS (
 SELECT 'users' name,coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]'::jsonb) data FROM public.users t
 UNION ALL SELECT 'user_agent_access',coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]'::jsonb) FROM public.user_agent_access t
 UNION ALL SELECT 'password_reset_tokens',coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]'::jsonb) FROM public.password_reset_tokens t
 UNION ALL SELECT 'email_templates',coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]'::jsonb) FROM public.email_templates t
), target_tables AS (
 SELECT c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('users','user_agent_access','password_reset_tokens','email_templates') AND c.relkind='r'
), needed_functions AS (
 SELECT DISTINCT t.tgfoid oid FROM pg_trigger t WHERE t.tgrelid IN (SELECT oid FROM target_tables) AND NOT t.tgisinternal
 UNION SELECT to_regprocedure('auth.role()')::oid UNION SELECT to_regprocedure('auth.uid()')::oid
)
SELECT jsonb_build_object(
 'project','iszynegxctqdfrmizila','timestamp',CURRENT_TIMESTAMP,'postgres',current_setting('server_version'),
 'transactionSnapshot',txid_current_snapshot()::text,
 'tables',(SELECT jsonb_object_agg(name,data) FROM snapshots),
 'counts',(SELECT jsonb_object_agg(name,jsonb_array_length(data)) FROM snapshots),
 'digests',(SELECT jsonb_object_agg(name,md5(data::text)) FROM snapshots),
 'columns',(SELECT jsonb_agg(jsonb_build_object('table',t.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY t.relname,a.attnum) FROM target_tables t JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped LEFT JOIN pg_attrdef d ON d.adrelid=t.oid AND d.adnum=a.attnum),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('table',t.relname,'name',c.conname,'type',c.contype,'definition',pg_get_constraintdef(c.oid)) ORDER BY CASE WHEN c.contype='f' THEN 1 ELSE 0 END,t.relname,c.conname) FROM target_tables t JOIN pg_constraint c ON c.conrelid=t.oid),
 'externalReferences',(SELECT jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'definition',pg_get_constraintdef(c.oid))) FROM pg_constraint c WHERE c.contype='f' AND c.confrelid IN (SELECT oid FROM target_tables) AND c.conrelid NOT IN (SELECT oid FROM target_tables)),
 'indexes',(SELECT coalesce(jsonb_agg(pg_get_indexdef(i.indexrelid)),'[]'::jsonb) FROM pg_index i WHERE i.indrelid IN (SELECT oid FROM target_tables) AND NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conindid=i.indexrelid)),
 'functions',(SELECT jsonb_agg(pg_get_functiondef(oid)) FROM needed_functions WHERE oid IS NOT NULL),
 'triggers',(SELECT coalesce(jsonb_agg(pg_get_triggerdef(t.oid)),'[]'::jsonb) FROM pg_trigger t WHERE t.tgrelid IN (SELECT oid FROM target_tables) AND NOT t.tgisinternal),
 'policies',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename IN (SELECT relname FROM target_tables)),
 'rls',(SELECT jsonb_agg(jsonb_build_object('table',relname,'enabled',relrowsecurity,'forced',relforcerowsecurity)) FROM target_tables),
 'grants',(SELECT jsonb_agg(jsonb_build_object('table',t.relname,'role',CASE WHEN g.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(g.grantee) END,'privilege',g.privilege_type,'grantable',g.is_grantable)) FROM target_tables t CROSS JOIN LATERAL aclexplode(t.relacl) g)
)::text AS private_backup_json;
COMMIT;
