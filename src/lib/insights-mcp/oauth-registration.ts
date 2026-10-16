import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { MCP_SCOPE, OAuthClient, OAuthConfig, OAuthError } from './oauth-config';

// No network lookup or registration table: signed, bounded metadata is the client ID.
// The nonce isolates each installation; PKCE and the exact redirect bind authorization.
const redirects = [
  'https://claude.ai/api/mcp/auth_callback',
  'https://claude.com/api/mcp/auth_callback',
  'https://chatgpt.com/connector_platform_oauth_redirect',
] as const;
const signature = (payload: string, config: OAuthConfig) => createHmac('sha256', config.consentSecret)
  .update(`insights-mcp-public-client-v1\n${config.issuer}\n${payload}`).digest('base64url');
export function resolveOAuthClient(clientId: string, config: OAuthConfig): OAuthClient | undefined {
  const existing = config.clients.find(client => client.clientId === clientId);
  if (existing) return existing;
  if (clientId.length > 512 || !/^dcr1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(clientId)) return undefined;
  try {
    const [, payload, signed] = clientId.split('.');
    const expected = signature(payload, config);
    if (!timingSafeEqual(Buffer.from(signed), Buffer.from(expected))) return undefined;
    const metadata = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!Array.isArray(metadata.r) || !metadata.r.length || metadata.r.length > 2 ||
        !/^[A-Za-z0-9_-]{22}$/.test(metadata.n) || metadata.r.some((index: unknown) => !Number.isInteger(index) || !redirects[index as number]) ||
        new Set(metadata.r).size !== metadata.r.length || (metadata.r.includes(2) && metadata.r.length !== 1)) return undefined;
    return { clientId, name: metadata.r.includes(2) ? 'ChatGPT' : 'Claude', redirectUris: metadata.r.map((index: number) => redirects[index]), tokenEndpointAuthMethod: 'none' };
  } catch { return undefined; }
}
export function registerOAuthClient(metadata: unknown, config: OAuthConfig) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new OAuthError(400, 'invalid_client_metadata');
  const value = metadata as Record<string, unknown>;
  const uris = value.redirect_uris;
  if (!Array.isArray(uris) || !uris.length || uris.length > 2 || new Set(uris).size !== uris.length ||
      uris.some(uri => typeof uri !== 'string' || !redirects.includes(uri as typeof redirects[number]))) throw new OAuthError(400, 'invalid_redirect_uri');
  const indexes = uris.map(uri => redirects.indexOf(uri));
  if (indexes.includes(2) && indexes.length !== 1) throw new OAuthError(400, 'invalid_redirect_uri');
  if ((value.token_endpoint_auth_method !== undefined && value.token_endpoint_auth_method !== 'none') ||
      (value.scope !== undefined && value.scope !== MCP_SCOPE) ||
      (value.grant_types !== undefined && (!Array.isArray(value.grant_types) || !value.grant_types.includes('authorization_code') || value.grant_types.some(grant => grant !== 'authorization_code' && grant !== 'refresh_token'))) ||
      (value.response_types !== undefined && (!Array.isArray(value.response_types) || value.response_types.length !== 1 || value.response_types[0] !== 'code')) ||
      (value.application_type !== undefined && value.application_type !== 'web') ||
      ['jwks', 'jwks_uri', 'request_uris', 'software_statement', 'client_secret'].some(key => value[key] !== undefined)) throw new OAuthError(400, 'invalid_client_metadata');
  const payload = Buffer.from(JSON.stringify({ r: indexes, n: randomBytes(16).toString('base64url') })).toString('base64url');
  const clientId = `dcr1.${payload}.${signature(payload, config)}`;
  return { client_id: clientId, client_id_issued_at: Math.floor(Date.now() / 1000), client_name: indexes.includes(2) ? 'ChatGPT' : 'Claude',
    redirect_uris: uris, token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], scope: MCP_SCOPE };
}
