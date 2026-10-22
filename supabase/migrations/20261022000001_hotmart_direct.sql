-- PREPARED ONLY (22/10/2026). Integração direta Hotmart -> Bússola.
-- Aditiva: novas tabelas/RPCs service-role. Não reescreve users nem grants.
-- Pré-requisitos: 20261015000001_admin_users.sql e 20261015000002_admin_invitations.sql.
-- Não usar `supabase db push` genérico (histórico CLI não reconciliado).
-- Nunca armazenar hottok, credenciais, CPF, endereço ou payload completo.
BEGIN;

DO $$ BEGIN
  IF to_regprocedure('public.admin_users_revision(uuid)') IS NULL
     OR to_regprocedure('public.admin_users_lock(uuid)') IS NULL
     OR to_regprocedure('public.admin_users_view(uuid)') IS NULL
     OR to_regclass('public.admin_user_invitations') IS NULL THEN
    RAISE EXCEPTION 'hotmart:admin_migrations_required';
  END IF;
END $$;

-- Convites emitidos pelo sistema Hotmart não têm administrador emissor.
-- Relaxamento aditivo: exige emissor humano OU o ator de sistema 'hotmart'.
ALTER TABLE public.admin_user_invitations ALTER COLUMN issued_by DROP NOT NULL;
ALTER TABLE public.admin_user_invitations ADD COLUMN issued_by_system text
  CHECK (issued_by_system IS NULL OR issued_by_system = 'hotmart');
ALTER TABLE public.admin_user_invitations ADD CONSTRAINT admin_user_invitations_issuer_chk
  CHECK (issued_by IS NOT NULL OR issued_by_system IS NOT NULL);

CREATE FUNCTION public.hotmart_valid_agents(p_agents text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public AS $$
  SELECT p_agents IS NOT NULL
    AND p_agents <@ ARRAY['comunicacao','apresentacao','conversas_dificeis','postagem']::text[]
    AND cardinality(p_agents) = (SELECT count(DISTINCT x) FROM unnest(p_agents) x)
$$;

-- Mapeamento oferta Hotmart -> IAs. Chave principal (product_ucode, offer_code);
-- plan_id é apoio para eventos de assinatura sem código de oferta.
CREATE TABLE public.hotmart_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text,
  product_ucode text NOT NULL CHECK (length(product_ucode) BETWEEN 1 AND 100),
  product_name text CHECK (product_name IS NULL OR length(product_name) <= 300),
  offer_code text NOT NULL CHECK (length(offer_code) BETWEEN 1 AND 100),
  offer_name text CHECK (offer_name IS NULL OR length(offer_name) <= 300),
  payment_mode text CHECK (payment_mode IS NULL OR length(payment_mode) <= 60),
  is_subscription boolean NOT NULL DEFAULT false,
  plan_id text CHECK (plan_id IS NULL OR length(plan_id) <= 100),
  plan_name text CHECK (plan_name IS NULL OR length(plan_name) <= 300),
  price_value numeric,
  price_currency text CHECK (price_currency IS NULL OR length(price_currency) <= 10),
  api_active boolean,
  source text NOT NULL DEFAULT 'api' CHECK (source IN ('api', 'webhook')),
  synced_at timestamptz,
  agent_types text[] NOT NULL DEFAULT '{}' CHECK (public.hotmart_valid_agents(agent_types)),
  access_kind text CHECK (access_kind IS NULL OR access_kind IN ('single', 'subscription')),
  duration_days integer CHECK (duration_days IS NULL OR duration_days BETWEEN 1 AND 3650),
  grace_days integer CHECK (grace_days IS NULL OR grace_days BETWEEN 0 AND 60),
  configured_at timestamptz,
  configured_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_ucode, offer_code),
  CHECK (
    (access_kind IS NULL AND cardinality(agent_types) = 0)
    OR (access_kind = 'single' AND cardinality(agent_types) > 0 AND duration_days IS NOT NULL)
    OR (access_kind = 'subscription' AND cardinality(agent_types) > 0)
  )
);
CREATE INDEX hotmart_offers_plan_idx ON public.hotmart_offers(product_ucode, plan_id) WHERE plan_id IS NOT NULL;

-- Registro durável e idempotente. Somente campos mínimos + hash do corpo.
CREATE TABLE public.hotmart_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE CHECK (length(event_id) BETWEEN 1 AND 200),
  event_type text NOT NULL CHECK (event_type ~ '^[A-Z0-9_]{1,80}$'),
  event_version text CHECK (event_version IS NULL OR length(event_version) <= 20),
  event_created_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  body_sha256 text NOT NULL CHECK (body_sha256 ~ '^[0-9a-f]{64}$'),
  purchase_key text CHECK (purchase_key IS NULL OR purchase_key ~ '^(tx|sub):.{1,200}$'),
  transaction text CHECK (transaction IS NULL OR length(transaction) <= 200),
  subscriber_code text CHECK (subscriber_code IS NULL OR length(subscriber_code) <= 200),
  product_id text CHECK (product_id IS NULL OR length(product_id) <= 100),
  product_ucode text CHECK (product_ucode IS NULL OR length(product_ucode) <= 100),
  product_name text CHECK (product_name IS NULL OR length(product_name) <= 300),
  offer_code text CHECK (offer_code IS NULL OR length(offer_code) <= 100),
  plan_id text CHECK (plan_id IS NULL OR length(plan_id) <= 100),
  plan_name text CHECK (plan_name IS NULL OR length(plan_name) <= 300),
  purchase_status text CHECK (purchase_status IS NULL OR length(purchase_status) <= 60),
  subscription_status text CHECK (subscription_status IS NULL OR length(subscription_status) <= 60),
  recurrence_number integer,
  approved_at timestamptz,
  next_charge_at timestamptz,
  buyer_email text CHECK (buyer_email IS NULL OR (buyer_email = lower(btrim(buyer_email)) AND length(buyer_email) <= 254)),
  buyer_name text CHECK (buyer_name IS NULL OR length(buyer_name) <= 150),
  buyer_phone text CHECK (buyer_phone IS NULL OR length(buyer_phone) <= 30),
  mode text NOT NULL CHECK (mode IN ('shadow', 'live')),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'shadow_planned', 'applied', 'review', 'ignored', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  claimed_at timestamptz,
  plan jsonb CHECK (plan IS NULL OR jsonb_typeof(plan) = 'object'),
  result jsonb CHECK (result IS NULL OR jsonb_typeof(result) = 'object'),
  error_code text CHECK (error_code IS NULL OR length(error_code) <= 80),
  processed_at timestamptz,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL
);
-- Segunda chave de idempotência: a mesma transação/evento chega com outro id.
CREATE UNIQUE INDEX hotmart_events_transaction_event_uidx ON public.hotmart_events(transaction, event_type) WHERE transaction IS NOT NULL;
CREATE INDEX hotmart_events_received_idx ON public.hotmart_events(received_at DESC, id);
CREATE INDEX hotmart_events_status_idx ON public.hotmart_events(status, received_at);
CREATE INDEX hotmart_events_purchase_idx ON public.hotmart_events(purchase_key, event_created_at);

