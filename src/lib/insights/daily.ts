import 'server-only';
import { createOpenAIClassifier, getInsightsModel, type InsightClassifier } from './classifier';
import { processInsightBatch, type InsightRepository, type ProcessInsightResult } from './processor';
import { createSupabaseInsightRepository } from './supabase-repository';

type Env = Record<string, string | undefined>;
export interface DailyInsightsOptions {
  env?: Env;
  now?: Date;
  repository?: InsightRepository;
  classifier?: InsightClassifier;
}

/** Only server environment can authorize a bounded historical run. HTTP inputs never reach this configuration. */
export function insightProcessingWindow(env: Env, now: Date) {
  const startValue = env.INSIGHTS_BACKFILL_START;
  const endValue = env.INSIGHTS_BACKFILL_END;
  if (startValue === undefined && endValue === undefined) {
    return { start: new Date(now.getTime() - 30 * 86_400_000), end: now, historical: false };
  }
  const parse = (value: string | undefined) => {
    const date = value ? new Date(value) : new Date(NaN);
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) throw new Error('invalid_backfill_window');
    return date;
  };
  const start = parse(startValue);
  const end = parse(endValue);
  if (start >= end || end > now) throw new Error('invalid_backfill_window');
  // Retain the existing durable scope to account for prior reservations and pilot spend.
  if (!env.INSIGHTS_BUDGET_SCOPE) throw new Error('backfill_budget_scope_required');
  return { start, end, historical: true };
}

/** Invoke only from an authenticated scheduled worker route. No scheduler is installed here. */
export async function runDailyInsights(options: DailyInsightsOptions = {}): Promise<ProcessInsightResult> {
  const env = options.env ?? process.env;
  if (env.INSIGHTS_MODE !== 'live' || env.INSIGHTS_PROCESSING_ENABLED !== 'true' ||
      env.INSIGHTS_OPENAI_ENABLED !== 'true') throw new Error('insights_processing_disabled');
  if (!env.OPENAI_API_KEY) throw new Error('openai_key_missing');
  const maxSpendUsd = Number(env.INSIGHTS_MAX_SPEND_USD ?? '0');
  // This is a ceiling in code, not approval to spend. Explicit environment
  // configuration plus an atomic durable reservation are required to run.
  if (!Number.isFinite(maxSpendUsd) || maxSpendUsd <= 0 || maxSpendUsd > 5) throw new Error('invalid_daily_budget');
  const budgetScope = env.INSIGHTS_BUDGET_SCOPE || 'insights-pilot';
  const pilotIds = env.INSIGHTS_PILOT_SOURCE_IDS;
  const sourceIds = pilotIds === undefined ? undefined : pilotIds.split(',').map(id => /^\d+$/.test(id) ? Number(id) : NaN);
  if (sourceIds && (!sourceIds.length || sourceIds.length > 200 || sourceIds.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(sourceIds).size !== sourceIds.length)) throw new Error('invalid_pilot_sources');
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error('invalid_batch_time');
  const window = insightProcessingWindow(env, now);
  let repository = options.repository;
  if (!repository) {
    const { createServerSupabaseClient } = await import('../supabase/server');
    repository = createSupabaseInsightRepository(createServerSupabaseClient({ useServiceRole: true }), {
      env, now, windowStart: new Date(window.start.getTime() - 3 * 86_400_000), windowEnd: window.end,
      allowHistoricalWindow: window.historical,
    });
  }
  const classifier = options.classifier ?? createOpenAIClassifier({ apiKey: env.OPENAI_API_KEY, model: getInsightsModel(env) });
  if (classifier.provider !== 'openai') throw new Error('daily_requires_openai_classifier');
  return processInsightBatch({ repository, classifier, maxMessages: 10,
    maxSpendUsd, reserveUsdPerCall: getInsightsModel(env) === 'gpt-5.4-nano' ? 0.01 : 0.005, budgetScope, now,
    sourceIds, deadline: new Date(Date.now() + 240_000),
    processingStart: window.start, processingEnd: window.end,
    clock: options.now ? () => new Date(options.now!.getTime()) : () => new Date() });
}
