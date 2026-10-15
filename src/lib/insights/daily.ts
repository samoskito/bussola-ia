import 'server-only';
import { createOpenAIClassifier, type InsightClassifier } from './classifier';
import { processInsightBatch, type InsightRepository, type ProcessInsightResult } from './processor';
import { createSupabaseInsightRepository } from './supabase-repository';

type Env = Record<string, string | undefined>;
export interface DailyInsightsOptions {
  env?: Env;
  now?: Date;
  repository?: InsightRepository;
  classifier?: InsightClassifier;
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
  const now = options.now ?? new Date();
  let repository = options.repository;
  if (!repository) {
    const { createServerSupabaseClient } = await import('../supabase/server');
    repository = createSupabaseInsightRepository(createServerSupabaseClient({ useServiceRole: true }), {
      env, now, windowStart: new Date(now.getTime() - 33 * 86_400_000),
    });
  }
  const classifier = options.classifier ?? createOpenAIClassifier({ apiKey: env.OPENAI_API_KEY });
  if (classifier.provider !== 'openai') throw new Error('daily_requires_openai_classifier');
  return processInsightBatch({ repository, classifier, maxMessages: 50,
    maxSpendUsd, reserveUsdPerCall: 0.005, budgetScope, now,
    processingStart: new Date(now.getTime() - 30 * 86_400_000),
    clock: options.now ? () => new Date(options.now!.getTime()) : () => new Date() });
}