-- Ledger comercial: uma linha por compra única (tx:) ou assinatura (sub:).
CREATE TABLE public.hotmart_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_key text NOT NULL UNIQUE CHECK (purchase_key ~ '^(tx|sub):.{1,200}$'),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  product_ucode text,
  offer_code text,
  offer_id uuid REFERENCES public.hotmart_offers(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('single', 'subscription')),
  agent_types text[] NOT NULL CHECK (public.hotmart_valid_agents(agent_types) AND cardinality(agent_types) > 0),
  status text NOT NULL CHECK (status IN ('active', 'canceled', 'delayed', 'disputed', 'revoked')),
  access_until date,
  next_charge date,
  granted_transactions text[] NOT NULL DEFAULT '{}',
  last_event_at timestamptz NOT NULL,
  last_event_type text NOT NULL,
  last_recurrence integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hotmart_purchases_user_idx ON public.hotmart_purchases(user_id);

-- Origem das concessões sem alterar user_agent_access: o valor que a Hotmart
-- gravou por último. Linha atual igual ao materializado = concessão Hotmart;
-- diferente (painel, n8n, legado) = manual. manual_* guarda a base manual
-- existente quando a Hotmart assumiu a linha, para não perdê-la num reembolso.
CREATE TABLE public.hotmart_access_state (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_type text NOT NULL CHECK (agent_type IN ('comunicacao','apresentacao','conversas_dificeis','postagem')),
  materialized_enabled boolean NOT NULL,
  materialized_expires_at date,
  manual_enabled boolean NOT NULL DEFAULT false,
  manual_expires_at date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, agent_type)
);

CREATE TABLE public.hotmart_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_row_id uuid REFERENCES public.hotmart_events(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'unmapped_offer', 'manual_access_kept', 'profile_divergence', 'revocation_without_ledger',
    'stale_event', 'grant_after_revocation', 'switch_plan', 'single_canceled',
    'identity_mismatch', 'admin_buyer', 'invalid_buyer', 'invite_failed')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'kept', 'dismissed')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  proposal jsonb CHECK (proposal IS NULL OR jsonb_typeof(proposal) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolution_note text CHECK (resolution_note IS NULL OR length(resolution_note) <= 500)
);
CREATE INDEX hotmart_reviews_open_idx ON public.hotmart_reviews(status, created_at DESC);
CREATE INDEX hotmart_reviews_event_idx ON public.hotmart_reviews(event_row_id);

ALTER TABLE public.hotmart_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotmart_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotmart_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotmart_access_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotmart_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hotmart_offers, public.hotmart_events, public.hotmart_purchases, public.hotmart_access_state, public.hotmart_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.hotmart_offers, public.hotmart_events, public.hotmart_purchases, public.hotmart_access_state, public.hotmart_reviews TO service_role;

CREATE FUNCTION public.hotmart_assert_service() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION USING MESSAGE = 'hotmart:forbidden', ERRCODE = '42501';
  END IF;
END;
$$;

-- Revisão otimista: snapshot completo do admin (users+grants+versão) mais
-- ledger e estado de origem Hotmart do usuário.
CREATE FUNCTION public.hotmart_user_revision(p_user_id uuid) RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT md5(COALESCE(public.admin_users_revision(p_user_id), 'missing') || '|' ||
    COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.purchase_key) FROM public.hotmart_purchases p WHERE p.user_id = p_user_id), '[]'::jsonb)::text || '|' ||
    COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.agent_type) FROM public.hotmart_access_state s WHERE s.user_id = p_user_id), '[]'::jsonb)::text)
$$;

-- Ingestão idempotente. Retorna o registro existente em duplicidade.
CREATE FUNCTION public.hotmart_ingest_event(p_event jsonb, p_mode text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_id uuid; v_status text; v_existing record;
BEGIN
  PERFORM public.hotmart_assert_service();
  IF p_mode NOT IN ('shadow', 'live') OR p_event IS NULL OR jsonb_typeof(p_event) <> 'object'
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_event) k WHERE k NOT IN (
       'eventId','eventType','eventVersion','eventCreatedAt','bodySha256','purchaseKey','transaction','subscriberCode',
       'productId','productUcode','productName','offerCode','planId','planName','purchaseStatus','subscriptionStatus',
       'recurrenceNumber','approvedAt','nextChargeAt','buyerEmail','buyerName','buyerPhone')) THEN
    RAISE EXCEPTION USING MESSAGE = 'hotmart:invalid_event', ERRCODE = '22023';
  END IF;
  INSERT INTO public.hotmart_events(event_id, event_type, event_version, event_created_at, body_sha256, purchase_key,
    transaction, subscriber_code, product_id, product_ucode, product_name, offer_code, plan_id, plan_name,
    purchase_status, subscription_status, recurrence_number, approved_at, next_charge_at,
    buyer_email, buyer_name, buyer_phone, mode)
  VALUES (p_event->>'eventId', p_event->>'eventType', p_event->>'eventVersion', (p_event->>'eventCreatedAt')::timestamptz,
    p_event->>'bodySha256', p_event->>'purchaseKey', p_event->>'transaction', p_event->>'subscriberCode',
    p_event->>'productId', p_event->>'productUcode', p_event->>'productName', p_event->>'offerCode', p_event->>'planId', p_event->>'planName',
    p_event->>'purchaseStatus', p_event->>'subscriptionStatus', (p_event->>'recurrenceNumber')::integer,
    (p_event->>'approvedAt')::timestamptz, (p_event->>'nextChargeAt')::timestamptz,
    p_event->>'buyerEmail', p_event->>'buyerName', p_event->>'buyerPhone', p_mode)
  ON CONFLICT DO NOTHING
  RETURNING id, status INTO v_id, v_status;
  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_id, 'duplicate', false, 'status', v_status);
  END IF;
  SELECT id, status INTO v_existing FROM public.hotmart_events
    WHERE event_id = p_event->>'eventId'
       OR (p_event->>'transaction' IS NOT NULL AND transaction = p_event->>'transaction' AND event_type = p_event->>'eventType')
    ORDER BY received_at LIMIT 1;
  IF v_existing.id IS NULL THEN RAISE EXCEPTION USING MESSAGE = 'hotmart:ingest_conflict', ERRCODE = '40001'; END IF;
  RETURN jsonb_build_object('id', v_existing.id, 'duplicate', true, 'status', v_existing.status);
END;
$$;

-- Reserva o evento para um único processador. 'processing' antigo (>5 min) é
-- recuperável; 'review' só é reprocessado quando o admin pede.
CREATE FUNCTION public.hotmart_claim_event(p_event_row uuid, p_allow_review boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_event public.hotmart_events%ROWTYPE;
BEGIN
  PERFORM public.hotmart_assert_service();
  SELECT * INTO v_event FROM public.hotmart_events WHERE id = p_event_row FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN jsonb_build_object('claimed', false, 'reason', 'busy_or_missing'); END IF;
  IF NOT (v_event.status IN ('received', 'failed')
          OR (v_event.status = 'review' AND p_allow_review)
          OR (v_event.status = 'processing' AND v_event.claimed_at < clock_timestamp() - interval '5 minutes')) THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'status_' || v_event.status);
  END IF;
  UPDATE public.hotmart_events SET status = 'processing', claimed_at = clock_timestamp(), attempts = attempts + 1, error_code = NULL
    WHERE id = p_event_row;
  RETURN jsonb_build_object('claimed', true);
