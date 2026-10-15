-- PREPARED ONLY. Review and exercise in a disposable PostgreSQL/Supabase instance
-- before application. This migration does not backfill or rewrite source users
-- or grants. UUID users and the existing four-agent migration are prerequisites.
BEGIN;

-- Cross-writer identity protection: n8n/legacy callers do not participate in
-- the panel's advisory locks. Fail safely on existing normalized duplicates;
-- reconciliation is an operator decision, never an automatic merge/delete.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE email IS NOT NULL GROUP BY lower(btrim(email)) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'admin_users:normalized_email_duplicates_require_review';
  END IF;
END $$;
CREATE UNIQUE INDEX admin_users_email_normalized_uidx ON public.users (lower(btrim(email))) WHERE email IS NOT NULL;

CREATE TABLE public.admin_user_revisions (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.admin_user_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  changes jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(changes) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_user_audit_user_created_idx ON public.admin_user_audit(user_id, created_at DESC, id);
ALTER TABLE public.admin_user_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_user_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_user_revisions, public.admin_user_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.admin_user_revisions TO service_role;
GRANT SELECT, INSERT ON public.admin_user_audit TO service_role;

-- Helpers are deliberately not exposed to ordinary authenticated JWTs. The
-- application verifies its own JWT first; SQL rechecks the actor's current role.
CREATE FUNCTION public.admin_users_assert_admin(p_actor uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_actor IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'admin_users:forbidden', ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.users WHERE id = p_actor AND nivel = 'admin' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:forbidden', ERRCODE = 'P0001'; END IF;
END;
$$;

-- Lock the parent first, then grants in stable order. Parent FOR UPDATE also
-- conflicts with FK key-share checks for new grants inserted by other writers.
CREATE FUNCTION public.admin_users_lock(p_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM 1 FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:not_found', ERRCODE = 'P0001'; END IF;
  PERFORM 1 FROM public.user_agent_access WHERE user_id = p_user_id ORDER BY agent_type FOR UPDATE;
END;
$$;

-- Opaque optimistic token includes the complete current source row (including
-- password changes), every grant and the separate admin-operation version.
-- External n8n changes are detected without adding columns/triggers to users.
CREATE FUNCTION public.admin_users_revision(p_user_id uuid) RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT md5(jsonb_build_object(
    'user', to_jsonb(u),
    'grants', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.agent_type) FROM public.user_agent_access a WHERE a.user_id = u.id), '[]'::jsonb),
    'version', COALESCE((SELECT r.version FROM public.admin_user_revisions r WHERE r.user_id = u.id), 0)
  )::text) FROM public.users u WHERE u.id = p_user_id;
$$;

