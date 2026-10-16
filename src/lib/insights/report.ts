import { AGENTS } from '../agents';
import { createDemoFixtures, type DemoMessage } from './fixtures';
import { insightWindow, saoPauloDate } from './filters';
import { INSIGHT_TOPICS } from './taxonomy';
import type { InsightFilters, InsightReport } from './types';

const round = (value: number) => Math.round(value * 10) / 10;
const distinct = (rows: DemoMessage[], key: 'userId' | 'chatId') => new Set(rows.map(row => row[key])).size;

export interface ReportMetadata {
  mode: 'demo' | 'live';
  processing: InsightReport['processing'];
}

export function buildInsightReport(filters: InsightFilters, now: Date, fixtures: DemoMessage[], metadata: ReportMetadata): InsightReport {
  const oldest = filters.days === 'all' ? fixtures.reduce((time, row) => {
    const candidate = Date.parse(row.createdAt);
    return Number.isFinite(candidate) && candidate <= time ? candidate : time;
  }, now.getTime()) : undefined;
  const window = insightWindow(filters.days, now, oldest === undefined ? undefined : new Date(oldest));
  const start = Date.parse(window.start);
  const end = Date.parse(window.end);
  const previousStart = filters.days === 'all' ? NaN : start - filters.days * 86400000;
  const previousEnd = filters.days === 'all' ? NaN : end - filters.days * 86400000;
  const inAgent = (row: DemoMessage) => filters.agentType === 'all' || row.agentType === filters.agentType;
  const inTopic = (row: DemoMessage) => !filters.topicId || Boolean(row.classification?.topicIds.includes(filters.topicId));
  const current = fixtures.filter(row => inAgent(row) && Date.parse(row.createdAt) >= start && Date.parse(row.createdAt) <= end);
  // Unknown user levels fail closed too; administrative data never reaches aggregate helpers.
  const eligible = current.filter(row => row.userLevel === 'user');
  const classified = eligible.filter(row => row.status === 'classified' && row.classification);
  const visibleClassified = classified.filter(inTopic);
  const visibleEligible = eligible.filter(inTopic);
  const previous = fixtures.filter(row => row.userLevel === 'user' && inAgent(row) && inTopic(row) &&
    row.status === 'classified' && row.classification && Date.parse(row.createdAt) >= previousStart && Date.parse(row.createdAt) <= previousEnd);
  const topics = INSIGHT_TOPICS.filter(topic => !filters.topicId || topic.id === filters.topicId).map(topic => {
    const rows = visibleClassified.filter(row => row.classification!.topicIds.includes(topic.id));
    const previousCount = previous.filter(row => row.classification!.topicIds.includes(topic.id)).length;
    return { ...topic, messages: rows.length, distinctUsers: distinct(rows, 'userId'), distinctChats: distinct(rows, 'chatId'),
      sharePercent: visibleClassified.length ? round(rows.length / visibleClassified.length * 100) : 0,
      trendPercent: previousCount ? round((rows.length - previousCount) / previousCount * 100) : null };
  }).sort((a, b) => b.messages - a.messages || a.id.localeCompare(b.id));
  const trendDays = filters.days === 'all' ? Math.floor((Date.parse(`${saoPauloDate(now)}T00:00:00-03:00`) - start) / 86400000) + 1 : filters.days;
  const byDate = new Map<string, { messages: number; classifiedMessages: number }>();
  for (const row of visibleEligible) {
    const date = saoPauloDate(new Date(row.createdAt));
    const counts = byDate.get(date) ?? { messages: 0, classifiedMessages: 0 };
    counts.messages++;
    if (row.status === 'classified') counts.classifiedMessages++;
    byDate.set(date, counts);
  }
  const trend = Array.from({ length: trendDays }, (_, index) => {
    const date = saoPauloDate(new Date(start + index * 86400000));
    return { date, ...(byDate.get(date) ?? { messages: 0, classifiedMessages: 0 }) };
  });
  return {
    mode: metadata.mode, generatedAt: now.toISOString(), window, filters,
    // Coverage remains the whole selected period/agent. Pending rows have no known topic yet.
    summary: { eligibleMessages: eligible.length, classifiedMessages: classified.length,
      pendingMessages: eligible.filter(row => row.status === 'pending').length,
      failedMessages: eligible.filter(row => row.status === 'failed').length,
      excludedAdminMessages: current.filter(row => row.userLevel === 'admin').length,
      distinctUsers: distinct(eligible, 'userId'), distinctChats: distinct(eligible, 'chatId'),
      coveragePercent: eligible.length ? round(classified.length / eligible.length * 100) : 0 },
    topics, trend,
    agents: AGENTS.filter(agent => filters.agentType === 'all' || agent.type === filters.agentType).map(agent => {
      const rows = visibleEligible.filter(row => row.agentType === agent.type);
      return { agentType: agent.type, messages: rows.length, distinctUsers: distinct(rows, 'userId'), distinctChats: distinct(rows, 'chatId') };
    }),
    examples: visibleClassified.filter(row => row.classification!.topicIds.length > 0)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id - b.id).slice(0, 12).map((row, index) => ({
        id: `example-${index + 1}`, topicId: filters.topicId || row.classification!.topicIds[0], agentType: row.agentType,
        demand: row.classification!.normalizedDemand, kind: row.classification!.kind,
        confidence: row.classification!.confidence, needsReview: row.classification!.needsReview, createdAt: row.createdAt,
      })),
    processing: metadata.processing,
  };
}

export function buildDemoReport(filters: InsightFilters, now: Date = new Date(), fixtures = createDemoFixtures(now)): InsightReport {
  return buildInsightReport(filters, now, fixtures, { mode: 'demo', processing: {
    provider: 'mock', state: 'demo', scheduleLabel: 'Simulação determinística; atualização diária real ainda não ativada', lastProcessedAt: now.toISOString(),
  } });
}