END;
$$;

CREATE FUNCTION public.hotmart_fail_event(p_event_row uuid, p_error_code text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.hotmart_assert_service();
  UPDATE public.hotmart_events SET status = 'failed', error_code = left(COALESCE(p_error_code, 'unknown'), 80), processed_at = clock_timestamp()
    WHERE id = p_event_row AND status = 'processing';
END;
$$;

-- Fotografia do usuário sem senha nem tokens.
CREATE FUNCTION public.hotmart_user_snapshot(p_user_id uuid) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT jsonb_build_object(
    'user', jsonb_build_object('id', u.id, 'email', u.email, 'nome', u.nome, 'telefone', u.telefone,
      'nivel', u.nivel, 'plano', u.plano, 'data_expiracao', u.data_expiracao::date),
    'grants', COALESCE((SELECT jsonb_agg(jsonb_build_object('agentType', a.agent_type, 'enabled', a.enabled, 'expiresAt', a.expires_at) ORDER BY a.agent_type)
      FROM public.user_agent_access a WHERE a.user_id = u.id), '[]'::jsonb),
    'state', COALESCE((SELECT jsonb_agg(jsonb_build_object('agentType', s.agent_type, 'materializedEnabled', s.materialized_enabled,
      'materializedExpiresAt', s.materialized_expires_at, 'manualEnabled', s.manual_enabled, 'manualExpiresAt', s.manual_expires_at) ORDER BY s.agent_type)
      FROM public.hotmart_access_state s WHERE s.user_id = u.id), '[]'::jsonb),
    'purchases', COALESCE((SELECT jsonb_agg(jsonb_build_object('purchaseKey', p.purchase_key, 'userId', p.user_id, 'productUcode', p.product_ucode,
      'offerCode', p.offer_code, 'offerId', p.offer_id, 'kind', p.kind, 'agentTypes', to_jsonb(p.agent_types), 'status', p.status,
      'accessUntil', p.access_until, 'nextCharge', p.next_charge, 'grantedTransactions', to_jsonb(p.granted_transactions),
      'lastEventAt', p.last_event_at, 'lastEventType', p.last_event_type, 'lastRecurrence', p.last_recurrence) ORDER BY p.purchase_key)
      FROM public.hotmart_purchases p WHERE p.user_id = u.id), '[]'::jsonb),
    'revision', public.hotmart_user_revision(u.id))
  FROM public.users u WHERE u.id = p_user_id
$$;

CREATE FUNCTION public.hotmart_offer_json(p_offer public.hotmart_offers) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
  SELECT CASE WHEN p_offer.id IS NULL THEN NULL ELSE jsonb_build_object('id', p_offer.id, 'productId', p_offer.product_id,
    'productUcode', p_offer.product_ucode, 'productName', p_offer.product_name, 'offerCode', p_offer.offer_code,
    'offerName', p_offer.offer_name, 'paymentMode', p_offer.payment_mode, 'isSubscription', p_offer.is_subscription,
    'planId', p_offer.plan_id, 'planName', p_offer.plan_name, 'priceValue', p_offer.price_value, 'priceCurrency', p_offer.price_currency,
    'apiActive', p_offer.api_active, 'source', p_offer.source, 'syncedAt', p_offer.synced_at,
    'agentTypes', to_jsonb(p_offer.agent_types), 'accessKind', p_offer.access_kind, 'durationDays', p_offer.duration_days,
    'graceDays', p_offer.grace_days, 'configuredAt', p_offer.configured_at, 'updatedAt', p_offer.updated_at) END
$$;

-- Contexto completo para o motor de regras (TypeScript, puro e testado).
CREATE FUNCTION public.hotmart_event_context(p_event_row uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_event public.hotmart_events%ROWTYPE; v_purchase public.hotmart_purchases%ROWTYPE;
  v_offer public.hotmart_offers%ROWTYPE; v_email_user uuid; v_purchase_user jsonb;
BEGIN
  PERFORM public.hotmart_assert_service();
  SELECT * INTO v_event FROM public.hotmart_events WHERE id = p_event_row;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE = 'hotmart:not_found', ERRCODE = 'P0002'; END IF;
  IF v_event.purchase_key IS NOT NULL THEN
    SELECT * INTO v_purchase FROM public.hotmart_purchases WHERE purchase_key = v_event.purchase_key;
  END IF;
  IF v_event.buyer_email IS NOT NULL THEN
    SELECT id INTO v_email_user FROM public.users WHERE lower(btrim(email)) = v_event.buyer_email;
  END IF;
  -- Oferta: (ucode, offer) -> oferta do ledger -> plano único no produto.
  IF v_event.product_ucode IS NOT NULL AND v_event.offer_code IS NOT NULL THEN
    SELECT * INTO v_offer FROM public.hotmart_offers WHERE product_ucode = v_event.product_ucode AND offer_code = v_event.offer_code;
  END IF;
  IF v_offer.id IS NULL AND v_purchase.offer_id IS NOT NULL THEN
    SELECT * INTO v_offer FROM public.hotmart_offers WHERE id = v_purchase.offer_id;
  END IF;
  IF v_offer.id IS NULL AND v_event.plan_id IS NOT NULL
     AND (SELECT count(*) FROM public.hotmart_offers WHERE plan_id = v_event.plan_id AND (v_event.product_ucode IS NULL OR product_ucode = v_event.product_ucode)) = 1 THEN
    SELECT * INTO v_offer FROM public.hotmart_offers WHERE plan_id = v_event.plan_id AND (v_event.product_ucode IS NULL OR product_ucode = v_event.product_ucode);
  END IF;
  IF v_offer.id IS NULL AND v_event.product_ucode IS NULL AND v_event.product_id IS NOT NULL AND v_event.offer_code IS NOT NULL
     AND (SELECT count(*) FROM public.hotmart_offers WHERE product_id = v_event.product_id AND offer_code = v_event.offer_code) = 1 THEN
    SELECT * INTO v_offer FROM public.hotmart_offers WHERE product_id = v_event.product_id AND offer_code = v_event.offer_code;
  END IF;
  IF v_purchase.id IS NOT NULL AND v_purchase.user_id IS DISTINCT FROM v_email_user THEN
    v_purchase_user := public.hotmart_user_snapshot(v_purchase.user_id);
  END IF;
  RETURN jsonb_build_object(
    'event', jsonb_build_object('id', v_event.id, 'eventId', v_event.event_id, 'eventType', v_event.event_type,
      'eventCreatedAt', v_event.event_created_at, 'purchaseKey', v_event.purchase_key, 'transaction', v_event.transaction,
      'subscriberCode', v_event.subscriber_code, 'productId', v_event.product_id, 'productUcode', v_event.product_ucode,
      'productName', v_event.product_name, 'offerCode', v_event.offer_code, 'planId', v_event.plan_id, 'planName', v_event.plan_name,
      'purchaseStatus', v_event.purchase_status, 'subscriptionStatus', v_event.subscription_status,
      'recurrenceNumber', v_event.recurrence_number, 'approvedAt', v_event.approved_at, 'nextChargeAt', v_event.next_charge_at,
      'buyerEmail', v_event.buyer_email, 'buyerName', v_event.buyer_name, 'buyerPhone', v_event.buyer_phone,
      'mode', v_event.mode, 'status', v_event.status),
    'offer', public.hotmart_offer_json(v_offer),
    'emailUser', CASE WHEN v_email_user IS NULL THEN NULL ELSE public.hotmart_user_snapshot(v_email_user) END,
    'purchaseUser', v_purchase_user,
    'today', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date);
END;
$$;

-- Aplica mudanças de acesso/cadastro/ledger de um usuário já bloqueado.
-- Interno: chamado apenas por hotmart_commit_event/hotmart_admin_resolve_review.
CREATE FUNCTION public.hotmart_apply_user_changes(p_user_id uuid, p_plan jsonb, p_allow_profile_set boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_user public.users%ROWTYPE; v_entry jsonb; v_purchase jsonb; v_offer_id uuid;
  v_fields text[] := ARRAY[]::text[]; v_value text; v_access_changed jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE = 'hotmart:not_found', ERRCODE = 'P0002'; END IF;
  IF p_plan ? 'profileSet' AND NOT p_allow_profile_set THEN RAISE EXCEPTION USING MESSAGE = 'hotmart:invalid_plan', ERRCODE = '22023'; END IF;

  -- Preencher somente campos vazios: a condição é reavaliada sob lock.
  IF jsonb_typeof(p_plan->'profileFill') = 'object' THEN
    v_value := NULLIF(btrim(p_plan->'profileFill'->>'nome'), '');
    IF v_value IS NOT NULL AND length(v_value) <= 150 AND v_value !~ '[[:cntrl:]]' AND COALESCE(btrim(v_user.nome), '') = '' THEN
      UPDATE public.users SET nome = v_value WHERE id = p_user_id; v_fields := array_append(v_fields, 'nome');
    END IF;
    v_value := NULLIF(btrim(p_plan->'profileFill'->>'telefone'), '');
    IF v_value IS NOT NULL AND v_value ~ '^[+0-9 ().-]{5,30}$' AND COALESCE(btrim(v_user.telefone), '') = '' THEN
      UPDATE public.users SET telefone = v_value WHERE id = p_user_id; v_fields := array_append(v_fields, 'telefone');
    END IF;
  END IF;
  -- Sobrescrita só por decisão explícita do admin numa revisão.
  IF jsonb_typeof(p_plan->'profileSet') = 'object' THEN
    v_value := NULLIF(btrim(p_plan->'profileSet'->>'nome'), '');
    IF v_value IS NOT NULL THEN
      IF length(v_value) > 150 OR v_value ~ '[[:cntrl:]]' THEN RAISE EXCEPTION USING MESSAGE = 'hotmart:invalid_plan', ERRCODE = '22023'; END IF;
      UPDATE public.users SET nome = v_value WHERE id = p_user_id; v_fields := array_append(v_fields, 'nome');
    END IF;
    v_value := NULLIF(btrim(p_plan->'profileSet'->>'telefone'), '');
    IF v_value IS NOT NULL THEN
      IF v_value !~ '^[+0-9 ().-]{5,30}$' THEN RAISE EXCEPTION USING MESSAGE = 'hotmart:invalid_plan', ERRCODE = '22023'; END IF;
      UPDATE public.users SET telefone = v_value WHERE id = p_user_id; v_fields := array_append(v_fields, 'telefone');
    END IF;
  END IF;

  IF jsonb_typeof(p_plan->'access') = 'array' AND jsonb_array_length(p_plan->'access') > 0 THEN
    IF v_user.nivel = 'admin' THEN RAISE EXCEPTION USING MESSAGE = 'hotmart:admin_target_locked', ERRCODE = '22023'; END IF;
    IF COALESCE((p_plan->>'convertToPersonal')::boolean, false) THEN
      UPDATE public.users SET plano = 'Personalizado', data_expiracao = NULL WHERE id = p_user_id;
    ELSIF v_user.plano IN ('Todas', 'Ambas') OR v_user.data_expiracao IS NOT NULL THEN
      -- Grants individuais seriam ignorados/limitados pelo plano global.
      RAISE EXCEPTION USING MESSAGE = 'hotmart:revision_conflict', ERRCODE = '40001';
    ELSIF v_user.plano IS DISTINCT FROM 'Personalizado' THEN
      UPDATE public.users SET plano = 'Personalizado' WHERE id = p_user_id;
    END IF;
    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_plan->'access') LOOP
      IF v_entry->>'agentType' NOT IN ('comunicacao','apresentacao','conversas_dificeis','postagem')
         OR jsonb_typeof(v_entry->'enabled') <> 'boolean' THEN
        RAISE EXCEPTION USING MESSAGE = 'hotmart:invalid_plan', ERRCODE = '22023';
      END IF;
      INSERT INTO public.user_agent_access(user_id, agent_type, enabled, expires_at)
      VALUES (p_user_id, v_entry->>'agentType', (v_entry->>'enabled')::boolean, (v_entry->>'expiresAt')::date)
      ON CONFLICT (user_id, agent_type) DO UPDATE SET enabled = EXCLUDED.enabled, expires_at = EXCLUDED.expires_at, updated_at = now()
        WHERE public.user_agent_access.enabled IS DISTINCT FROM EXCLUDED.enabled
           OR public.user_agent_access.expires_at IS DISTINCT FROM EXCLUDED.expires_at;
      IF jsonb_typeof(v_entry->'state') = 'object' THEN
        INSERT INTO public.hotmart_access_state(user_id, agent_type, materialized_enabled, materialized_expires_at, manual_enabled, manual_expires_at)
        VALUES (p_user_id, v_entry->>'agentType', (v_entry->>'enabled')::boolean, (v_entry->>'expiresAt')::date,
          COALESCE((v_entry->'state'->>'manualEnabled')::boolean, false), (v_entry->'state'->>'manualExpiresAt')::date)
        ON CONFLICT (user_id, agent_type) DO UPDATE SET materialized_enabled = EXCLUDED.materialized_enabled,
          materialized_expires_at = EXCLUDED.materialized_expires_at, manual_enabled = EXCLUDED.manual_enabled,
          manual_expires_at = EXCLUDED.manual_expires_at, updated_at = now();
      END IF;
      v_access_changed := v_access_changed || jsonb_build_object('agentType', v_entry->>'agentType', 'enabled', v_entry->'enabled', 'expiresAt', v_entry->'expiresAt');
    END LOOP;
  END IF;

  v_purchase := p_plan->'purchase';
  IF jsonb_typeof(v_purchase) = 'object' THEN
    IF v_purchase->>'offerId' IS NOT NULL THEN v_offer_id := (v_purchase->>'offerId')::uuid; END IF;
    INSERT INTO public.hotmart_purchases(purchase_key, user_id, product_ucode, offer_code, offer_id, kind, agent_types, status,
      access_until, next_charge, granted_transactions, last_event_at, last_event_type, last_recurrence)
    VALUES (v_purchase->>'purchaseKey', p_user_id, v_purchase->>'productUcode', v_purchase->>'offerCode', v_offer_id,
      v_purchase->>'kind', ARRAY(SELECT jsonb_array_elements_text(v_purchase->'agentTypes')), v_purchase->>'status',
      (v_purchase->>'accessUntil')::date, (v_purchase->>'nextCharge')::date,
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_purchase->'grantedTransactions', '[]'::jsonb))),
      (v_purchase->>'lastEventAt')::timestamptz, v_purchase->>'lastEventType', (v_purchase->>'lastRecurrence')::integer)
    ON CONFLICT (purchase_key) DO UPDATE SET product_ucode = EXCLUDED.product_ucode, offer_code = EXCLUDED.offer_code,
      offer_id = EXCLUDED.offer_id, kind = EXCLUDED.kind, agent_types = EXCLUDED.agent_types, status = EXCLUDED.status,
      access_until = EXCLUDED.access_until, next_charge = EXCLUDED.next_charge, granted_transactions = EXCLUDED.granted_transactions,
      last_event_at = EXCLUDED.last_event_at, last_event_type = EXCLUDED.last_event_type, last_recurrence = EXCLUDED.last_recurrence,
      updated_at = now()
      WHERE public.hotmart_purchases.user_id = EXCLUDED.user_id;
    IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE = 'hotmart:identity_mismatch', ERRCODE = '22023'; END IF;
  END IF;

  RETURN jsonb_build_object('profileFields', to_jsonb(v_fields), 'access', v_access_changed,
    'purchase', CASE WHEN jsonb_typeof(v_purchase) = 'object' THEN jsonb_build_object('purchaseKey', v_purchase->>'purchaseKey', 'status', v_purchase->>'status', 'accessUntil', v_purchase->'accessUntil') ELSE NULL END);