-- This view returns only the explicit public administrative fields. No password
-- hash, invitation token/hash, reset token or raw source row is returned.
CREATE FUNCTION public.admin_users_view(p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_user_json jsonb;
  v_grants jsonb;
  v_version bigint;
  v_today date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
  v_access jsonb;
  v_status text;
  v_invite jsonb := jsonb_build_object('status', 'none', 'expiresAt', NULL);
BEGIN
  -- Capture the exact displayed source and revision ingredients together. A
  -- separate later revision query could acknowledge concurrent unseen edits.
  SELECT to_jsonb(u),
    COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.agent_type) FROM public.user_agent_access a WHERE a.user_id = u.id), '[]'::jsonb),
    COALESCE((SELECT r.version FROM public.admin_user_revisions r WHERE r.user_id = u.id), 0)
  INTO v_user_json, v_grants, v_version FROM public.users u WHERE u.id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:not_found', ERRCODE = 'P0001'; END IF;
  v_user := jsonb_populate_record(NULL::public.users, v_user_json);
  SELECT jsonb_agg(jsonb_build_object(
    'agentType', x.agent_type,
    'enabled', COALESCE(v_user.nivel = 'admin', false) OR COALESCE(v_user.plano IN ('Todas', 'Ambas'), false) OR COALESCE(a.enabled, false),
    'expiresAt', CASE WHEN v_user.nivel = 'admin' THEN NULL WHEN v_user.plano IN ('Todas', 'Ambas') THEN v_user.data_expiracao::date ELSE least(v_user.data_expiracao::date, a.expires_at) END,
    'effective', COALESCE(v_user.nivel = 'admin', false) OR (
      (v_user.data_expiracao IS NULL OR v_user.data_expiracao::date >= v_today)
      AND (COALESCE(v_user.plano IN ('Todas', 'Ambas'), false) OR (COALESCE(a.enabled, false) AND (a.expires_at IS NULL OR a.expires_at >= v_today)))
    ),
    'source', CASE WHEN v_user.nivel = 'admin' THEN 'admin' WHEN v_user.plano IN ('Todas', 'Ambas') THEN 'global' WHEN a.enabled THEN 'individual' ELSE 'none' END
  ) ORDER BY x.ordinal)
  INTO v_access
  FROM (VALUES ('comunicacao', 1), ('apresentacao', 2), ('conversas_dificeis', 3), ('postagem', 4)) AS x(agent_type, ordinal)
  LEFT JOIN jsonb_to_recordset(v_grants) AS a(agent_type text, enabled boolean, expires_at date) ON a.agent_type = x.agent_type;
  v_status := CASE
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(v_access) a WHERE (a->>'effective')::boolean) THEN 'active'
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(v_access) a WHERE (a->>'enabled')::boolean) THEN 'expired'
    ELSE 'none' END;
  -- The later invitation migration is optional for read/profile/access. Dynamic
  -- SQL keeps this additive migration independent of its installation order.
  IF to_regclass('public.admin_user_invitations') IS NOT NULL THEN
    EXECUTE $invite$
      SELECT jsonb_build_object('status', CASE
        WHEN used_at IS NOT NULL THEN 'consumed'
        WHEN invalidated_at IS NOT NULL THEN 'none'
        WHEN expires_at <= CURRENT_TIMESTAMP THEN 'expired'
        WHEN delivery_status = 'sent' THEN 'sent'
        WHEN delivery_status = 'failed' THEN 'send_failed'
        ELSE 'generated' END, 'expiresAt', expires_at)
      FROM public.admin_user_invitations WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1
    $invite$ INTO v_invite USING p_user_id;
  END IF;
  RETURN jsonb_build_object(
    'id', v_user.id, 'nome', COALESCE(v_user.nome, ''), 'email', v_user.email,
    'telefone', v_user.telefone, 'nivel', CASE WHEN v_user.nivel = 'admin' THEN 'admin' ELSE 'user' END,
    'plano', v_user.plano, 'data_expiracao', v_user.data_expiracao::date,
    'revision', md5(jsonb_build_object('user', v_user_json, 'grants', v_grants, 'version', v_version)::text), 'status', v_status, 'access', v_access,
    'createdAt', COALESCE(to_jsonb(v_user)->>'created_at', ''),
    'invite', COALESCE(v_invite, jsonb_build_object('status', 'none', 'expiresAt', NULL))
  );
END;
$$;

