-- ADDITIVE ONLY. Apply separately after review; does not alter Insights source tables.
BEGIN;
CREATE TABLE public.insights_mcp_oauth_consents (
 nonce_hash text PRIMARY KEY CHECK(nonce_hash ~ '^[a-f0-9]{64}$'), user_id uuid NOT NULL REFERENCES public.users(id),
 expires_at timestamptz NOT NULL, consumed_at timestamptz
);
CREATE TABLE public.insights_mcp_oauth_grants (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.users(id), client_id text NOT NULL,
 resource text NOT NULL, scope text NOT NULL CHECK(scope='insights:read'), created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
);
CREATE TABLE public.insights_mcp_oauth_codes (
 code_hash text PRIMARY KEY CHECK(code_hash ~ '^[a-f0-9]{64}$'), grant_id uuid NOT NULL REFERENCES public.insights_mcp_oauth_grants(id),
 redirect_uri text NOT NULL, challenge text NOT NULL, expires_at timestamptz NOT NULL, consumed_at timestamptz
);
CREATE TABLE public.insights_mcp_oauth_tokens (
 access_hash text PRIMARY KEY CHECK(access_hash ~ '^[a-f0-9]{64}$'), refresh_hash text NOT NULL UNIQUE CHECK(refresh_hash ~ '^[a-f0-9]{64}$'),
 grant_id uuid NOT NULL REFERENCES public.insights_mcp_oauth_grants(id), access_expires_at timestamptz NOT NULL,
 refresh_expires_at timestamptz NOT NULL, refresh_used_at timestamptz
);
CREATE INDEX insights_mcp_oauth_tokens_grant ON public.insights_mcp_oauth_tokens(grant_id);
ALTER TABLE public.insights_mcp_oauth_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights_mcp_oauth_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights_mcp_oauth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights_mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.insights_mcp_oauth_consents,public.insights_mcp_oauth_grants,public.insights_mcp_oauth_codes,public.insights_mcp_oauth_tokens FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.insights_mcp_oauth_consents,public.insights_mcp_oauth_grants,public.insights_mcp_oauth_codes,public.insights_mcp_oauth_tokens TO service_role;