END;
$$;

CREATE FUNCTION public.hotmart_insert_reviews(p_event_row uuid, p_user_id uuid, p_reviews jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_count integer := 0; v_review jsonb;
BEGIN
  IF jsonb_typeof(p_reviews) IS DISTINCT FROM 'array' THEN RETURN 0; END IF;
  FOR v_review IN SELECT value FROM jsonb_array_elements(p_reviews) LOOP
    INSERT INTO public.hotmart_reviews(event_row_id, user_id, kind, details, proposal)
    VALUES (p_event_row, COALESCE((v_review->>'userId')::uuid, p_user_id), v_review->>'kind',
      COALESCE(v_review->'details', '{}'::jsonb), CASE WHEN jsonb_typeof(v_review->'proposal') = 'object' THEN v_review->'proposal' ELSE NULL END);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Grava o resultado do processamento. shadow: somente o plano no evento
-- (e stub de oferta não configurada); nada em users/user_agent_access/ledger.
CREATE FUNCTION public.hotmart_commit_event(p_event_row uuid, p_expected_revision text, p_plan jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_event public.hotmart_events%ROWTYPE; v_user_id uuid; v_created boolean := false; v_outcome text;
  v_result jsonb := '{}'::jsonb; v_email text; v_stub jsonb; v_reviews integer := 0; v_changes jsonb;
BEGIN
  PERFORM public.hotmart_assert_service();
  IF p_plan IS NULL OR jsonb_typeof(p_plan) <> 'object' OR p_plan->>'outcome' NOT IN ('applied', 'review', 'ignored') THEN
    RAISE EXCEPTION USING MESSAGE = 'hotmart:invalid_plan', ERRCODE = '22023';
  END IF;
  v_outcome := p_plan->>'outcome';
  SELECT * INTO v_event FROM public.hotmart_events WHERE id = p_event_row FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE = 'hotmart:not_found', ERRCODE = 'P0002'; END IF;
  IF v_event.status <> 'processing' THEN RAISE EXCEPTION USING MESSAGE = 'hotmart:not_claimed', ERRCODE = '22023'; END IF;

  v_stub := p_plan->'offerStub';
  IF jsonb_typeof(v_stub) = 'object' AND v_stub->>'productUcode' IS NOT NULL AND v_stub->>'offerCode' IS NOT NULL THEN
    INSERT INTO public.hotmart_offers(product_id, product_ucode, product_name, offer_code, plan_id, plan_name, is_subscription, source)
    VALUES (v_stub->>'productId', v_stub->>'productUcode', left(v_stub->>'productName', 300), v_stub->>'offerCode',
      v_stub->>'planId', left(v_stub->>'planName', 300), COALESCE((v_stub->>'isSubscription')::boolean, false), 'webhook')
    ON CONFLICT (product_ucode, offer_code) DO NOTHING;
  END IF;

  IF v_event.mode = 'shadow' THEN
    UPDATE public.hotmart_events SET status = 'shadow_planned', plan = p_plan, processed_at = clock_timestamp(),
      result = jsonb_build_object('mode', 'shadow', 'writes', false)
    WHERE id = p_event_row;
    RETURN jsonb_build_object('status', 'shadow_planned', 'userId', NULL, 'invite', false);
  END IF;

  -- Revisões antigas do mesmo evento são substituídas no reprocessamento.
  UPDATE public.hotmart_reviews SET status = 'dismissed', resolved_at = now(), resolution_note = 'Substituída por reprocessamento.'
    WHERE event_row_id = p_event_row AND status = 'open';

  IF jsonb_typeof(p_plan->'createUser') = 'object' THEN
    v_email := lower(btrim(p_plan->'createUser'->>'email'));
    IF v_email IS DISTINCT FROM v_event.buyer_email OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
       OR p_plan->'createUser'->>'passwordHash' !~ '^\$2[aby]\$12\$[./A-Za-z0-9]{53}$' THEN
      RAISE EXCEPTION USING MESSAGE = 'hotmart:invalid_plan', ERRCODE = '22023';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('admin-users-email:' || v_email, 0));
    IF EXISTS (SELECT 1 FROM public.users WHERE lower(btrim(email)) = v_email) THEN
      RAISE EXCEPTION USING MESSAGE = 'hotmart:revision_conflict', ERRCODE = '40001';
    END IF;
    v_user_id := gen_random_uuid();
    INSERT INTO public.users(id, nome, email, telefone, senha, nivel, plano, data_expiracao)
    VALUES (v_user_id, COALESCE(NULLIF(btrim(p_plan->'createUser'->>'nome'), ''), split_part(v_email, '@', 1)), v_email, NULLIF(btrim(p_plan->'createUser'->>'telefone'), ''),
      p_plan->'createUser'->>'passwordHash', 'user', 'Personalizado', NULL);
    -- Mesmo cuidado do painel: tokens legados não seguem um e-mail novo.
    IF to_regclass('public.password_reset_tokens') IS NOT NULL THEN
      EXECUTE 'UPDATE public.password_reset_tokens SET used_at = clock_timestamp() WHERE used_at IS NULL AND lower(btrim(email)) = $1' USING v_email;
    END IF;
    v_created := true;
  ELSIF p_plan->>'userId' IS NOT NULL THEN
    v_user_id := (p_plan->>'userId')::uuid;
    PERFORM public.admin_users_lock(v_user_id);
    IF public.hotmart_user_revision(v_user_id) IS DISTINCT FROM p_expected_revision THEN
      RAISE EXCEPTION USING MESSAGE = 'hotmart:revision_conflict', ERRCODE = '40001';
    END IF;
  END IF;

  IF v_user_id IS NOT NULL THEN
    v_result := public.hotmart_apply_user_changes(v_user_id, p_plan, false);
    v_changes := jsonb_build_object('actor', 'system:hotmart', 'eventRowId', p_event_row, 'eventType', v_event.event_type,
      'userCreated', v_created, 'profileFields', v_result->'profileFields', 'access', v_result->'access', 'purchase', v_result->'purchase');
    IF v_created OR jsonb_array_length(v_result->'profileFields') > 0 OR jsonb_array_length(v_result->'access') > 0 OR v_result->'purchase' <> 'null'::jsonb THEN
      INSERT INTO public.admin_user_revisions(user_id, version) VALUES (v_user_id, 1)
        ON CONFLICT (user_id) DO UPDATE SET version = public.admin_user_revisions.version + 1, updated_at = now();
      INSERT INTO public.admin_user_audit(user_id, actor_id, action, reason, changes)
      VALUES (v_user_id, NULL, CASE WHEN v_created THEN 'hotmart_user_created' ELSE 'hotmart_event_applied' END,
        left('Sistema Hotmart: ' || v_event.event_type, 500), v_changes);
    END IF;
  END IF;
  v_reviews := public.hotmart_insert_reviews(p_event_row, v_user_id, p_plan->'reviews');

  UPDATE public.hotmart_events SET status = v_outcome, plan = p_plan - 'createUser' || CASE WHEN v_created THEN jsonb_build_object('createUser', jsonb_build_object('created', true)) ELSE '{}'::jsonb END,
    result = v_result || jsonb_build_object('mode', 'live', 'userCreated', v_created, 'reviews', v_reviews),
    processed_at = clock_timestamp(), user_id = COALESCE(v_user_id, user_id)
  WHERE id = p_event_row;
  RETURN jsonb_build_object('status', v_outcome, 'userId', v_user_id, 'userCreated', v_created,
    'invite', v_created AND COALESCE((p_plan->>'invite')::boolean, false));
END;
$$;

-- Convite de primeiro acesso emitido pelo ator de sistema Hotmart.
CREATE FUNCTION public.hotmart_issue_invite(p_user_id uuid, p_token_hash text, p_expires_at timestamptz, p_event_row uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_user public.users%ROWTYPE; v_now timestamptz; v_invite_id uuid;
BEGIN
  PERFORM public.hotmart_assert_service();
  v_now := clock_timestamp();
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' OR p_expires_at IS NULL
     OR p_expires_at <= v_now OR p_expires_at > v_now + interval '1 hour' THEN
    RAISE EXCEPTION 'invalid invitation request' USING ERRCODE = '22023';
  END IF;
  PERFORM public.admin_users_lock(p_user_id);
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF v_user.nivel = 'admin' THEN RAISE EXCEPTION 'administrator invitations are forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE public.admin_user_invitations SET invalidated_at = v_now
    WHERE user_id = p_user_id AND used_at IS NULL AND invalidated_at IS NULL;
  INSERT INTO public.admin_user_invitations(user_id, email_snapshot, credential_fingerprint, token_hash, expires_at,
    issued_by, issued_by_system, action, delivery_status)
  VALUES (p_user_id, lower(btrim(v_user.email)), encode(pg_catalog.sha256(pg_catalog.convert_to(COALESCE(v_user.senha, ''), 'UTF8')), 'hex'),
    p_token_hash, p_expires_at, NULL, 'hotmart', 'send', 'pending')
  RETURNING id INTO v_invite_id;
  INSERT INTO public.admin_user_revisions(user_id, version) VALUES (p_user_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET version = public.admin_user_revisions.version + 1, updated_at = now();
  INSERT INTO public.admin_user_audit(user_id, actor_id, action, reason, changes)
  VALUES (p_user_id, NULL, 'invite_generated', 'Sistema Hotmart: convite de primeiro acesso da compra.',
    jsonb_build_object('actor', 'system:hotmart', 'inviteId', v_invite_id, 'eventRowId', p_event_row, 'expiresAt', p_expires_at));
  RETURN jsonb_build_object('id', v_invite_id, 'email', v_user.email, 'expiresAt', p_expires_at);
END;
$$;

CREATE FUNCTION public.hotmart_invite_delivery(p_invite_id uuid, p_status text, p_event_row uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_invite public.admin_user_invitations%ROWTYPE;
BEGIN
  PERFORM public.hotmart_assert_service();
  IF p_status NOT IN ('sent', 'failed') OR p_status IS NULL THEN RAISE EXCEPTION 'invalid delivery status' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_invite FROM public.admin_user_invitations WHERE id = p_invite_id;
  IF NOT FOUND OR v_invite.issued_by_system IS DISTINCT FROM 'hotmart' THEN RAISE EXCEPTION 'invitation not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.admin_users_lock(v_invite.user_id);
  UPDATE public.admin_user_invitations SET delivery_status = p_status, delivery_checked_at = clock_timestamp()
    WHERE id = p_invite_id AND delivery_status = 'pending';
  INSERT INTO public.admin_user_revisions(user_id, version) VALUES (v_invite.user_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET version = public.admin_user_revisions.version + 1, updated_at = now();
  INSERT INTO public.admin_user_audit(user_id, actor_id, action, reason, changes)
  VALUES (v_invite.user_id, NULL, CASE WHEN p_status = 'sent' THEN 'invite_sent' ELSE 'invite_send_failed' END,
    CASE WHEN p_status = 'sent' THEN 'Sistema Hotmart: convite enviado.' ELSE 'Sistema Hotmart: falha no envio do convite.' END,
    jsonb_build_object('actor', 'system:hotmart', 'inviteId', p_invite_id, 'deliveryStatus', p_status));
  IF p_status = 'failed' THEN
    INSERT INTO public.hotmart_reviews(event_row_id, user_id, kind, details)
    VALUES (p_event_row, v_invite.user_id, 'invite_failed', jsonb_build_object('inviteId', p_invite_id));
  END IF;
  UPDATE public.hotmart_events SET result = COALESCE(result, '{}'::jsonb) || jsonb_build_object('invite', p_status) WHERE id = p_event_row;
  RETURN jsonb_build_object('deliveryStatus', p_status);
END;
$$;

-- ===================== RPCs administrativas (admin atual) =====================

CREATE FUNCTION public.hotmart_admin_read(p_actor uuid, p_resource text, p_filters jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_status text; v_limit integer; v_result jsonb;
BEGIN
  PERFORM public.admin_users_assert_admin(p_actor);
  v_status := NULLIF(p_filters->>'status', '');
  v_limit := least(greatest(COALESCE((p_filters->>'limit')::integer, 50), 1), 200);
  IF p_resource = 'offers' THEN
    SELECT COALESCE(jsonb_agg(public.hotmart_offer_json(o) ORDER BY o.product_name NULLS LAST, o.product_ucode, o.offer_name NULLS LAST, o.offer_code), '[]'::jsonb)
      INTO v_result FROM public.hotmart_offers o;
  ELSIF p_resource = 'events' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', e.id, 'eventId', e.event_id, 'eventType', e.event_type,
      'eventCreatedAt', e.event_created_at, 'receivedAt', e.received_at, 'mode', e.mode, 'status', e.status,
      'transaction', e.transaction, 'subscriberCode', e.subscriber_code, 'productUcode', e.product_ucode, 'productName', e.product_name,
      'offerCode', e.offer_code, 'planName', e.plan_name, 'purchaseStatus', e.purchase_status, 'buyerEmail', e.buyer_email,
      'attempts', e.attempts, 'errorCode', e.error_code, 'plan', e.plan, 'result', e.result, 'userId', e.user_id) ORDER BY e.received_at DESC, e.id), '[]'::jsonb)
      INTO v_result FROM (SELECT * FROM public.hotmart_events WHERE v_status IS NULL OR status = v_status ORDER BY received_at DESC, id LIMIT v_limit) e;
  ELSIF p_resource = 'reviews' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', r.id, 'eventRowId', r.event_row_id, 'userId', r.user_id, 'userEmail', u.email,
      'kind', r.kind, 'status', r.status, 'details', r.details, 'proposal', r.proposal, 'createdAt', r.created_at,
      'resolvedAt', r.resolved_at, 'resolutionNote', r.resolution_note, 'eventType', e.event_type) ORDER BY r.created_at DESC, r.id), '[]'::jsonb)
      INTO v_result FROM (SELECT * FROM public.hotmart_reviews WHERE (v_status IS NULL AND status = 'open') OR status = v_status ORDER BY created_at DESC, id LIMIT v_limit) r
      LEFT JOIN public.users u ON u.id = r.user_id LEFT JOIN public.hotmart_events e ON e.id = r.event_row_id;
  ELSIF p_resource = 'summary' THEN
    SELECT jsonb_build_object(
      'offers', (SELECT count(*) FROM public.hotmart_offers),
      'unconfiguredOffers', (SELECT count(*) FROM public.hotmart_offers WHERE access_kind IS NULL),
      'openReviews', (SELECT count(*) FROM public.hotmart_reviews WHERE status = 'open'),
      'events', (SELECT jsonb_object_agg(status, n) FROM (SELECT status, count(*) n FROM public.hotmart_events GROUP BY status) s),
      'lastEventAt', (SELECT max(received_at) FROM public.hotmart_events)) INTO v_result;
  ELSIF p_resource = 'review' THEN
    SELECT jsonb_build_object('id', r.id, 'eventRowId', r.event_row_id, 'userId', r.user_id, 'kind', r.kind, 'status', r.status,
      'details', r.details, 'proposal', r.proposal, 'user', CASE WHEN r.user_id IS NULL THEN NULL ELSE public.hotmart_user_snapshot(r.user_id) END)
      INTO v_result FROM public.hotmart_reviews r WHERE r.id = (p_filters->>'id')::uuid;
    IF v_result IS NULL THEN RAISE EXCEPTION USING MESSAGE = 'hotmart:not_found', ERRCODE = 'P0002'; END IF;
  ELSE
    RAISE EXCEPTION USING MESSAGE = 'hotmart:invalid_input', ERRCODE = '22023';
  END IF;
  RETURN v_result;
