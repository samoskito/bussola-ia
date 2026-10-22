import { NextResponse } from 'next/server';
import { requireInsightsAdmin } from './auth';
import { InsightsError, getInsightsMode, requireDemoMode } from './config';
import { insightWindow, parseInsightFilters } from './filters';
import { buildDemoReport, buildInsightReport, type ExampleOptions } from './report';
import type { DemoMessage } from './fixtures';
import { attachmentHeader, EXPORT_CONTENT_TYPES, exportFileName, type ExportFormat } from './export-files';
import type { InsightFilters, InsightReport, SourceMessage } from './types';
import type { StoredInsight } from './processor';

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

/** Status derivation shared by aggregate reports and per-message reads. The caller
 * supplies current user levels; anything other than a current 'user' stays pending
 * here and is excluded by every consumer. */
export function deriveSourceStatus(
  source: SourceMessage, context: readonly SourceMessage[], active: StoredInsight | undefined,
  jobStatus: (key: string) => string | undefined, versions: { taxonomyVersion: string; classifierVersion: string },
  prepare: typeof import('./privacy').prepareInsightInput,
): Pick<DemoMessage, 'status' | 'classification'> & { processedAt?: string } {
  if (source.userLevel !== 'user') return { status: 'pending' };
  let prepared;
  try { prepared = prepare(source, context, versions.taxonomyVersion, versions.classifierVersion); }
  catch { return { status: jobStatus(`rejected:${source.id}`) === 'failed' ? 'failed' : 'pending' }; }
  if (active && active.taxonomyVersion === versions.taxonomyVersion && active.classifierVersion === versions.classifierVersion &&
      active.sourceHash === prepared.sourceHash && active.userId === source.userId && active.chatId === source.chatId &&
      active.agentType === source.agentType && Date.parse(active.createdAt) === Date.parse(source.createdAt)) {
    return { status: 'classified', classification: active.classification, processedAt: active.processedAt };
  }
  return { status: jobStatus(`${source.id}:${prepared.sourceHash}`) === 'failed' ? 'failed' : 'pending' };
}

export interface LiveInsightSource {
  client: ReturnType<typeof import('../supabase/server').createServerSupabaseClient>;
  versions: { taxonomyVersion: string; classifierVersion: string };
  historyStart(): Promise<Date | undefined>;
  /** Rows from windowStart to now with current levels and derived status. */
  load(windowStart: Date, allowHistoricalWindow: boolean): Promise<{ rows: DemoMessage[]; lastProcessedAt: string | null }>;
}

/** Read-only live source. Flags and migrations must be activated separately;
 * nothing here starts processing or invokes a classification provider. */