-- One transaction serializes each consent/code/family. Replay revocation returns NULL,
-- rather than throwing, so the security write survives the transaction.
CREATE FUNCTION public.insights_mcp_oauth_mutate(p_operation text,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.insights_mcp_oauth_codes; t public.insights_mcp_oauth_tokens; g public.insights_mcp_oauth_grants; n integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF p_operation='consent' THEN
   IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=(p_data->>'user_id')::uuid AND nivel='admin') THEN RETURN NULL; END IF;
   INSERT INTO public.insights_mcp_oauth_consents(nonce_hash,user_id,expires_at) VALUES(p_data->>'nonce_hash',(p_data->>'user_id')::uuid,now()+interval '10 minutes');
   RETURN '{}'::jsonb;
 ELSIF p_operation IN ('authorize','deny') THEN
   IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=(p_data->>'user_id')::uuid AND nivel='admin') THEN RETURN NULL; END IF;
   UPDATE public.insights_mcp_oauth_consents SET consumed_at=now() WHERE nonce_hash=p_data->>'nonce_hash' AND user_id=(p_data->>'user_id')::uuid AND consumed_at IS NULL AND expires_at>now();
   GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RETURN NULL; END IF;
   IF p_operation='deny' THEN RETURN '{}'::jsonb; END IF;
   INSERT INTO public.insights_mcp_oauth_grants(id,user_id,client_id,resource,scope) VALUES((p_data->>'grant_id')::uuid,(p_data->>'user_id')::uuid,p_data->>'client_id',p_data->>'resource','insights:read');
   INSERT INTO public.insights_mcp_oauth_codes(code_hash,grant_id,redirect_uri,challenge,expires_at) VALUES(p_data->>'code_hash',(p_data->>'grant_id')::uuid,p_data->>'redirect_uri',p_data->>'challenge',now()+interval '2 minutes');
   RETURN '{}'::jsonb;
 ELSIF p_operation='exchange' THEN
   SELECT * INTO c FROM public.insights_mcp_oauth_codes WHERE code_hash=p_data->>'code_hash' FOR UPDATE;
   IF NOT FOUND THEN RETURN NULL; END IF;
   SELECT * INTO g FROM public.insights_mcp_oauth_grants WHERE id=c.grant_id FOR UPDATE;
   IF g.client_id IS DISTINCT FROM p_data->>'client_id' OR g.resource IS DISTINCT FROM p_data->>'resource' OR c.redirect_uri IS DISTINCT FROM p_data->>'redirect_uri' OR c.challenge IS DISTINCT FROM p_data->>'challenge' THEN RETURN NULL; END IF;
   IF c.consumed_at IS NOT NULL THEN UPDATE public.insights_mcp_oauth_grants SET revoked_at=coalesce(revoked_at,now()) WHERE id=g.id; RETURN NULL; END IF;
   IF c.expires_at<=now() OR g.revoked_at IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=g.user_id AND nivel='admin') THEN RETURN NULL; END IF;
   UPDATE public.insights_mcp_oauth_codes SET consumed_at=now() WHERE code_hash=c.code_hash;
 ELSIF p_operation='refresh' THEN
   -- Locate first without lock; family lock is always obtained before token lock.
   SELECT * INTO t FROM public.insights_mcp_oauth_tokens WHERE refresh_hash=p_data->>'refresh_hash';
   IF NOT FOUND THEN RETURN NULL; END IF;
   SELECT * INTO g FROM public.insights_mcp_oauth_grants WHERE id=t.grant_id FOR UPDATE;
   SELECT * INTO t FROM public.insights_mcp_oauth_tokens WHERE refresh_hash=p_data->>'refresh_hash' FOR UPDATE;
   IF g.client_id IS DISTINCT FROM p_data->>'client_id' OR g.resource IS DISTINCT FROM p_data->>'resource' THEN RETURN NULL; END IF;
   IF t.refresh_used_at IS NOT NULL THEN UPDATE public.insights_mcp_oauth_grants SET revoked_at=coalesce(revoked_at,now()) WHERE id=g.id; RETURN NULL; END IF;
   IF t.refresh_expires_at<=now() OR g.revoked_at IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=g.user_id AND nivel='admin') THEN RETURN NULL; END IF;
   UPDATE public.insights_mcp_oauth_tokens SET refresh_used_at=now() WHERE access_hash=t.access_hash;
 ELSIF p_operation='revoke' THEN
   SELECT grants.* INTO g FROM public.insights_mcp_oauth_grants grants JOIN public.insights_mcp_oauth_tokens tokens ON tokens.grant_id=grants.id
     WHERE (tokens.access_hash=p_data->>'token_hash' OR tokens.refresh_hash=p_data->>'token_hash') AND grants.client_id=p_data->>'client_id' LIMIT 1 FOR UPDATE OF grants;
   IF FOUND THEN UPDATE public.insights_mcp_oauth_grants SET revoked_at=coalesce(revoked_at,now()) WHERE id=g.id; END IF;
   RETURN '{}'::jsonb;
 ELSE RAISE EXCEPTION 'unsupported_operation'; END IF;
 INSERT INTO public.insights_mcp_oauth_tokens(access_hash,refresh_hash,grant_id,access_expires_at,refresh_expires_at)
 VALUES(p_data->>'access_hash',p_data->>'new_refresh_hash',g.id,now()+interval '10 minutes',
   CASE WHEN p_operation='refresh' THEN t.refresh_expires_at ELSE now()+interval '30 days' END);
 RETURN jsonb_build_object('user_id',g.user_id,'client_id',g.client_id,'scope',g.scope);
END $$;
REVOKE ALL ON FUNCTION public.insights_mcp_oauth_mutate(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.insights_mcp_oauth_mutate(text,jsonb) TO service_role;
COMMIT;