END;
$$;

-- Sincronização: atualiza só metadados da API; nunca o mapeamento do admin.
CREATE FUNCTION public.hotmart_admin_sync_offers(p_actor uuid, p_items jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_item jsonb; v_count integer := 0;
BEGIN
  PERFORM public.admin_users_assert_admin(p_actor);
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) > 5000 THEN
    RAISE EXCEPTION USING MESSAGE = 'hotmart:invalid_input', ERRCODE = '22023';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.hotmart_offers(product_id, product_ucode, product_name, offer_code, offer_name, payment_mode, is_subscription,
      plan_id, plan_name, price_value, price_currency, api_active, source, synced_at)
    VALUES (v_item->>'productId', v_item->>'productUcode', left(v_item->>'productName', 300), v_item->>'offerCode', left(v_item->>'offerName', 300),
      left(v_item->>'paymentMode', 60), COALESCE((v_item->>'isSubscription')::boolean, false), v_item->>'planId', left(v_item->>'planName', 300),
      (v_item->>'priceValue')::numeric, left(v_item->>'priceCurrency', 10), (v_item->>'apiActive')::boolean, 'api', now())
    ON CONFLICT (product_ucode, offer_code) DO UPDATE SET product_id = EXCLUDED.product_id, product_name = EXCLUDED.product_name,
      offer_name = EXCLUDED.offer_name, payment_mode = EXCLUDED.payment_mode, is_subscription = EXCLUDED.is_subscription,
      plan_id = COALESCE(EXCLUDED.plan_id, public.hotmart_offers.plan_id), plan_name = COALESCE(EXCLUDED.plan_name, public.hotmart_offers.plan_name),
      price_value = EXCLUDED.price_value, price_currency = EXCLUDED.price_currency, api_active = EXCLUDED.api_active,
      source = 'api', synced_at = now(), updated_at = now();
    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('synced', v_count);
