import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { MCP_SCOPE, OAuthConfig, OAuthError } from './oauth-config';
import { resolveOAuthClient } from './oauth-registration';

export const ACCESS_SECONDS = 600;
export const REFRESH_SECONDS = 30 * 86400;
export const CODE_SECONDS = 120;
export const CONSENT_SECONDS = 600;
export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
export const randomCredential = () => randomBytes(32).toString('base64url');
export function equalSecret(a: string, b: string) { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
export interface AuthorizationRequest { clientId: string; redirectUri: string; state: string; scope: string; resource: string; codeChallenge: string }
export interface AuthorizationConsent { request: AuthorizationRequest; userId: string; nonce: string; expiresAt: number; clientName: string }
export function uniqueParams(params: URLSearchParams) { params.forEach((_value,key)=>{if (params.getAll(key).length !== 1) throw new OAuthError(400, 'invalid_request');}); }
export function validateAuthorizationRequest(params: URLSearchParams, config: OAuthConfig): AuthorizationRequest {
  uniqueParams(params);
  const clientId = params.get('client_id') || '';
  const client = resolveOAuthClient(clientId, config);
  const redirectUri = params.get('redirect_uri') || '';
  if (!client || !client.redirectUris.includes(redirectUri)) throw new OAuthError(400, 'invalid_request', 'Unregistered OAuth client or redirect URI.');
  if (params.get('response_type') !== 'code' || params.get('code_challenge_method') !== 'S256') throw new OAuthError(400, 'invalid_request', 'Authorization code and S256 PKCE are required.');
  if (params.get('resource') !== config.resource) throw new OAuthError(400, 'invalid_target');
  const scope = params.get('scope') || MCP_SCOPE;
  if (scope !== MCP_SCOPE) throw new OAuthError(400, 'invalid_scope');
  const state = params.get('state') || '';
  const codeChallenge = params.get('code_challenge') || '';
  if (!state || state.length > 1024 || !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)) throw new OAuthError(400, 'invalid_request');
  return { clientId, redirectUri, state, scope, resource: config.resource, codeChallenge };
}
export function signConsent(consent: AuthorizationConsent, secret: string) {
  const payload = Buffer.from(JSON.stringify(consent)).toString('base64url');
  const ticket = `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
  if (ticket.length > 3800) throw new OAuthError(400,'invalid_request','Authorization parameters exceed the consent cookie limit.');
  return ticket;
}
export function verifyConsent(ticket: string | undefined, userId: string, config: OAuthConfig, now = Date.now()): AuthorizationConsent {
  try {
    if (!ticket || ticket.length > 12000) throw new Error();
    const [payload, signature, extra] = ticket.split('.');
    if (extra || !signature || !equalSecret(signature, createHmac('sha256', config.consentSecret).update(payload).digest('base64url'))) throw new Error();
    const consent: AuthorizationConsent = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (consent.userId !== userId || !Number.isFinite(consent.expiresAt) || consent.expiresAt <= now || consent.expiresAt > now + CONSENT_SECONDS * 1000 || !/^[A-Za-z0-9_-]{43}$/.test(consent.nonce)) throw new Error();
    const r = consent.request;
    validateAuthorizationRequest(new URLSearchParams({client_id:r.clientId,redirect_uri:r.redirectUri,state:r.state,scope:r.scope,resource:r.resource,code_challenge:r.codeChallenge,code_challenge_method:'S256',response_type:'code'}),config);
    return { ...consent, clientName: resolveOAuthClient(r.clientId, config)!.name };
  } catch { throw new OAuthError(400, 'invalid_request', 'Consent expired or invalid. Restart the connection.'); }
}
export function verifyPkce(verifier: string, challenge: string) {
  return /^[A-Za-z0-9._~-]{43,128}$/.test(verifier) && equalSecret(createHash('sha256').update(verifier).digest('base64url'), challenge);
}
export function authenticateClient(params: URLSearchParams, authorization: string | null, config: OAuthConfig): string {
  let id = params.get('client_id') || '';
  let secret = params.get('client_secret') || '';
  if (authorization) {
    if (!authorization.startsWith('Basic ') || secret) throw new OAuthError(401, 'invalid_client');
    try {
      const raw = Buffer.from(authorization.slice(6), 'base64').toString(); const colon = raw.indexOf(':');
      if (colon < 0) throw new Error();
      const basicId = decodeURIComponent(raw.slice(0, colon).replace(/\+/g, ' '));
      if (id && id !== basicId) throw new Error();
      id = basicId; secret = decodeURIComponent(raw.slice(colon + 1).replace(/\+/g, ' '));
    } catch { throw new OAuthError(401, 'invalid_client'); }
  }
  const client = resolveOAuthClient(id, config);
  if (client?.tokenEndpointAuthMethod === 'none') {
    if (authorization || params.has('client_secret')) throw new OAuthError(401, 'invalid_client');
    return id;
  }
  if (!secret || secret.length < 32 || secret.length > 1024 || !client?.clientSecretHash || !equalSecret(tokenHash(secret), client.clientSecretHash)) throw new OAuthError(401, 'invalid_client');
  return id;
}
