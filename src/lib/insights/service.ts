import { NextResponse } from 'next/server';
import { requireInsightsAdmin } from './auth';
import { InsightsError, getInsightsMode, requireDemoMode } from './config';
import { insightWindow, parseInsightFilters } from './filters';
import { buildDemoReport, buildInsightReport } from './report';
import type { DemoMessage } from './fixtures';
import type { InsightFilters, InsightReport } from './types';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0', Pragma: 'no-cache', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' };
export type InsightSection = 'report' | 'summary' | 'topics' | 'trends' | 'examples' | 'export';

/** Apostrophe neutralizes spreadsheet formulas, including whitespace-prefixed payloads. */
export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function reportToCsv(report: InsightReport): string {
  const rows: unknown[][] = [
    ['modo', 'inicio', 'fim', 'dias', 'agente', 'mensagens_elegiveis', 'classificadas', 'pendentes', 'falhas', 'cobertura_pct'],
    [report.mode, report.window.start, report.window.end, report.filters.days, report.filters.agentType,
      report.summary.eligibleMessages, report.summary.classifiedMessages, report.summary.pendingMessages, report.summary.failedMessages, report.summary.coveragePercent],
    [], ['tema_id', 'tema', 'mensagens', 'pessoas', 'conversas', 'participacao_classificadas_pct', 'variacao_pct'],
    ...report.topics.map(topic => [topic.id, topic.label, topic.messages, topic.distinctUsers, topic.distinctChats, topic.sharePercent, topic.trendPercent]),
  ];
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** Read-only live adapter. Flags and migrations must be activated separately;
 * nothing here starts processing or invokes a classification provider. */
export async function buildLiveReport(filters: InsightFilters, now = new Date()): Promise<InsightReport> {
  if (getInsightsMode() !== 'live' || process.env.INSIGHTS_PROCESSING_ENABLED !== 'true') {
    throw new InsightsError(503, 'live_unavailable', 'Insights reais aguardam ativação e validação.');
  }
  const [{ createSupabaseInsightRepository, findInsightHistoryStart }, { createServerSupabaseClient }, { prepareInsightInput, groupInsightSourcesByChat }, { TAXONOMY_VERSION }, { CLASSIFIER_VERSION, getInsightsModel }] = await Promise.all([
    import('./supabase-repository'), import('../supabase/server'), import('./privacy'), import('./taxonomy'), import('./classifier'),
  ]);
  const client = createServerSupabaseClient({ useServiceRole: true });
  const historyStart = filters.days === 'all' ? await findInsightHistoryStart(client, now) : undefined;
  const window = insightWindow(filters.days, now, historyStart);
  const repository = createSupabaseInsightRepository(client, {
    now, windowStart: new Date(Date.parse(window.start) - (filters.days === 'all' ? 3 : filters.days + 3) * 86400000), windowEnd: now,
    allowHistoricalWindow: filters.days === 'all',
  });
  const [sources, jobs, completed] = await Promise.all([repository.listSources(), repository.listJobs(), repository.listCompleted()]);
  // Recheck current levels after the parallel snapshots. No role supplied by a
  // client, stored classification or old job authorizes a metric/example.
  const userIds = Array.from(new Set(sources.map(source => source.userId)));
  const levels = new Map<string, 'user' | 'admin' | null>();
  for (let offset = 0; offset < userIds.length; offset += 20) {
    const chunk = await Promise.all(userIds.slice(offset, offset + 20).map(async userId =>
      [userId, await repository.currentUserLevel(userId)] as const));
    chunk.forEach(([userId, level]) => levels.set(userId, level));
  }
  const currentSources = sources.map(source => ({ ...source, userLevel: levels.get(source.userId) ?? null }));
  const contextByChat = groupInsightSourcesByChat(currentSources);
  const classifierVersion = `${getInsightsModel()}.${CLASSIFIER_VERSION}`;
  const active = new Map(completed.filter(insight => insight.taxonomyVersion === TAXONOMY_VERSION && insight.classifierVersion === classifierVersion)
    .map(insight => [insight.sourceId, insight]));
  const jobByKey = new Map(jobs.map(job => [job.key, job]));
  const processedAt: string[] = [];
  const rows: DemoMessage[] = currentSources.map(source => {
    const base: DemoMessage = { ...source, status: 'pending' };
    if (source.userLevel !== 'user') return base;
    let prepared;
    try { prepared = prepareInsightInput(source, contextByChat.get(source.chatId) ?? [], TAXONOMY_VERSION, classifierVersion); }
    catch { return { ...base, status: jobByKey.get(`rejected:${source.id}`)?.status === 'failed' ? 'failed' : 'pending' }; }
    const insight = active.get(source.id);
    if (insight && insight.sourceHash === prepared.sourceHash && insight.userId === source.userId && insight.chatId === source.chatId &&
        insight.agentType === source.agentType && Date.parse(insight.createdAt) === Date.parse(source.createdAt)) {
      processedAt.push(insight.processedAt);
      return { ...base, status: 'classified', classification: insight.classification };
    }
    const job = jobByKey.get(`${source.id}:${prepared.sourceHash}`);
    return { ...base, status: job?.status === 'failed' ? 'failed' : 'pending' };
  });
  return buildInsightReport(filters, now, rows, { mode: 'live', processing: {
    provider: 'openai', state: 'ready', scheduleLabel: 'Executor diário preparado; agendamento depende de ativação',
    lastProcessedAt: processedAt.sort().at(-1) ?? null,
  } });
}

/** Authorization always precedes configuration/data. GET never starts a worker. */
export async function handleInsightGet(request: Request, section: InsightSection) {
  try {
    await requireInsightsAdmin();
    const params = new URL(request.url).searchParams;
    const filters = parseInsightFilters(params, section === 'export');
    const format = params.get('format') ?? 'json';
    if (section === 'export' && !['json', 'csv'].includes(format)) throw new InsightsError(400, 'invalid_format', 'Formato inválido.');
    const mode = getInsightsMode();
    if (mode !== 'live') requireDemoMode();
    const report = mode === 'live' ? await buildLiveReport(filters) : buildDemoReport(filters);
    if (section === 'export' && format === 'csv') return new NextResponse(reportToCsv(report), {
      headers: { ...PRIVATE_HEADERS, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="insights-${report.mode}.csv"` },
    });
    const metadata = { mode: report.mode, generatedAt: report.generatedAt, window: report.window, filters: report.filters, processing: report.processing };
    const payload = section === 'report' || section === 'export' ? report : section === 'summary' ? { ...metadata, summary: report.summary, agents: report.agents } :
      section === 'topics' ? { ...metadata, summary: report.summary, topics: report.topics } :
      section === 'trends' ? { ...metadata, trend: report.trend } : { ...metadata, examples: report.examples };
    return NextResponse.json(payload, { headers: { ...PRIVATE_HEADERS,
      ...(section === 'export' ? { 'Content-Disposition': `attachment; filename="insights-${report.mode}.json"` } : {}) } });
  } catch (error) {
    const known = error instanceof InsightsError;
    return NextResponse.json({ error: known ? error.message : 'Não foi possível consultar os insights.', code: known ? error.code : 'insights_unavailable' },
      { status: known ? error.status : 503, headers: PRIVATE_HEADERS });
  }
}
