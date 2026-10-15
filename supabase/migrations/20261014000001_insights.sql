-- REVIEW ONLY: local implementation has not applied this migration.
-- Additive schema; no source messages or user records are changed.
-- Types match the audited public schema: users/chats UUID, scripts integer.
-- Source text/context and credentials must never be persisted in these tables.
BEGIN;

CREATE TABLE IF NOT EXISTS public.insights_taxonomies (
  version text PRIMARY KEY CHECK (char_length(version) BETWEEN 1 AND 100),
  topics jsonb NOT NULL CHECK (jsonb_typeof(topics) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.insight_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Per-source queue contract: InsightJob.key/sourceId/userId/sourceHash.
  job_key text NOT NULL UNIQUE CHECK (char_length(job_key) BETWEEN 1 AND 200),
  script_id integer NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_hash text NOT NULL CHECK (source_hash = '' OR source_hash ~ '^[0-9a-f]{64}$'),
  taxonomy_version text REFERENCES public.insights_taxonomies(version),
  classifier_version text CHECK (char_length(classifier_version) BETWEEN 1 AND 100),
  status text NOT NULL CHECK (status IN ('processing', 'completed', 'retry', 'failed')),
  provider text NOT NULL DEFAULT 'mock' CHECK (provider IN ('mock', 'openai')),
  model text CHECK (char_length(model) <= 100),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  next_attempt_at timestamptz,
  lock_token uuid,
  locked_until timestamptz,
  input_tokens bigint NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens bigint NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  -- Optional per-job cost metadata. The shared cap is enforced separately by
  -- insights_budgets and the atomic reservation RPCs below.
  budget_scope text CHECK (budget_scope ~ '^[a-zA-Z0-9_.:-]{1,80}$'),
  reserved_cost_usd numeric(12,6) NOT NULL DEFAULT 0 CHECK (reserved_cost_usd >= 0),
  estimated_cost_usd numeric(12,6) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  budget_limit_usd numeric(12,6) NOT NULL DEFAULT 0 CHECK (budget_limit_usd >= 0),
  -- Bounded machine-readable error code only; never exception bodies/raw text.
  error_code text CHECK (error_code ~ '^[a-z0-9_]{1,80}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_hash <> '' OR (status = 'failed' AND error_code = 'input_rejected')),
  CHECK (status <> 'processing' OR (lock_token IS NOT NULL AND locked_until IS NOT NULL)),
  UNIQUE (script_id, taxonomy_version, classifier_version, source_hash)
);

CREATE TABLE IF NOT EXISTS public.script_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id integer NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.insight_jobs(id) ON DELETE SET NULL,
  agent_type text NOT NULL CHECK (agent_type IN ('comunicacao', 'apresentacao', 'conversas_dificeis', 'postagem')),
  source_created_at timestamptz NOT NULL,
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  taxonomy_version text NOT NULL REFERENCES public.insights_taxonomies(version),
  classifier_version text NOT NULL CHECK (char_length(classifier_version) BETWEEN 1 AND 100),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'classified', 'failed')),
  message_kind text CHECK (message_kind IN ('initial_request', 'question', 'context', 'refinement', 'confirmation', 'unclassifiable')),
  topic_ids text[] NOT NULL DEFAULT '{}',
  -- Minimized derived description; still sensitive, never a copy of input/context.
  normalized_demand text CHECK (char_length(normalized_demand) <= 500),
  confidence numeric(4,3) CHECK (confidence BETWEEN 0 AND 1),
  needs_review boolean NOT NULL DEFAULT true,
  provider text NOT NULL CHECK (provider IN ('mock', 'openai')),
  model text CHECK (char_length(model) <= 100),
  error_code text CHECK (error_code ~ '^[a-z0-9_]{1,80}$'),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (script_id, taxonomy_version, classifier_version, source_hash),
  CHECK (status <> 'classified' OR (message_kind IS NOT NULL AND normalized_demand IS NOT NULL AND confidence IS NOT NULL AND processed_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.insights_budgets (
  scope text PRIMARY KEY CHECK (scope ~ '^[a-zA-Z0-9_.:-]{1,80}$'),
  reserved_usd numeric(12,6) NOT NULL DEFAULT 0 CHECK (reserved_usd >= 0),
  cap_usd numeric(12,6) NOT NULL CHECK (cap_usd >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reserved_usd <= cap_usd)
);

-- Versioned configuration only; no original conversation/user data is seeded.
INSERT INTO public.insights_taxonomies(version,topics) VALUES('2026-10-14.v1',
  '[{"id":"comunicacao_clara","label":"Comunicação clara","description":"Clareza, concisão e adequação da mensagem ao público."},
    {"id":"feedback","label":"Feedback","description":"Preparação de feedback de desempenho e desenvolvimento."},
    {"id":"conflitos","label":"Conflitos e conversas sensíveis","description":"Negociação, limites e resolução de conflitos."},
    {"id":"resultados","label":"Apresentação de resultados","description":"Indicadores, reuniões de resultados e explicação de desvios."},
    {"id":"narrativa_executiva","label":"Narrativa executiva","description":"Estrutura, argumentação e histórias para decisões."},
    {"id":"posicionamento_linkedin","label":"Posicionamento no LinkedIn","description":"Conteúdo profissional, autoridade e posicionamento."},
    {"id":"lideranca","label":"Liderança e equipe","description":"Alinhamento, delegação e comunicação com equipes."},
    {"id":"outros","label":"Outros temas","description":"Demandas sem correspondência nas categorias atuais."}]'::jsonb)
ON CONFLICT(version) DO NOTHING;

CREATE INDEX IF NOT EXISTS script_insights_window_agent_idx ON public.script_insights (taxonomy_version, classifier_version, source_created_at, agent_type);
CREATE INDEX IF NOT EXISTS script_insights_owner_idx ON public.script_insights (user_id);
CREATE INDEX IF NOT EXISTS script_insights_chat_idx ON public.script_insights (chat_id);
CREATE INDEX IF NOT EXISTS script_insights_topics_idx ON public.script_insights USING gin (topic_ids);
CREATE INDEX IF NOT EXISTS script_insights_status_idx ON public.script_insights (status, source_created_at);
CREATE INDEX IF NOT EXISTS insight_jobs_queue_idx ON public.insight_jobs (status, locked_until, created_at);
CREATE INDEX IF NOT EXISTS insight_jobs_retry_idx ON public.insight_jobs (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS insight_jobs_owner_idx ON public.insight_jobs (user_id);
CREATE INDEX IF NOT EXISTS insight_jobs_budget_idx ON public.insight_jobs (budget_scope);

ALTER TABLE public.insights_taxonomies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insight_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights_budgets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.insights_taxonomies, public.insight_jobs, public.script_insights, public.insights_budgets FROM anon, authenticated;
GRANT ALL ON public.insights_taxonomies, public.insight_jobs, public.script_insights, public.insights_budgets TO service_role;

CREATE POLICY insights_taxonomies_service_only ON public.insights_taxonomies FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY insight_jobs_service_only ON public.insight_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY script_insights_service_only ON public.script_insights FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY insights_budgets_service_only ON public.insights_budgets FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Every RPC uses a fixed search path, explicit service-role check and bounded
-- machine-readable errors. Source text is never returned or recorded here.
CREATE OR REPLACE FUNCTION public.insights_claim_job(
  p_job_key text, p_script_id integer, p_user_id uuid, p_source_hash text,
  p_taxonomy_version text, p_classifier_version text, p_now timestamptz,
  p_lock_ms integer, p_max_attempts integer,
  p_provider text DEFAULT 'openai', p_model text DEFAULT 'gpt-6-luna'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE j public.insight_jobs%ROWTYPE; lease_token uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE insufficient_privilege; END IF;
  IF p_now IS NULL OR p_lock_ms NOT BETWEEN 1000 AND 300000 OR p_max_attempts NOT BETWEEN 1 AND 10
    OR p_source_hash !~ '^[0-9a-f]{64}$' OR p_job_key <> p_script_id::text || ':' || p_source_hash
    OR p_classifier_version IS NULL OR p_taxonomy_version IS NULL
    OR p_provider NOT IN ('mock','openai') OR p_model IS NULL OR char_length(p_model) NOT BETWEEN 1 AND 100
    THEN RAISE EXCEPTION 'invalid_claim_parameters'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.scripts s JOIN public.chats c ON c.id=s.chatid
    JOIN public.users u ON u.id=s.user_id WHERE s.id=p_script_id AND s.user_id=p_user_id
    AND c.user_id=p_user_id AND u.nivel='user') THEN
    RETURN jsonb_build_object('state','failed');
  END IF;
  INSERT INTO public.insight_jobs(job_key,script_id,user_id,source_hash,taxonomy_version,classifier_version,
    status,attempts,max_attempts,lock_token,locked_until,provider,model)
  VALUES(p_job_key,p_script_id,p_user_id,p_source_hash,p_taxonomy_version,p_classifier_version,
    'retry',0,p_max_attempts,NULL,NULL,p_provider,p_model) ON CONFLICT(job_key) DO NOTHING;
  SELECT * INTO j FROM public.insight_jobs WHERE job_key=p_job_key FOR UPDATE;
  IF j.script_id <> p_script_id OR j.user_id <> p_user_id OR j.source_hash <> p_source_hash
    OR j.taxonomy_version <> p_taxonomy_version OR j.classifier_version <> p_classifier_version
    OR j.provider<>p_provider OR j.model IS DISTINCT FROM p_model
    THEN RAISE EXCEPTION 'claim_identity_mismatch'; END IF;
  IF j.status='completed' THEN
    IF EXISTS(SELECT 1 FROM public.script_insights i WHERE i.script_id=j.script_id
      AND i.status='classified' AND i.source_hash=j.source_hash AND i.taxonomy_version=j.taxonomy_version
      AND i.classifier_version=j.classifier_version) THEN RETURN jsonb_build_object('state','completed'); END IF;
    -- A source can revert to an earlier hash after another version replaced its
    -- active result. Historical job completion alone must not suppress recovery.
    UPDATE public.insight_jobs SET status='retry',attempts=0,next_attempt_at=NULL,
      finished_at=NULL,updated_at=p_now WHERE id=j.id;
    j.status:='retry'; j.attempts:=0; j.next_attempt_at:=NULL;
  END IF;
  IF j.status='failed' THEN RETURN jsonb_build_object('state','failed'); END IF;
  IF j.status='processing' AND j.locked_until>clock_timestamp() THEN RETURN jsonb_build_object('state','locked'); END IF;
  IF j.attempts>=LEAST(j.max_attempts,p_max_attempts) THEN
    UPDATE public.insight_jobs SET status='failed',lock_token=NULL,locked_until=NULL,updated_at=p_now WHERE id=j.id;
    RETURN jsonb_build_object('state','failed');
  END IF;
  IF j.status='retry' AND j.next_attempt_at>p_now THEN RETURN jsonb_build_object('state','waiting'); END IF;
  lease_token := gen_random_uuid();
  UPDATE public.insight_jobs SET status='processing',attempts=attempts+1,
    max_attempts=LEAST(max_attempts,p_max_attempts),lock_token=lease_token,
    locked_until=p_now+make_interval(secs=>p_lock_ms/1000.0),next_attempt_at=NULL,
    error_code=NULL,started_at=COALESCE(started_at,p_now),updated_at=p_now WHERE id=j.id;
  RETURN jsonb_build_object('state','claimed','token',lease_token);
END $$;

CREATE OR REPLACE FUNCTION public.insights_complete_job(
  p_job_key text, p_lock_token uuid, p_classification jsonb, p_processed_at timestamptz,
  p_usage jsonb, p_agent_type text, p_chat_id uuid, p_created_at timestamptz
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE j public.insight_jobs%ROWTYPE; source_agent text; source_chat uuid; source_date timestamptz; topics text[];
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE insufficient_privilege; END IF;
  SELECT * INTO j FROM public.insight_jobs WHERE job_key=p_job_key FOR UPDATE;
  IF NOT FOUND OR j.status<>'processing' OR j.lock_token IS DISTINCT FROM p_lock_token
    OR p_processed_at IS NULL OR j.locked_until<clock_timestamp() THEN RETURN false; END IF;
  -- Hold the user row until transaction completion so a concurrent role change
  -- cannot leave an administrative user's new derived result committed.
  PERFORM 1 FROM public.users WHERE id=j.user_id AND nivel='user' FOR SHARE;
  IF NOT FOUND THEN
    DELETE FROM public.script_insights WHERE user_id=j.user_id;
    UPDATE public.insight_jobs SET status='failed',error_code='user_excluded',lock_token=NULL,locked_until=NULL,updated_at=p_processed_at WHERE id=j.id;
    RETURN false;
  END IF;
  SELECT COALESCE(c.agent_type,'comunicacao'),c.id,s.created_at INTO source_agent,source_chat,source_date
    FROM public.scripts s JOIN public.chats c ON c.id=s.chatid
    WHERE s.id=j.script_id AND s.user_id=j.user_id AND c.user_id=j.user_id FOR SHARE OF s,c;
  IF NOT FOUND OR source_chat IS DISTINCT FROM p_chat_id OR source_agent IS DISTINCT FROM p_agent_type
    OR source_date IS DISTINCT FROM p_created_at THEN RETURN false; END IF;
  IF jsonb_typeof(p_classification) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_classification->'topicIds') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_classification->'topicIds')>3
    OR jsonb_typeof(p_classification->'kind') IS DISTINCT FROM 'string'
    OR p_classification->>'kind' NOT IN ('initial_request','question','context','refinement','confirmation','unclassifiable')
    OR jsonb_typeof(p_classification->'normalizedDemand') IS DISTINCT FROM 'string'
    OR char_length(p_classification->>'normalizedDemand') NOT BETWEEN 1 AND 500
    OR jsonb_typeof(p_classification->'confidence') IS DISTINCT FROM 'number'
    OR (p_classification->>'confidence')::numeric NOT BETWEEN 0 AND 1
    OR jsonb_typeof(p_classification->'needsReview') IS DISTINCT FROM 'boolean'
    THEN RAISE EXCEPTION 'invalid_classification'; END IF;
  SELECT COALESCE(array_agg(value),ARRAY[]::text[]) INTO topics FROM jsonb_array_elements_text(p_classification->'topicIds');
  IF cardinality(topics)<>(SELECT count(DISTINCT topic) FROM unnest(topics) topic)
    OR (p_classification->>'kind'='unclassifiable' AND cardinality(topics)<>0)
    OR (p_classification->>'kind'<>'unclassifiable' AND cardinality(topics)=0)
    THEN RAISE EXCEPTION 'invalid_topic_cardinality'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(topics) topic WHERE NOT EXISTS(
    SELECT 1 FROM public.insights_taxonomies t, jsonb_array_elements(t.topics) definition
    WHERE t.version=j.taxonomy_version AND definition->>'id'=topic))
    THEN RAISE EXCEPTION 'invalid_topic'; END IF;
  -- Serialize all hash/version completions for one source; one active result is
  -- persisted, so reads never combine old and new versions into double counts.
  PERFORM pg_advisory_xact_lock(71014,j.script_id);
  DELETE FROM public.script_insights WHERE script_id=j.script_id;
  INSERT INTO public.script_insights(script_id,user_id,chat_id,job_id,agent_type,source_created_at,
    source_hash,taxonomy_version,classifier_version,status,message_kind,topic_ids,normalized_demand,
    confidence,needs_review,provider,model,processed_at)
  VALUES(j.script_id,j.user_id,p_chat_id,j.id,p_agent_type,p_created_at,j.source_hash,j.taxonomy_version,
    j.classifier_version,'classified',p_classification->>'kind',topics,p_classification->>'normalizedDemand',
    (p_classification->>'confidence')::numeric,(p_classification->>'needsReview')::boolean,j.provider,j.model,p_processed_at);
  UPDATE public.insight_jobs SET status='completed',lock_token=NULL,locked_until=NULL,next_attempt_at=NULL,
    finished_at=p_processed_at,updated_at=p_processed_at,
    input_tokens=GREATEST(0,COALESCE((p_usage->>'inputTokens')::bigint,0)),
    output_tokens=GREATEST(0,COALESCE((p_usage->>'outputTokens')::bigint,0)) WHERE id=j.id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.insights_fail_job(p_job_key text,p_lock_token uuid,p_now timestamptz,p_error_code text,p_max_attempts integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE j public.insight_jobs%ROWTYPE; terminal boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE insufficient_privilege; END IF;
  IF p_now IS NULL OR p_error_code !~ '^[a-z0-9_]{1,80}$' OR p_max_attempts NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'invalid_failure'; END IF;
  SELECT * INTO j FROM public.insight_jobs WHERE job_key=p_job_key FOR UPDATE;
  IF NOT FOUND OR j.status<>'processing' OR j.lock_token IS DISTINCT FROM p_lock_token THEN RETURN false; END IF;
  terminal := j.attempts>=LEAST(j.max_attempts,p_max_attempts);
  UPDATE public.insight_jobs SET status=CASE WHEN terminal THEN 'failed' ELSE 'retry' END,
    lock_token=NULL,locked_until=NULL,error_code=p_error_code,
    next_attempt_at=CASE WHEN terminal THEN NULL ELSE p_now+make_interval(secs=>LEAST(3600,60*power(2,j.attempts-1))) END,
    updated_at=p_now WHERE id=j.id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.insights_reserve_budget(p_scope text,p_amount_usd numeric,p_cap_usd numeric)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE changed integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE insufficient_privilege; END IF;
  IF p_scope IS NULL OR p_scope !~ '^[a-zA-Z0-9_.:-]{1,80}$' OR p_amount_usd IS NULL OR p_cap_usd IS NULL
    OR p_amount_usd<0 OR p_cap_usd<0 OR p_amount_usd::text IN ('NaN','Infinity','-Infinity')
    OR p_cap_usd::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'invalid_budget'; END IF;
  INSERT INTO public.insights_budgets(scope,reserved_usd,cap_usd) VALUES(p_scope,0,p_cap_usd) ON CONFLICT(scope) DO NOTHING;
  UPDATE public.insights_budgets SET reserved_usd=reserved_usd+p_amount_usd,
    cap_usd=LEAST(cap_usd,p_cap_usd),updated_at=now()
    WHERE scope=p_scope AND reserved_usd+p_amount_usd<=LEAST(cap_usd,p_cap_usd);
  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed=1;
END $$;

CREATE OR REPLACE FUNCTION public.insights_release_budget(p_scope text,p_amount_usd numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE insufficient_privilege; END IF;
  IF p_scope IS NULL OR p_scope !~ '^[a-zA-Z0-9_.:-]{1,80}$' OR p_amount_usd IS NULL OR p_amount_usd<0
    OR p_amount_usd::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'invalid_budget'; END IF;
  UPDATE public.insights_budgets SET reserved_usd=GREATEST(0,reserved_usd-p_amount_usd),updated_at=now() WHERE scope=p_scope;
END $$;

CREATE OR REPLACE FUNCTION public.insights_reject_job(p_script_id integer,p_user_id uuid,p_error_code text,p_now timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE insufficient_privilege; END IF;
  IF p_error_code IS DISTINCT FROM 'input_rejected' OR p_now IS NULL THEN RAISE EXCEPTION 'invalid_rejection'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.scripts s JOIN public.users u ON u.id=s.user_id JOIN public.chats c ON c.id=s.chatid
    WHERE s.id=p_script_id AND s.user_id=p_user_id AND c.user_id=p_user_id AND u.nivel='user') THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(71014,p_script_id);
  DELETE FROM public.script_insights WHERE script_id=p_script_id;
  INSERT INTO public.insight_jobs(job_key,script_id,user_id,source_hash,status,error_code,updated_at)
    VALUES('rejected:'||p_script_id,p_script_id,p_user_id,'','failed',p_error_code,p_now)
    ON CONFLICT(job_key) DO UPDATE SET status='failed',error_code=p_error_code,lock_token=NULL,locked_until=NULL,updated_at=p_now;
END $$;

CREATE OR REPLACE FUNCTION public.insights_remove_derived_by_user(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE insufficient_privilege; END IF;
  DELETE FROM public.script_insights WHERE user_id=p_user_id;
  DELETE FROM public.insight_jobs WHERE user_id=p_user_id;
END $$;

REVOKE ALL ON FUNCTION public.insights_claim_job(text,integer,uuid,text,text,text,timestamptz,integer,integer,text,text),
  public.insights_complete_job(text,uuid,jsonb,timestamptz,jsonb,text,uuid,timestamptz),
  public.insights_fail_job(text,uuid,timestamptz,text,integer),
  public.insights_reserve_budget(text,numeric,numeric), public.insights_release_budget(text,numeric),
  public.insights_reject_job(integer,uuid,text,timestamptz),public.insights_remove_derived_by_user(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.insights_claim_job(text,integer,uuid,text,text,text,timestamptz,integer,integer,text,text),
  public.insights_complete_job(text,uuid,jsonb,timestamptz,jsonb,text,uuid,timestamptz),
  public.insights_fail_job(text,uuid,timestamptz,text,integer),
  public.insights_reserve_budget(text,numeric,numeric), public.insights_release_budget(text,numeric),
  public.insights_reject_job(integer,uuid,text,timestamptz),public.insights_remove_derived_by_user(uuid)
  TO service_role;

-- Live activation must select one active taxonomy/classifier/hash version and
-- recheck users.nivel for every read/context; RLS does not authorize app admins.
-- Applying this reviewed artifact alone does not configure or activate a daily
-- executor. A staging database must verify RPC concurrency and role changes.
COMMIT;
