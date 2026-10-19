export class OAuthError extends Error {
  constructor(public status: number, public code: string, message = 'OAuth request rejected.') { super(message); }
}
export const MCP_SCOPE = 'insights:read';
export interface OAuthClient { clientId: string; name: string; clientSecretHash?: string; redirectUris: string[]; tokenEndpointAuthMethod?: 'none' | 'client_secret_basic' | 'client_secret_post' }
export interface OAuthConfig { issuer: string; resource: string; protectedResourceMetadataUrl: string; consentSecret: string; clients: OAuthClient[] }
export function isMcpEnabled(env: NodeJS.ProcessEnv = process.env) { return env.INSIGHTS_MCP_ENABLED === 'true'; }
export function getOAuthConfig(env: NodeJS.ProcessEnv = process.env): OAuthConfig {
  if (!isMcpEnabled(env)) throw new OAuthError(503, 'temporarily_unavailable', 'Insights MCP is disabled.');
  try {
    const url = new URL(env.INSIGHTS_MCP_BASE_URL || '');
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
    const secret = env.INSIGHTS_MCP_CONSENT_SECRET || '';
    const otherSecrets=[env.JWT_SECRET, env.INSIGHTS_WORKER_SECRET, env.INSIGHTS_CRON_SECRET, env.OPENAI_API_KEY, env.SUPABASE_SERVICE_ROLE_KEY].filter((value):value is string=>Boolean(value));
    if (Buffer.byteLength(secret) < 32 || otherSecrets.includes(secret)) throw new Error();
    const reservedHashes=[secret,...otherSecrets].map(value=>createHash('sha256').update(value).digest('hex'));
    const clients: OAuthClient[] = JSON.parse(env.INSIGHTS_MCP_CLIENTS_JSON || '[]');
    if (!Array.isArray(clients) || clients.length > 10) throw new Error();
    const ids = new Set<string>();
    for (const client of clients) {
      if (!client || typeof client.clientId !== 'string' || !/^[\w.-]{3,100}$/.test(client.clientId) || ids.has(client.clientId) ||
          typeof client.name !== 'string' || !client.name.trim() || client.name.length > 100 || typeof client.clientSecretHash !== 'string' || !/^[a-f0-9]{64}$/.test(client.clientSecretHash) || client.tokenEndpointAuthMethod !== undefined ||
          !Array.isArray(client.redirectUris) || !client.redirectUris.length || client.redirectUris.length > 10) throw new Error();
      if (reservedHashes.includes(client.clientSecretHash) || clients.some(other=>other!==client && other.clientSecretHash===client.clientSecretHash)) throw new Error();
      ids.add(client.clientId);
      for (const redirect of client.redirectUris) {
        if (typeof redirect !== 'string' || redirect.length > 2048) throw new Error();
        const target = new URL(redirect);
        if (target.protocol !== 'https:' || target.username || target.password || target.hash || target.href !== redirect) throw new Error();
      }
    }
    const issuer = url.origin;
    return { issuer, resource: `${issuer}/api/insights-mcp`, protectedResourceMetadataUrl: `${issuer}/.well-known/oauth-protected-resource/api/insights-mcp`, consentSecret: secret, clients };
  } catch { throw new OAuthError(503, 'temporarily_unavailable', 'OAuth configuration is incomplete.'); }
}
import { createHash } from 'node:crypto';