END;
$$;

CREATE FUNCTION public.hotmart_admin_configure_offer(p_actor uuid, p_offer_id uuid, p_config jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_offer public.hotmart_offers%ROWTYPE; v_agents text[];
BEGIN
  PERFORM public.admin_users_assert_admin(p_actor);
  IF p_config IS NULL OR jsonb_typeof(p_config) <> 'object' OR jsonb_typeof(p_config->'agentTypes') IS DISTINCT FROM 'array'
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_config) k WHERE k NOT IN ('agentTypes', 'accessKind', 'durationDays', 'graceDays')) THEN
    RAISE EXCEPTION USING MESSAGE = 'hotmart:invalid_input', ERRCODE = '22023';
  END IF;
  v_agents := ARRAY(SELECT jsonb_array_elements_text(p_config->'agentTypes'));
  BEGIN
    UPDATE public.hotmart_offers SET agent_types = v_agents,
      access_kind = NULLIF(p_config->>'accessKind', ''),
      duration_days = (p_config->>'durationDays')::integer,
      grace_days = (p_config->>'graceDays')::integer,
      configured_at = now(), configured_by = p_actor, updated_at = now()
    WHERE id = p_offer_id RETURNING * INTO v_offer;
  EXCEPTION WHEN check_violation OR invalid_text_representation THEN
    RAISE EXCEPTION USING MESSAGE = 'hotmart:invalid_input', ERRCODE = '22023';
  END;
  IF v_offer.id IS NULL THEN RAISE EXCEPTION USING MESSAGE = 'hotmart:not_found', ERRCODE = 'P0002'; END IF;
  RETURN public.hotmart_offer_json(v_offer);
