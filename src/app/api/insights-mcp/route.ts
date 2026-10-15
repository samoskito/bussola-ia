import { createInsightsMcpHandler } from '@/lib/insights-mcp/protocol';
import { authenticateMcpRequest, mcpAuthErrorResponse } from '@/lib/insights-mcp/oauth-server';
import { isMcpEnabled, getOAuthConfig } from '@/lib/insights-mcp/oauth-config';
import { buildLiveReport } from '@/lib/insights/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const handle = createInsightsMcpHandler({ enabled: isMcpEnabled, canonicalOrigin: () => getOAuthConfig().issuer,
  authenticate: authenticateMcpRequest, authError: mcpAuthErrorResponse, readReport: buildLiveReport,
  examplesEnabled: () => process.env.INSIGHTS_MCP_EXAMPLES_ENABLED === 'true' });
export const POST = handle;
export const GET = handle;
export const DELETE = handle;
export const PUT = handle;
export const PATCH = handle;
export const OPTIONS = handle;
