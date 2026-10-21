import 'server-only';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createLiveMcpServer, type LiveReportReader, type StudentQuestionReader } from './tools';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0', Pragma: 'no-cache', Vary: 'Authorization, Origin', 'X-Content-Type-Options': 'nosniff' };
type Dependencies = {
  enabled: () => boolean;
  canonicalOrigin: () => string;
  authenticate: (request: Request) => Promise<unknown>;
  authError: (error: unknown) => Response;
  readReport: LiveReportReader;
  now?: () => Date;
  examplesEnabled?: () => boolean;
  questions?: StudentQuestionReader;
  questionsEnabled?: () => boolean;
};
function response(status: number, code: string) {
  return Response.json({ error: code }, { status, headers: PRIVATE_HEADERS });
}
function privateResponse(result: Response) {
  Object.entries(PRIVATE_HEADERS).forEach(([key, value]) => result.headers.set(key, value));
  return result;
}

/** Per-request stateless transport. Authentication and current role precede body parsing and data. */
export function createInsightsMcpHandler(deps: Dependencies) {
  return async function handle(request: Request): Promise<Response> {
    if (!deps.enabled()) return response(503, 'mcp_disabled');
    try { await deps.authenticate(request); }
    catch (error) { return privateResponse(deps.authError(error)); }
    let canonical: URL;
    try { canonical = new URL(deps.canonicalOrigin()); }
    catch { return response(503, 'mcp_unavailable'); }
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    if (url.origin !== canonical.origin || (request.headers.has('host') && request.headers.get('host') !== canonical.host) ||
      (origin !== null && origin !== canonical.origin)) return response(403, 'invalid_origin');
    if (request.method !== 'POST') {
      const result = response(405, 'method_not_allowed');
      result.headers.set('Allow', 'POST');
      return result;
    }
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 64 * 1024 });
    const server = createLiveMcpServer(deps.readReport, deps.now, deps.examplesEnabled, deps.questions, deps.questionsEnabled);
    try {
      await server.connect(transport);
      return privateResponse(await transport.handleRequest(request));
    } catch { return response(503, 'mcp_unavailable'); }
    finally { await server.close().catch(() => {}); }
  };
}
