import 'server-only';
import { NextResponse } from 'next/server';
import { requireInsightsAdmin } from './auth';
import { InsightsError, getInsightsMode } from './config';
import { attachmentHeader, EXPORT_CONTENT_TYPES, exportFileName, type ExportFormat } from './export-files';
import { parseInsightFilters } from './filters';
import { csvCell } from './service';
import { getOAuthConfig } from '../insights-mcp/oauth-config';
import { exportLiveStudentQuestions, questionsToCsv, QUESTION_EXPORT_MAX_BYTES } from './questions';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0', Pragma: 'no-cache', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' };

export interface QuestionsExportDeps {
  authorize: () => Promise<void>;
  enabled: () => boolean;
  pseudonymSecret: () => string;
  exporter: typeof exportLiveStudentQuestions;
  now: () => Date;
}

/** Same release gate and rules as list_student_questions: current admin (checked
 * first), live mode, INSIGHTS_MCP_QUESTIONS_ENABLED, MCP pseudonym secret. */
export function defaultQuestionsExportDeps(): QuestionsExportDeps {
  return {
    authorize: requireInsightsAdmin,
    enabled: () => getInsightsMode() === 'live' && process.env.INSIGHTS_MCP_QUESTIONS_ENABLED === 'true',
    // Same secret/HMAC domain as the MCP, so personId/conversationId match list_student_questions.
    pseudonymSecret: () => getOAuthConfig().consentSecret,
    exporter: exportLiveStudentQuestions,
    now: () => new Date(),
  };
}

export async function handleQuestionsExport(request: Request, deps: QuestionsExportDeps = defaultQuestionsExportDeps()) {
  try {
    await deps.authorize();
    const params = new URL(request.url).searchParams;
    const filters = parseInsightFilters(params, true);
    const format = (params.get('format') ?? 'csv') as ExportFormat;
    if (!['json', 'csv'].includes(format)) throw new InsightsError(400, 'invalid_format', 'Formato inválido.');
    if (!deps.enabled()) throw new InsightsError(503, 'questions_export_disabled', 'A exportação das perguntas está desativada nesta instalação.');
    let secret: string;
    try { secret = deps.pseudonymSecret(); } catch { throw new InsightsError(503, 'questions_export_disabled', 'A exportação das perguntas está desativada nesta instalação.'); }
    const data = await deps.exporter({ days: filters.days, agentType: filters.agentType, ...(filters.topicId ? { topicId: filters.topicId } : {}) }, deps.now(), secret);
    const body = format === 'csv' ? questionsToCsv(data, csvCell) : JSON.stringify(data);
    if (Buffer.byteLength(body) > QUESTION_EXPORT_MAX_BYTES) {
      throw new InsightsError(413, 'export_too_large', 'O arquivo excede o limite de exportação. Escolha um período menor ou uma IA específica.');
    }
    const name = exportFileName({ kind: 'perguntas', mode: 'live', days: filters.days, agentType: filters.agentType, format });
    return new NextResponse(body, { headers: { ...PRIVATE_HEADERS, 'Content-Type': EXPORT_CONTENT_TYPES[format], 'Content-Disposition': attachmentHeader(name) } });
  } catch (error) {
    const known = error instanceof InsightsError;
    return NextResponse.json({ error: known ? error.message : 'Não foi possível exportar as perguntas.', code: known ? error.code : 'questions_export_unavailable' },
      { status: known ? error.status : 503, headers: PRIVATE_HEADERS });
  }
}
