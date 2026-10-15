-- Prepared only. Apply after 20261015000001_admin_users.sql in an authorized rollout.
BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email_snapshot text NOT NULL,
  credential_fingerprint text NOT NULL CHECK (credential_fingerprint ~ '^[0-9a-f]{64}$'),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  invalidated_at timestamptz,
  issued_by uuid NOT NULL REFERENCES public.users(id),
  action text NOT NULL CHECK (action IN ('generate', 'send')),
  delivery_status text NOT NULL CHECK (delivery_status IN ('not_requested', 'pending', 'sent', 'failed')),
  delivery_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_user_invitations_one_open
  ON public.admin_user_invitations(user_id)
  WHERE used_at IS NULL AND invalidated_at IS NULL;
CREATE INDEX IF NOT EXISTS admin_user_invitations_user_recent
  ON public.admin_user_invitations(user_id, created_at DESC);

ALTER TABLE public.admin_user_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_user_invitations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.admin_user_invitations TO service_role;

-- Called only through the server's service-role client after the admin session check.
CREATE OR REPLACE FUNCTION public.admin_users_issue_invite(
  p_actor uuid,
  p_user_id uuid,
  p_expected_revision text,
  p_action text,
  p_reason text,
  p_token_hash text,
  p_expires_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_now timestamptz;
  v_user public.users%ROWTYPE;
  v_invite_id uuid;
  v_recent timestamptz;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  PERFORM public.admin_users_assert_admin(p_actor);
  v_now := clock_timestamp();
  IF p_action NOT IN ('generate', 'send') OR p_action IS NULL
     OR p_token_hash !~ '^[0-9a-f]{64}$' OR p_token_hash IS NULL
     OR p_expires_at IS NULL OR p_expires_at <= v_now OR p_expires_at > v_now + interval '1 hour'
     OR p_reason IS NULL OR length(btrim(p_reason)) < 5 OR length(p_reason) > 500
     OR p_reason ~ '[[:cntrl:]]'
     OR p_expected_revision IS NULL OR p_expected_revision = '' THEN
    RAISE EXCEPTION 'invalid invitation request' USING ERRCODE = '22023';
  END IF;

  PERFORM public.admin_users_lock(p_user_id);
  v_now := clock_timestamp();
  IF p_expires_at <= v_now THEN
    RAISE EXCEPTION 'invalid invitation request' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002'; END IF;
  IF v_user.nivel = 'admin' THEN
    RAISE EXCEPTION 'administrator invitations are forbidden' USING ERRCODE = '42501';
  END IF;
  IF public.admin_users_revision(p_user_id) IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'revision conflict' USING ERRCODE = '40001';
  END IF;

  SELECT max(created_at) INTO v_recent
  FROM public.admin_user_invitations WHERE user_id = p_user_id;
  IF v_recent IS NOT NULL AND v_recent > v_now - interval '60 seconds' THEN
    RAISE EXCEPTION USING MESSAGE = 'admin_users:invitation_cooldown', ERRCODE = 'P0001';
  END IF;

  UPDATE public.admin_user_invitations
    SET invalidated_at = v_now
    WHERE user_id = p_user_id AND used_at IS NULL AND invalidated_at IS NULL;
  INSERT INTO public.admin_user_invitations
    (user_id, email_snapshot, credential_fingerprint, token_hash, expires_at, issued_by, action, delivery_status)
  VALUES
    (p_user_id, lower(btrim(v_user.email)), encode(pg_catalog.sha256(pg_catalog.convert_to(COALESCE(v_user.senha, ''), 'UTF8')), 'hex'),
     p_token_hash, p_expires_at, p_actor, p_action,
     CASE WHEN p_action = 'send' THEN 'pending' ELSE 'not_requested' END)
  RETURNING id INTO v_invite_id;

  INSERT INTO public.admin_user_revisions(user_id, version)
    VALUES (p_user_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET version = public.admin_user_revisions.version + 1;
  INSERT INTO public.admin_user_audit(user_id, actor_id, action, reason, changes)
    VALUES (p_user_id, p_actor, 'invite_generated', btrim(p_reason),
      jsonb_build_object('inviteId', v_invite_id, 'action', p_action, 'expiresAt', p_expires_at));

  RETURN jsonb_build_object(
    'id', v_invite_id,
    'email', v_user.email,
    'expiresAt', p_expires_at,
    'deliveryStatus', CASE WHEN p_action = 'send' THEN 'pending' ELSE 'not_requested' END,
    'user', public.admin_users_view(p_user_id)
  );
END;
$$;

-- Cheap preflight before bcrypt. Consumption checks every condition again under
-- the user lock, so this read can never authorize a stale token by itself.
CREATE OR REPLACE FUNCTION public.admin_users_validate_invite(p_token_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_valid boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('valid', false);
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.admin_user_invitations i
    JOIN public.users u ON u.id = i.user_id
    WHERE i.token_hash = p_token_hash AND i.used_at IS NULL AND i.invalidated_at IS NULL
      AND i.expires_at > clock_timestamp() AND u.nivel IS DISTINCT FROM 'admin'
      AND lower(btrim(u.email)) = i.email_snapshot
      AND encode(pg_catalog.sha256(pg_catalog.convert_to(COALESCE(u.senha, ''), 'UTF8')), 'hex') = i.credential_fingerprint
  ) INTO v_valid;
  RETURN jsonb_build_object('valid', v_valid);
END;
$$;

-- Distinguish a requested send from a delivery accepted by the transport.
CREATE OR REPLACE FUNCTION public.admin_users_invite_delivery(
  p_actor uuid,
  p_invite_id uuid,
  p_status text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_invite public.admin_user_invitations%ROWTYPE;
  v_user_id uuid;
  v_now timestamptz;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  PERFORM public.admin_users_assert_admin(p_actor);
  IF p_status NOT IN ('sent', 'failed') OR p_status IS NULL THEN
    RAISE EXCEPTION 'invalid delivery status' USING ERRCODE = '22023';
  END IF;
  -- Read the owner before taking the common user-first lock order.
  SELECT user_id INTO v_user_id FROM public.admin_user_invitations WHERE id = p_invite_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.admin_users_lock(v_user_id);
  v_now := clock_timestamp();
  SELECT * INTO v_invite FROM public.admin_user_invitations WHERE id = p_invite_id FOR UPDATE;
  IF v_invite.issued_by IS DISTINCT FROM p_actor OR v_invite.action <> 'send'
     OR v_invite.delivery_status <> 'pending' THEN
    RAISE EXCEPTION 'delivery update is unavailable' USING ERRCODE = '22023';
  END IF;

  UPDATE public.admin_user_invitations SET delivery_status = p_status, delivery_checked_at = v_now WHERE id = p_invite_id;
  INSERT INTO public.admin_user_revisions(user_id, version)
    VALUES (v_invite.user_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET version = public.admin_user_revisions.version + 1;
  INSERT INTO public.admin_user_audit(user_id, actor_id, action, reason, changes)
    VALUES (v_invite.user_id, p_actor,
      CASE WHEN p_status = 'sent' THEN 'invite_sent' ELSE 'invite_send_failed' END,
      CASE WHEN p_status = 'sent' THEN 'Convite de primeiro acesso enviado.' ELSE 'Falha no envio do convite de primeiro acesso.' END,
      jsonb_build_object('inviteId', p_invite_id, 'deliveryStatus', p_status));
  RETURN jsonb_build_object('deliveryStatus', p_status, 'user', public.admin_users_view(v_invite.user_id));
END;
$$;

-- Recipient possession of a one-use bearer token is the authority here.
-- Lock the user before the invitation to serialize with issue and email edits.
CREATE OR REPLACE FUNCTION public.admin_users_consume_invite(
  p_token_hash text,
  p_password_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_user_id uuid;
  v_user public.users%ROWTYPE;
  v_invite public.admin_user_invitations%ROWTYPE;
  v_now timestamptz;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$'
     OR p_password_hash IS NULL OR length(p_password_hash) <> 60
     OR left(p_password_hash, 4) NOT IN ('$2a$', '$2b$', '$2y$') THEN
    RAISE EXCEPTION 'invalid first-access input' USING ERRCODE = '22023';
  END IF;
  SELECT user_id INTO v_user_id FROM public.admin_user_invitations WHERE token_hash = p_token_hash;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid or expired invitation' USING ERRCODE = '22023';
  END IF;
  PERFORM public.admin_users_lock(v_user_id);
  v_now := clock_timestamp();
  SELECT * INTO v_invite FROM public.admin_user_invitations WHERE token_hash = p_token_hash FOR UPDATE;
  SELECT * INTO v_user FROM public.users WHERE id = v_user_id;
  IF v_invite.id IS NULL OR v_invite.used_at IS NOT NULL OR v_invite.invalidated_at IS NOT NULL
     OR v_invite.expires_at <= v_now OR v_user.id IS NULL OR v_user.nivel = 'admin'
     OR lower(btrim(v_user.email)) IS DISTINCT FROM v_invite.email_snapshot
     OR encode(pg_catalog.sha256(pg_catalog.convert_to(COALESCE(v_user.senha, ''), 'UTF8')), 'hex') IS DISTINCT FROM v_invite.credential_fingerprint THEN
    RAISE EXCEPTION 'invalid or expired invitation' USING ERRCODE = '22023';
  END IF;

  UPDATE public.users SET senha = p_password_hash WHERE id = v_user_id;
  IF to_regclass('public.password_reset_tokens') IS NOT NULL THEN
    EXECUTE 'UPDATE public.password_reset_tokens SET used_at = $1 WHERE lower(btrim(email)) = $2 AND used_at IS NULL'
      USING v_now, lower(btrim(v_user.email));
  END IF;
  UPDATE public.admin_user_invitations SET used_at = v_now WHERE id = v_invite.id;
  UPDATE public.admin_user_invitations SET invalidated_at = v_now
    WHERE user_id = v_user_id AND id <> v_invite.id AND used_at IS NULL AND invalidated_at IS NULL;
  INSERT INTO public.admin_user_revisions(user_id, version)
    VALUES (v_user_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET version = public.admin_user_revisions.version + 1;
  INSERT INTO public.admin_user_audit(user_id, actor_id, action, reason, changes)
    VALUES (v_user_id, v_user_id, 'password_defined', 'Primeiro acesso concluído pelo portador do link.',
      jsonb_build_object('inviteId', v_invite.id));
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_users_issue_invite(uuid, uuid, text, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_users_validate_invite(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_users_invite_delivery(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_users_consume_invite(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_users_issue_invite(uuid, uuid, text, text, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_users_validate_invite(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_users_invite_delivery(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_users_consume_invite(text, text) TO service_role;

-- Existing forgot-password tokens must serialize with managed invitation use.
-- The app selects this path only when the managed live-write gate is active.
CREATE FUNCTION public.admin_users_consume_legacy_reset(p_email text, p_token_hash text, p_password_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_user_id uuid; v_token_id uuid; v_now timestamptz;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service role required' USING ERRCODE='42501'; END IF;
  IF p_email IS NULL OR p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$'
     OR p_password_hash IS NULL OR p_password_hash !~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$' THEN
    RAISE EXCEPTION 'invalid reset' USING ERRCODE='22023';
  END IF;
  SELECT id INTO v_user_id FROM public.users WHERE lower(btrim(email))=lower(btrim(p_email));
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid reset' USING ERRCODE='22023'; END IF;
  PERFORM public.admin_users_lock(v_user_id);
  v_now:=clock_timestamp();
  -- Recheck identity after waiting for a concurrent email edit.
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=v_user_id AND lower(btrim(email))=lower(btrim(p_email))) THEN
    RAISE EXCEPTION 'invalid reset' USING ERRCODE='22023';
  END IF;
  SELECT id INTO v_token_id FROM public.password_reset_tokens
    WHERE email=lower(btrim(p_email)) AND token_hash=p_token_hash AND used_at IS NULL AND expires_at>v_now
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid reset' USING ERRCODE='22023'; END IF;
  UPDATE public.users SET senha=p_password_hash WHERE id=v_user_id;
  UPDATE public.password_reset_tokens SET used_at=v_now WHERE lower(btrim(email))=lower(btrim(p_email)) AND used_at IS NULL;
  UPDATE public.admin_user_invitations SET invalidated_at=v_now WHERE user_id=v_user_id AND used_at IS NULL AND invalidated_at IS NULL;
  INSERT INTO public.admin_user_revisions(user_id,version) VALUES(v_user_id,1)
    ON CONFLICT(user_id) DO UPDATE SET version=public.admin_user_revisions.version+1;
  RETURN jsonb_build_object('success',true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_users_consume_legacy_reset(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_users_consume_legacy_reset(text,text,text) TO service_role;
COMMIT;