CREATE FUNCTION public.admin_users_read(p_actor uuid, p_user_id uuid DEFAULT NULL, p_filters jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_q text; v_agent text; v_status text; v_page integer; v_size integer;
  v_total bigint; v_users jsonb;
BEGIN
  PERFORM public.admin_users_assert_admin(p_actor);
  IF p_user_id IS NOT NULL THEN RETURN public.admin_users_view(p_user_id); END IF;
  IF p_filters IS NULL OR jsonb_typeof(p_filters) <> 'object' OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_filters) k WHERE k NOT IN ('q', 'agentType', 'status', 'page', 'pageSize')) THEN
    RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001';
  END IF;
  v_q := btrim(COALESCE(p_filters->>'q', ''));
  v_agent := COALESCE(p_filters->>'agentType', ''); v_status := COALESCE(p_filters->>'status', '');
  IF length(v_q) > 200 OR v_agent NOT IN ('', 'comunicacao', 'apresentacao', 'conversas_dificeis', 'postagem') OR v_status NOT IN ('', 'active', 'expired', 'none')
    OR COALESCE(p_filters->>'page', '1') !~ '^[1-9][0-9]{0,6}$' OR COALESCE(p_filters->>'pageSize', '10') !~ '^[1-9][0-9]{0,2}$' THEN
    RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001';
  END IF;
  v_page := COALESCE(p_filters->>'page', '1')::integer; v_size := COALESCE(p_filters->>'pageSize', '10')::integer;
  IF v_page > 1000000 OR v_size > 100 THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001'; END IF;
  -- A single statement gives counts and the page one consistent MVCC snapshot.
  WITH matching AS MATERIALIZED (
    SELECT u.id, public.admin_users_view(u.id) AS item
    FROM public.users u
    WHERE v_q = '' OR strpos(lower(COALESCE(u.nome, '')), lower(v_q)) > 0
      OR strpos(lower(u.email), lower(v_q)) > 0 OR strpos(COALESCE(u.telefone, ''), v_q) > 0
      OR strpos(regexp_replace(COALESCE(u.telefone, ''), '[^0-9]', '', 'g'), v_q) > 0
  ), filtered AS MATERIALIZED (
    SELECT * FROM matching m WHERE (v_status = '' OR m.item->>'status' = v_status)
      AND (v_agent = '' OR EXISTS (SELECT 1 FROM jsonb_array_elements(m.item->'access') a WHERE a->>'agentType' = v_agent AND (a->>'effective')::boolean))
  ), selected AS (
    SELECT * FROM filtered ORDER BY lower(item->>'nome'), id LIMIT v_size OFFSET (v_page - 1) * v_size
  )
  SELECT (SELECT count(*) FROM filtered), COALESCE((SELECT jsonb_agg(item ORDER BY lower(item->>'nome'), id) FROM selected), '[]'::jsonb)
  INTO v_total, v_users;
  RETURN jsonb_build_object('mode', 'live', 'users', v_users, 'total', v_total, 'page', v_page, 'pageSize', v_size, 'totalPages', greatest(1, ceil(v_total::numeric / v_size)::integer));
END;
$$;