END;
$$;

-- Decisão do admin numa revisão. accept aplica o plano calculado sobre o
-- estado atual (com revisão otimista); keep/dismiss não alteram acesso.
CREATE FUNCTION public.hotmart_admin_resolve_review(p_actor uuid, p_review_id uuid, p_decision text, p_note text,
  p_expected_revision text DEFAULT NULL, p_plan jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_review public.hotmart_reviews%ROWTYPE; v_result jsonb := NULL;
BEGIN
  PERFORM public.admin_users_assert_admin(p_actor);
  IF p_decision NOT IN ('accept', 'keep', 'dismiss') OR p_decision IS NULL
     OR p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 3 AND 500 OR p_note ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION USING MESSAGE = 'hotmart:invalid_input', ERRCODE = '22023';
  END IF;
  SELECT * INTO v_review FROM public.hotmart_reviews WHERE id = p_review_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE = 'hotmart:not_found', ERRCODE = 'P0002'; END IF;
  IF v_review.user_id IS NOT NULL THEN PERFORM public.admin_users_lock(v_review.user_id); END IF;
  SELECT * INTO v_review FROM public.hotmart_reviews WHERE id = p_review_id FOR UPDATE;
  IF v_review.status <> 'open' THEN RAISE EXCEPTION USING MESSAGE = 'hotmart:review_closed', ERRCODE = '22023'; END IF;
  IF p_decision = 'accept' THEN
    IF v_review.user_id IS NULL OR p_plan IS NULL OR jsonb_typeof(p_plan) <> 'object'
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_plan) k WHERE k NOT IN ('access', 'convertToPersonal', 'profileSet', 'purchase')) THEN
      RAISE EXCEPTION USING MESSAGE = 'hotmart:invalid_input', ERRCODE = '22023';
    END IF;
    IF public.hotmart_user_revision(v_review.user_id) IS DISTINCT FROM p_expected_revision THEN
      RAISE EXCEPTION USING MESSAGE = 'hotmart:revision_conflict', ERRCODE = '40001';
    END IF;
    v_result := public.hotmart_apply_user_changes(v_review.user_id, p_plan, true);
    INSERT INTO public.admin_user_revisions(user_id, version) VALUES (v_review.user_id, 1)
      ON CONFLICT (user_id) DO UPDATE SET version = public.admin_user_revisions.version + 1, updated_at = now();
    INSERT INTO public.admin_user_audit(user_id, actor_id, action, reason, changes)
    VALUES (v_review.user_id, p_actor, 'hotmart_review_accepted', btrim(p_note),
      jsonb_build_object('reviewId', p_review_id, 'kind', v_review.kind, 'profileFields', v_result->'profileFields', 'access', v_result->'access', 'purchase', v_result->'purchase'));
  ELSIF v_review.user_id IS NOT NULL THEN
    INSERT INTO public.admin_user_audit(user_id, actor_id, action, reason, changes)
    VALUES (v_review.user_id, p_actor, CASE WHEN p_decision = 'keep' THEN 'hotmart_review_kept' ELSE 'hotmart_review_dismissed' END, btrim(p_note),
      jsonb_build_object('reviewId', p_review_id, 'kind', v_review.kind));
  END IF;
  UPDATE public.hotmart_reviews SET status = CASE p_decision WHEN 'accept' THEN 'accepted' WHEN 'keep' THEN 'kept' ELSE 'dismissed' END,
    resolved_at = now(), resolved_by = p_actor, resolution_note = btrim(p_note)
  WHERE id = p_review_id;
  RETURN jsonb_build_object('status', CASE p_decision WHEN 'accept' THEN 'accepted' WHEN 'keep' THEN 'kept' ELSE 'dismissed' END, 'result', v_result);
