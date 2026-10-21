import { createInsightsMcpHandler } from '@/lib/insights-mcp/protocol';
import { authenticateMcpRequest, mcpAuthErrorResponse } from '@/lib/insights-mcp/oauth-server';
import { isMcpEnabled, getOAuthConfig } from '@/lib/insights-mcp/oauth-config';
import { buildLiveReport } from '@/lib/insights/service';
import { getLiveStudentQuestion, listLiveStudentQuestions } from '@/lib/insights/questions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Pseudonyms use a dedicated HMAC domain of the MCP consent secret (never returned).
const handle = createInsightsMcpHandler({ enabled: isMcpEnabled, canonicalOrigin: () => getOAuthConfig().issuer,
  authenticate: authenticateMcpRequest, authError: mcpAuthErrorResponse, readReport: buildLiveReport,
  examplesEnabled: () => process.env.INSIGHTS_MCP_EXAMPLES_ENABLED === 'true',
  questionsEnabled: () => process.env.INSIGHTS_MCP_QUESTIONS_ENABLED === 'true',
  questions: {
    list: (query, now) => listLiveStudentQuestions(query, now, getOAuthConfig().consentSecret),
    get: (input, now) => getLiveStudentQuestion(input, now, getOAuthConfig().consentSecret),
  } });
export const POST = handle;
export const GET = handle;
export const DELETE = handle;
export const PUT = handle;
export const PATCH = handle;
export const OPTIONS = handle;