CREATE FUNCTION public.admin_users_mutate(
  p_actor uuid, p_operation text, p_user_id uuid DEFAULT NULL,
  p_expected_revision text DEFAULT NULL, p_input jsonb DEFAULT '{}'::jsonb,
  p_password_hash text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := p_user_id; v_user public.users%ROWTYPE;
  v_allowed text[]; v_reason text; v_email text; v_nome text; v_phone text;
  v_agents text[] := ARRAY[]::text[]; v_expires date; v_today date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
  v_entry jsonb; v_previous jsonb;
  v_before jsonb; v_after jsonb; v_changes jsonb; v_action text; v_email_changed boolean := false;
BEGIN
  PERFORM public.admin_users_assert_admin(p_actor);
  IF p_operation IS NULL OR p_operation NOT IN ('create', 'profile', 'access') OR p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001';
  END IF;
  v_allowed := CASE p_operation WHEN 'create' THEN ARRAY['nome','email','telefone','agentTypes','expiresAt','reason'] WHEN 'profile' THEN ARRAY['nome','email','telefone','reason'] ELSE ARRAY['access','reason'] END;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_input) k WHERE NOT (k = ANY(v_allowed))) THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001'; END IF;
  v_reason := btrim(p_input->>'reason');
  IF jsonb_typeof(p_input->'reason') IS DISTINCT FROM 'string' OR v_reason IS NULL OR length(v_reason) NOT BETWEEN 1 AND 500 OR v_reason ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001';
  END IF;
  IF p_operation = 'create' OR p_input ? 'nome' THEN
    v_nome := btrim(p_input->>'nome');
    IF jsonb_typeof(p_input->'nome') IS DISTINCT FROM 'string' OR length(v_nome) NOT BETWEEN 1 AND 150 OR v_nome ~ '[[:cntrl:]]' THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001'; END IF;
  END IF;
  IF p_operation = 'create' OR p_input ? 'email' THEN
    v_email := lower(btrim(p_input->>'email'));
    IF jsonb_typeof(p_input->'email') IS DISTINCT FROM 'string' OR length(v_email) NOT BETWEEN 3 AND 254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR v_email ~ '[[:cntrl:]]' THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001'; END IF;
  END IF;
  IF p_input ? 'telefone' AND p_input->'telefone' <> 'null'::jsonb THEN
    v_phone := NULLIF(btrim(p_input->>'telefone'), '');
    IF jsonb_typeof(p_input->'telefone') <> 'string' OR (v_phone IS NOT NULL AND (length(v_phone) NOT BETWEEN 5 AND 30 OR v_phone !~ '^[+0-9 ().-]+$' OR v_phone ~ '[[:cntrl:]]')) THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001'; END IF;
  END IF;
  IF p_operation = 'create' THEN
    IF jsonb_typeof(p_input->'agentTypes') IS DISTINCT FROM 'array' OR jsonb_array_length(p_input->'agentTypes') > 4
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_input->'agentTypes') a WHERE jsonb_typeof(a) <> 'string' OR a#>>'{}' NOT IN ('comunicacao','apresentacao','conversas_dificeis','postagem')) THEN
      RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001';
    END IF;
    SELECT COALESCE(array_agg(a), ARRAY[]::text[]) INTO v_agents FROM jsonb_array_elements_text(p_input->'agentTypes') a;
    IF cardinality(v_agents) <> (SELECT count(DISTINCT x) FROM unnest(v_agents) x) OR NOT (p_input ? 'expiresAt') THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001'; END IF;
    IF p_input->'expiresAt' <> 'null'::jsonb THEN
      IF jsonb_typeof(p_input->'expiresAt') <> 'string' OR p_input->>'expiresAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001'; END IF;
      BEGIN v_expires := (p_input->>'expiresAt')::date;
      EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001'; END;
      IF to_char(v_expires, 'YYYY-MM-DD') <> p_input->>'expiresAt' OR (cardinality(v_agents) > 0 AND v_expires < v_today) THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001'; END IF;
    END IF;
  END IF;

  IF p_operation = 'access' THEN
    IF jsonb_typeof(p_input->'access') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001'; END IF;
    IF jsonb_array_length(p_input->'access') <> 4 THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001'; END IF;
    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_input->'access') LOOP
      IF jsonb_typeof(v_entry) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001'; END IF;
      IF NOT (v_entry ?& ARRAY['agentType','enabled','expiresAt'])
        OR EXISTS (SELECT 1 FROM jsonb_object_keys(v_entry) k WHERE k NOT IN ('agentType','enabled','expiresAt'))
        OR jsonb_typeof(v_entry->'agentType') IS DISTINCT FROM 'string'
        OR v_entry->>'agentType' NOT IN ('comunicacao','apresentacao','conversas_dificeis','postagem')
        OR jsonb_typeof(v_entry->'enabled') IS DISTINCT FROM 'boolean' THEN
        RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001';
      END IF;
      IF v_entry->'expiresAt' <> 'null'::jsonb THEN
        IF jsonb_typeof(v_entry->'expiresAt') <> 'string' OR v_entry->>'expiresAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001'; END IF;
        BEGIN v_expires := (v_entry->>'expiresAt')::date;
        EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001'; END;
        IF to_char(v_expires, 'YYYY-MM-DD') <> v_entry->>'expiresAt' THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001'; END IF;
      END IF;
    END LOOP;
    IF (SELECT count(DISTINCT a->>'agentType') FROM jsonb_array_elements(p_input->'access') a) <> 4 THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001'; END IF;
  END IF;

  IF p_operation = 'create' THEN
    IF p_user_id IS NOT NULL OR p_expected_revision IS NOT NULL OR p_password_hash IS NULL OR p_password_hash !~ '^\$2[aby]\$12\$[./A-Za-z0-9]{53}$' THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001'; END IF;
    v_id := gen_random_uuid();
  ELSE
    IF p_user_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision !~ '^[a-f0-9]{32}$' OR p_password_hash IS NOT NULL THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001'; END IF;
    PERFORM public.admin_users_lock(v_id);
    SELECT * INTO v_user FROM public.users WHERE id = v_id;
    IF v_user.nivel = 'admin' THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:admin_target_locked', ERRCODE = 'P0001'; END IF;
    IF public.admin_users_revision(v_id) IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:revision_conflict', ERRCODE = 'P0001'; END IF;
    v_before := public.admin_users_view(v_id);
  END IF;
  IF v_email IS NOT NULL THEN
    -- Serializes normalized-email checks for all panel callers; no global
    -- uniqueness-index build or rewrite against unknown legacy duplicates.
    PERFORM pg_advisory_xact_lock(hashtextextended('admin-users-email:' || v_email, 0));
    IF EXISTS (SELECT 1 FROM public.users WHERE lower(btrim(email)) = v_email AND id <> v_id) THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:duplicate_email', ERRCODE = 'P0001'; END IF;
  END IF;

  IF p_operation = 'create' THEN
    INSERT INTO public.users(id, nome, email, telefone, senha, nivel, plano, data_expiracao)
    VALUES(v_id, v_nome, v_email, v_phone, p_password_hash, 'user', CASE WHEN cardinality(v_agents) > 0 THEN 'Personalizado' ELSE NULL END, NULL);
    INSERT INTO public.user_agent_access(user_id, agent_type, enabled, expires_at)
    SELECT v_id, x, x = ANY(v_agents), CASE WHEN x = ANY(v_agents) THEN v_expires ELSE NULL END
    FROM unnest(ARRAY['comunicacao','apresentacao','conversas_dificeis','postagem']) x;
    v_action := 'created';
    -- No redundant PII in audit: the source remains users, with explicit fields
    -- and access decisions kept for operational accountability.
    v_changes := jsonb_build_object('fields', ARRAY['nome','email','telefone'], 'agentTypes', v_agents, 'expiresAt', v_expires);
  ELSIF p_operation = 'profile' THEN
    IF NOT (p_input ?| ARRAY['nome','email','telefone']) THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001'; END IF;
    v_email_changed := p_input ? 'email' AND v_user.email IS DISTINCT FROM v_email;
    UPDATE public.users SET
      nome = CASE WHEN p_input ? 'nome' THEN v_nome ELSE nome END,
      email = CASE WHEN p_input ? 'email' THEN v_email ELSE email END,
      telefone = CASE WHEN p_input ? 'telefone' THEN v_phone ELSE telefone END
    WHERE id = v_id;
    IF v_email_changed AND to_regclass('public.admin_user_invitations') IS NOT NULL THEN
      EXECUTE 'UPDATE public.admin_user_invitations SET invalidated_at = now() WHERE user_id = $1 AND used_at IS NULL AND invalidated_at IS NULL' USING v_id;
    END IF;
    v_action := 'profile_updated';
    v_changes := jsonb_build_object('fields', (SELECT jsonb_agg(k ORDER BY k) FROM jsonb_object_keys(p_input) k WHERE k <> 'reason'), 'invitationInvalidated', v_email_changed);
  ELSE
    -- Preserve existing expired entitlements, but do not grant a new expired
    -- entitlement. Compare with the locked, displayed state (including caps).
    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_input->'access') LOOP
      SELECT a INTO v_previous FROM jsonb_array_elements(v_before->'access') a WHERE a->>'agentType' = v_entry->>'agentType';
      IF (v_entry->>'enabled')::boolean AND (v_entry->>'expiresAt')::date < v_today
        AND (NOT (v_previous->>'enabled')::boolean OR v_entry->'expiresAt' IS DISTINCT FROM v_previous->'expiresAt') THEN
        RAISE EXCEPTION USING MESSAGE = 'admin_users:invalid_input', ERRCODE = 'P0001';
      END IF;
    END LOOP;
    UPDATE public.users SET plano = 'Personalizado', data_expiracao = NULL
      WHERE id = v_id AND (plano IS DISTINCT FROM 'Personalizado' OR data_expiracao IS NOT NULL);
    -- The complete DTO carries the global entitlement when converting Todas/
    -- Ambas and the minimum global/individual cap for other plans. Only actual
    -- changes touch grant timestamps; IDs and other columns remain intact.
    INSERT INTO public.user_agent_access(user_id, agent_type, enabled, expires_at)
    SELECT v_id, a->>'agentType', (a->>'enabled')::boolean, (a->>'expiresAt')::date
    FROM jsonb_array_elements(p_input->'access') a
    ON CONFLICT (user_id, agent_type) DO UPDATE SET enabled = EXCLUDED.enabled, expires_at = EXCLUDED.expires_at, updated_at = now()
      WHERE public.user_agent_access.enabled IS DISTINCT FROM EXCLUDED.enabled
        OR public.user_agent_access.expires_at IS DISTINCT FROM EXCLUDED.expires_at;
    v_action := 'access_updated';
    v_changes := jsonb_build_object('before', jsonb_build_object('plano', v_before->'plano', 'data_expiracao', v_before->'data_expiracao', 'access', v_before->'access'), 'after', jsonb_build_object('plano', 'Personalizado', 'data_expiracao', NULL, 'access', p_input->'access'));
  END IF;
  -- The legacy recovery flow binds its tokens to email rather than user UUID.
  -- Never let pending tokens follow an email that is newly assigned/reassigned.
  -- This invalidates stored tokens; the legacy nontransactional consumer still
  -- needs a separate concurrency review before the real admin rollout.
  IF (p_operation = 'create' OR v_email_changed) AND to_regclass('public.password_reset_tokens') IS NOT NULL THEN
    EXECUTE 'UPDATE public.password_reset_tokens SET used_at = clock_timestamp() WHERE used_at IS NULL AND lower(btrim(email)) = ANY($1)'
      USING ARRAY[v_email, CASE WHEN v_email_changed THEN lower(btrim(v_user.email)) ELSE NULL END]::text[];
  END IF;
  INSERT INTO public.admin_user_revisions(user_id, version) VALUES(v_id, 1)
  ON CONFLICT (user_id) DO UPDATE SET version = public.admin_user_revisions.version + 1, updated_at = now();
  INSERT INTO public.admin_user_audit(user_id, actor_id, action, reason, changes) VALUES(v_id, p_actor, v_action, v_reason, v_changes);
  v_after := public.admin_users_view(v_id);
  RETURN v_after;