END;
$$;

-- Leitura de auditoria v2: identifica o ator de sistema Hotmart (actor_id NULL).
CREATE FUNCTION public.admin_users_audit_read_v2(p_actor uuid, p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_events jsonb;
BEGIN
  PERFORM public.admin_users_assert_admin(p_actor);
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN RAISE EXCEPTION USING MESSAGE = 'admin_users:not_found', ERRCODE = 'P0001'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', e.id, 'userId', e.user_id,
    'actor', CASE WHEN e.actor_id IS NOT NULL THEN e.actor_id::text WHEN e.changes->>'actor' = 'system:hotmart' THEN 'Sistema Hotmart' ELSE 'administrador removido' END,
    'action', e.action, 'reason', e.reason, 'createdAt', e.created_at, 'changes', e.changes) ORDER BY e.created_at DESC, e.id DESC), '[]'::jsonb)
  INTO v_events FROM (SELECT * FROM public.admin_user_audit WHERE user_id = p_user_id ORDER BY created_at DESC, id DESC LIMIT 200) e;
  RETURN v_events;
END;
$$;

REVOKE ALL ON FUNCTION
  public.hotmart_valid_agents(text[]), public.hotmart_assert_service(), public.hotmart_user_revision(uuid),
  public.hotmart_ingest_event(jsonb, text), public.hotmart_claim_event(uuid, boolean), public.hotmart_fail_event(uuid, text),
  public.hotmart_user_snapshot(uuid), public.hotmart_offer_json(public.hotmart_offers), public.hotmart_event_context(uuid),
  public.hotmart_apply_user_changes(uuid, jsonb, boolean), public.hotmart_insert_reviews(uuid, uuid, jsonb),
  public.hotmart_commit_event(uuid, text, jsonb), public.hotmart_issue_invite(uuid, text, timestamptz, uuid),
  public.hotmart_invite_delivery(uuid, text, uuid), public.hotmart_admin_read(uuid, text, jsonb),
  public.hotmart_admin_sync_offers(uuid, jsonb), public.hotmart_admin_configure_offer(uuid, uuid, jsonb),
  public.hotmart_admin_resolve_review(uuid, uuid, text, text, text, jsonb), public.admin_users_audit_read_v2(uuid, uuid)
FROM PUBLIC, anon, authenticated;
-- Somente pontos de entrada expostos ao service role; helpers internos ficam
-- acessíveis apenas ao dono (SECURITY DEFINER encadeado).
GRANT EXECUTE ON FUNCTION
  public.hotmart_ingest_event(jsonb, text), public.hotmart_claim_event(uuid, boolean), public.hotmart_fail_event(uuid, text),
  public.hotmart_event_context(uuid), public.hotmart_commit_event(uuid, text, jsonb),
  public.hotmart_issue_invite(uuid, text, timestamptz, uuid), public.hotmart_invite_delivery(uuid, text, uuid),
  public.hotmart_admin_read(uuid, text, jsonb), public.hotmart_admin_sync_offers(uuid, jsonb),
  public.hotmart_admin_configure_offer(uuid, uuid, jsonb), public.hotmart_admin_resolve_review(uuid, uuid, text, text, text, jsonb),
  public.admin_users_audit_read_v2(uuid, uuid)
TO service_role;
GRANT EXECUTE ON FUNCTION public.hotmart_valid_agents(text[]) TO service_role;

COMMENT ON TABLE public.hotmart_events IS 'Webhooks Hotmart 2.0: campos mínimos + SHA-256 do corpo. Sem hottok, CPF, endereço ou payload completo.';
COMMENT ON TABLE public.hotmart_access_state IS 'Origem das concessões: linha de user_agent_access igual ao materializado = Hotmart; diferente = manual/externa.';
COMMENT ON TABLE public.hotmart_purchases IS 'Ledger comercial Hotmart por compra (tx:) ou assinatura (sub:). Acesso efetivo = maior concessão ativa.';
COMMIT;