export async function openLiveInsightSource(now: Date): Promise<LiveInsightSource> {
  if (getInsightsMode() !== 'live' || process.env.INSIGHTS_PROCESSING_ENABLED !== 'true') {
    throw new InsightsError(503, 'live_unavailable', 'Insights reais aguardam ativação e validação.');
  }
  const [{ createSupabaseInsightRepository, findInsightHistoryStart }, { createServerSupabaseClient }, { prepareInsightInput, groupInsightSourcesByChat }, { TAXONOMY_VERSION }, { CLASSIFIER_VERSION, getInsightsModel }] = await Promise.all([
    import('./supabase-repository'), import('../supabase/server'), import('./privacy'), import('./taxonomy'), import('./classifier'),
  ]);
  const client = createServerSupabaseClient({ useServiceRole: true });
  const versions = { taxonomyVersion: TAXONOMY_VERSION, classifierVersion: `${getInsightsModel()}.${CLASSIFIER_VERSION}` };
  return {
    client, versions,
    historyStart: () => findInsightHistoryStart(client, now),
    async load(windowStart, allowHistoricalWindow) {
      const repository = createSupabaseInsightRepository(client, { now, windowStart, windowEnd: now, allowHistoricalWindow });
      // Read-path accelerators when available: parallel id slices, stored insights
      // without a second full source scan (deriveSourceStatus below re-verifies every
      // hash against the fresh sources), and only the failed jobs it inspects.
      const [sources, jobs, completed] = await Promise.all([
        repository.listSourcesForRead ? repository.listSourcesForRead() : repository.listSources(),
        repository.listFailedJobsForRead ? repository.listFailedJobsForRead() : repository.listJobs(),
        repository.listActiveInsightsForRead ? repository.listActiveInsightsForRead() : repository.listCompleted()]);
      // Recheck current levels after the parallel snapshots. No role supplied by a
      // client, stored classification or old job authorizes a metric/example.
      const userIds = Array.from(new Set(sources.map(source => source.userId)));
      let levels = new Map<string, 'user' | 'admin' | null>();
      if (repository.currentUserLevels) levels = await repository.currentUserLevels(userIds);
      else for (let offset = 0; offset < userIds.length; offset += 20) {
        const chunk = await Promise.all(userIds.slice(offset, offset + 20).map(async userId =>
          [userId, await repository.currentUserLevel(userId)] as const));
        chunk.forEach(([userId, level]) => levels.set(userId, level));
      }
      const currentSources = sources.map(source => ({ ...source, userLevel: levels.get(source.userId) ?? null }));
      const contextByChat = groupInsightSourcesByChat(currentSources);
      const active = new Map(completed.map(insight => [insight.sourceId, insight]));
      const jobByKey = new Map(jobs.map(job => [job.key, job.status as string]));
      const processedAt: string[] = [];
      const rows: DemoMessage[] = currentSources.map(source => {
        const { processedAt: at, ...derived } = deriveSourceStatus(source, contextByChat.get(source.chatId) ?? [], active.get(source.id),
          key => jobByKey.get(key), versions, prepareInsightInput);
        if (at) processedAt.push(at);
        return { ...source, ...derived };
      });
      return { rows, lastProcessedAt: processedAt.sort().at(-1) ?? null };
    },
  };
}

export async function buildLiveReport(filters: InsightFilters, now = new Date(), examples?: ExampleOptions): Promise<InsightReport> {
  const source = await openLiveInsightSource(now);
  const historyStart = filters.days === 'all' ? await source.historyStart() : undefined;
  const window = insightWindow(filters.days, now, historyStart);
  const { rows, lastProcessedAt } = await source.load(
    new Date(Date.parse(window.start) - (filters.days === 'all' ? 3 : filters.days + 3) * 86400000), filters.days === 'all');
  return buildInsightReport(filters, now, rows, { mode: 'live', examples, processing: {
    provider: 'openai', state: 'ready', scheduleLabel: process.env.INSIGHTS_DAILY_SCHEDULE_ENABLED === 'true'
      ? 'Agendamento diário 03:17 BRT configurado; conferir o último processamento'
      : 'Executor diário preparado; agendamento depende de ativação',
    lastProcessedAt,
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
    if (section === 'export') {
      const exportFormat = format as ExportFormat;
      const name = exportFileName({ kind: 'insights', mode: report.mode, days: filters.days, agentType: filters.agentType, format: exportFormat });
      return new NextResponse(exportFormat === 'csv' ? reportToCsv(report) : JSON.stringify(report, null, 2), {
        headers: { ...PRIVATE_HEADERS, 'Content-Type': EXPORT_CONTENT_TYPES[exportFormat], 'Content-Disposition': attachmentHeader(name) },
      });
    }
    const metadata = { mode: report.mode, generatedAt: report.generatedAt, window: report.window, filters: report.filters, processing: report.processing };
    const payload = section === 'report' ? report : section === 'summary' ? { ...metadata, summary: report.summary, agents: report.agents } :
      section === 'topics' ? { ...metadata, summary: report.summary, topics: report.topics } :
      section === 'trends' ? { ...metadata, trend: report.trend } : { ...metadata, examples: report.examples };
    return NextResponse.json(payload, { headers: PRIVATE_HEADERS });
  } catch (error) {
    const known = error instanceof InsightsError;
    return NextResponse.json({ error: known ? error.message : 'Não foi possível consultar os insights.', code: known ? error.code : 'insights_unavailable' },
      { status: known ? error.status : 503, headers: PRIVATE_HEADERS });
  }
}
