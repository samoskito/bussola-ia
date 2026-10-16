import { getAgentByType } from '../agents';
import { InsightsError } from './config';
import { INSIGHT_TOPICS } from './taxonomy';
import type { InsightFilters, InsightPeriod, InsightWindow } from './types';

export function parseInsightFilters(params: URLSearchParams, allowExportFormat = false): InsightFilters {
  const allowed = ['days', 'agentType', 'topicId', ...(allowExportFormat ? ['format'] : [])];
  params.forEach((_value, key) => {
    if (!allowed.includes(key) || params.getAll(key).length !== 1) {
      throw new InsightsError(400, 'invalid_filter', 'Filtro desconhecido ou repetido.');
    }
  });
  const days = params.get('days') ?? '30';
  const agentType = params.get('agentType') ?? 'all';
  const topicId = params.get('topicId') ?? undefined;
  if (!['7', '30', '90', 'all'].includes(days) || (agentType !== 'all' && !getAgentByType(agentType)) ||
      (topicId !== undefined && !INSIGHT_TOPICS.some(topic => topic.id === topicId))) {
    throw new InsightsError(400, 'invalid_filter', 'Período, agente ou tema inválido.');
  }
  return { days: days === 'all' ? 'all' : Number(days), agentType: agentType as InsightFilters['agentType'], ...(topicId ? { topicId } : {}) };
}

export function saoPauloDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** São Paulo uses UTC-03 throughout the synthetic demo's contemporary range. */
export function insightWindow(days: InsightPeriod, now: Date, historyStart?: Date): InsightWindow {
  if (!Number.isFinite(now.getTime()) || (days !== 'all' && ![7, 30, 90].includes(days))) throw new Error('invalid_insight_window');
  const today = new Date(`${saoPauloDate(now)}T00:00:00-03:00`);
  if (days === 'all') {
    if (historyStart && (!Number.isFinite(historyStart.getTime()) || historyStart > now)) throw new Error('invalid_history_start');
    const start = historyStart ? new Date(`${saoPauloDate(historyStart)}T00:00:00-03:00`) : today;
    return { start: start.toISOString(), end: now.toISOString(), timezone: 'America/Sao_Paulo' };
  }
  return { start: new Date(today.getTime() - (days - 1) * 86400000).toISOString(), end: now.toISOString(), timezone: 'America/Sao_Paulo' };
}