END;
$$;

CREATE FUNCTION public.admin_users_audit_read(p_actor uuid, p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_events jsonb;
BEGIN
  PERFORM public.admin_users_assert_admin(p_actor);
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:not_found', ERRCODE = 'P0001'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', e.id, 'userId', e.user_id, 'actor', COALESCE(e.actor_id::text, 'administrador removido'), 'action', e.action, 'reason', e.reason, 'createdAt', e.created_at, 'changes', e.changes) ORDER BY e.created_at DESC, e.id DESC), '[]'::jsonb)
  INTO v_events FROM (SELECT * FROM public.admin_user_audit WHERE user_id = p_user_id ORDER BY created_at DESC, id DESC LIMIT 200) e;
  RETURN v_events;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_users_assert_admin(uuid), public.admin_users_lock(uuid), public.admin_users_revision(uuid), public.admin_users_view(uuid), public.admin_users_read(uuid,uuid,jsonb), public.admin_users_mutate(uuid,text,uuid,text,jsonb,text), public.admin_users_audit_read(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_users_assert_admin(uuid), public.admin_users_lock(uuid), public.admin_users_revision(uuid), public.admin_users_view(uuid), public.admin_users_read(uuid,uuid,jsonb), public.admin_users_mutate(uuid,text,uuid,text,jsonb,text), public.admin_users_audit_read(uuid,uuid) TO service_role;

COMMENT ON TABLE public.admin_user_revisions IS 'Separate administrative mutation version. Optimistic tokens also hash current users/grants to detect external updates.';
COMMENT ON TABLE public.admin_user_audit IS 'Service-only minimal audit; never store passwords, invitation secrets or full webhook payloads.';
COMMIT;
