import 'server-only';
import type { createServerSupabaseClient } from '../supabase/server';
import type { SourceMessage } from './types';
import { CLASSIFIER_VERSION, getInsightsModel, validateClassification } from './classifier';
import type { ClaimResult, InsightJob, InsightRepository, StoredInsight } from './processor';
import { prepareInsightInput } from './privacy';
import { TAXONOMY_VERSION } from './taxonomy';

type ServiceClient = ReturnType<typeof createServerSupabaseClient>;

const PAGE_SIZE = 500;
const MAX_ROWS = 20_000;
const AGENTS = new Set(['comunicacao', 'apresentacao', 'conversas_dificeis', 'postagem']);

type DbRow = Record<string, unknown>;
type Env = Record<string, string | undefined>;

function assertLive(env: Env): void {
  if (env.INSIGHTS_MODE !== 'live') throw new Error('insights_live_disabled');
}
function record(value: unknown): DbRow | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as DbRow : null;
}
function related(value: unknown): DbRow | null {
  return record(Array.isArray(value) ? value[0] : value);
}
function assertNoDbError(error: unknown): void {
  if (error) throw new Error('insights_repository_error'); // Never include SQL, row or secret in logs.
}
function parseSource(row: unknown): SourceMessage {
  const item = record(row);
  const user = related(item?.users);
  const chat = related(item?.chats);
  if (!item || !Number.isInteger(item.id) || typeof item.user_id !== 'string' || typeof item.chatid !== 'string' ||
      typeof item.input !== 'string' || typeof item.created_at !== 'string' ||
      !chat || chat.user_id !== item.user_id || !AGENTS.has(String(chat.agent_type)) || !user) {
    throw new Error('invalid_source_relationship');
  }
  if (!['user', 'admin', null].includes(user.nivel as string | null)) throw new Error('invalid_user_level');
  return {
    id: item.id as number, userId: item.user_id, chatId: item.chatid,
    agentType: chat.agent_type as SourceMessage['agentType'], input: item.input,
    createdAt: item.created_at, userLevel: user.nivel as SourceMessage['userLevel'],
  };
}
function parseJob(row: unknown): InsightJob {
  const item = record(row);
  if (!item || typeof item.job_key !== 'string' || !Number.isInteger(item.script_id) ||
      typeof item.user_id !== 'string' || typeof item.source_hash !== 'string' ||
      !['processing', 'completed', 'retry', 'failed'].includes(String(item.status)) ||
      !Number.isInteger(item.attempts)) throw new Error('invalid_job_row');
  return {
    key: item.job_key, sourceId: item.script_id as number, userId: item.user_id,
    sourceHash: item.source_hash, status: item.status as InsightJob['status'],
    attempts: item.attempts as number,
    nextAttemptAt: typeof item.next_attempt_at === 'string' ? item.next_attempt_at : null,
    lockedUntil: typeof item.locked_until === 'string' ? item.locked_until : null,
    lockToken: typeof item.lock_token === 'string' ? item.lock_token : null,
    errorCode: typeof item.error_code === 'string' ? item.error_code : null,
  };
}
function parseInsight(row: unknown): StoredInsight | null {
  const item = record(row);
  const user = related(item?.users);
  if (!item || user?.nivel !== 'user') return null;
  if (!Number.isInteger(item.script_id) || typeof item.user_id !== 'string' || typeof item.chat_id !== 'string' ||
      !AGENTS.has(String(item.agent_type)) || typeof item.source_created_at !== 'string' ||
      typeof item.source_hash !== 'string' || typeof item.taxonomy_version !== 'string' ||
      typeof item.classifier_version !== 'string' || typeof item.processed_at !== 'string') throw new Error('invalid_insight_row');
  const classification = validateClassification({
    kind: item.message_kind, topicIds: item.topic_ids, normalizedDemand: item.normalized_demand,
    confidence: item.confidence, needsReview: item.needs_review,
  });
  return {
    sourceId: item.script_id as number, userId: item.user_id, chatId: item.chat_id,
    agentType: item.agent_type as SourceMessage['agentType'], createdAt: item.source_created_at,
    sourceHash: item.source_hash, taxonomyVersion: item.taxonomy_version,
    classifierVersion: item.classifier_version, classification,
    processedAt: item.processed_at, usage: null,
  };
}

/** No query runs during construction. Requires a server-only service-role client. */
export function createSupabaseInsightRepository(
  client: ServiceClient,
  options: { env?: Env; now?: Date; windowStart?: Date; windowEnd?: Date } = {},
): InsightRepository {
  assertLive(options.env ?? process.env);
  const model = getInsightsModel(options.env ?? process.env);
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error('invalid_repository_time');
  const end = options.windowEnd ?? now;
  const start = options.windowStart ?? new Date(end.getTime() - 30 * 86_400_000);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end > now ||
      start >= end || end.getTime() - start.getTime() > 190 * 86_400_000) throw new Error('invalid_repository_window');
  const windowStart = start.toISOString();
  const windowEnd = end.toISOString();
  const fetchSources = async (): Promise<SourceMessage[]> => {
    const all: SourceMessage[] = [];
    for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
      const { data, error } = await client.from('scripts')
        .select('id,user_id,chatid,input,created_at,users!scripts_user_id_fkey(nivel),chats!scripts_chatid_fkey(agent_type,user_id)')
        .gte('created_at', windowStart).lt('created_at', windowEnd)
        .order('created_at', { ascending: true }).order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      assertNoDbError(error);
      if (!Array.isArray(data)) throw new Error('invalid_source_page');
      all.push(...data.map(parseSource));
      if (data.length < PAGE_SIZE) return all;
    }
    throw new Error('source_cap_reached');
  };
  return {
    listSources: fetchSources,
    async currentUserLevel(userId) {
      const { data, error } = await client.from('users').select('nivel').eq('id', userId).maybeSingle();
      assertNoDbError(error);
      const level = record(data)?.nivel;
      if (level === 'user' || level === 'admin') return level;
      return null;
    },
    async removeDerivedByUser(userId) {
      const { error } = await client.rpc('insights_remove_derived_by_user', { p_user_id: userId });
      assertNoDbError(error);
    },
    async recordRejected(source, errorCode) {
      const { error } = await client.rpc('insights_reject_job', {
        p_script_id: source.id, p_user_id: source.userId, p_error_code: errorCode,
        p_now: now.toISOString(),
      });
      assertNoDbError(error);
    },
    async getJob(key) {
      const { data, error } = await client.from('insight_jobs')
        .select('job_key,script_id,user_id,source_hash,taxonomy_version,classifier_version,status,attempts,next_attempt_at,locked_until,lock_token,error_code')
        .eq('job_key', key).maybeSingle();
      assertNoDbError(error);
      if (!data) return null;
      const job = parseJob(data);
      if (job.status !== 'completed') return job;
      const { data: active, error: activeError } = await client.from('script_insights')
        .select('source_hash,taxonomy_version,classifier_version')
        .eq('script_id', job.sourceId).eq('status', 'classified').maybeSingle();
      assertNoDbError(activeError);
      const row = record(active);
      if (row?.source_hash === job.sourceHash && row?.taxonomy_version === record(data)?.taxonomy_version &&
          row?.classifier_version === record(data)?.classifier_version) return job;
      return { ...job, status: 'retry' };
    },
    async reserveBudget(scope, amountUsd, capUsd) {
      const { data, error } = await client.rpc('insights_reserve_budget', {
        p_scope: scope, p_amount_usd: amountUsd, p_cap_usd: capUsd,
      });
      assertNoDbError(error);
      if (typeof data !== 'boolean') throw new Error('invalid_budget_result');
      return data;
    },
    async releaseBudget(scope, amountUsd) {
      const { error } = await client.rpc('insights_release_budget', { p_scope: scope, p_amount_usd: amountUsd });
      assertNoDbError(error);
    },
    async claim(key, sourceId, userId, sourceHash, taxonomyVersion, classifierVersion, claimNow, lockMs, maxAttempts) {
      const [scriptId, hash] = key.split(':');
      if (Number(scriptId) !== sourceId || hash !== sourceHash) throw new Error('invalid_job_key');
      const { data, error } = await client.rpc('insights_claim_job', {
        p_job_key: key, p_script_id: sourceId, p_user_id: userId, p_source_hash: sourceHash,
        p_taxonomy_version: taxonomyVersion, p_classifier_version: classifierVersion,
        p_provider: 'openai', p_model: model,
        p_now: claimNow.toISOString(), p_lock_ms: lockMs, p_max_attempts: maxAttempts,
      });
      assertNoDbError(error);
      const item = record(data);
      if (!item || !['claimed', 'completed', 'locked', 'waiting', 'failed'].includes(String(item.state))) throw new Error('invalid_claim_result');
      if (item.state === 'claimed' && typeof item.token !== 'string') throw new Error('invalid_claim_token');
      return { state: item.state, token: item.token } as ClaimResult;
    },
    async complete(key, token, insight) {
      // Re-read current source/context immediately before the CAS completion.
      // This catches edits/deletions/role changes since the model request.
      const latest = await fetchSources();
      const source = latest.find(row => row.id === insight.sourceId);
      if (!source || source.userLevel !== 'user') return false;
      let currentHash: string;
      try {
        currentHash = prepareInsightInput(source, latest, insight.taxonomyVersion, insight.classifierVersion).sourceHash;
      } catch { return false; }
      if (currentHash !== insight.sourceHash) return false;
      const { data, error } = await client.rpc('insights_complete_job', {
        p_job_key: key, p_lock_token: token, p_classification: insight.classification,
        p_processed_at: insight.processedAt, p_usage: insight.usage,
        p_agent_type: insight.agentType, p_chat_id: insight.chatId, p_created_at: insight.createdAt,
      });
      assertNoDbError(error);
      if (typeof data !== 'boolean') throw new Error('invalid_complete_result');
      return data;
    },
    async fail(key, token, failedAt, errorCode, maxAttempts) {
      const { data, error } = await client.rpc('insights_fail_job', {
        p_job_key: key, p_lock_token: token, p_now: failedAt.toISOString(),
        p_error_code: errorCode, p_max_attempts: maxAttempts,
      });
      assertNoDbError(error);
      if (typeof data !== 'boolean') throw new Error('invalid_fail_result');
      return data;
    },
    async listCompleted() {
      const all: StoredInsight[] = [];
      let reachedEnd = false;
      for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
        const { data, error } = await client.from('script_insights')
          .select('script_id,user_id,chat_id,agent_type,source_created_at,source_hash,taxonomy_version,classifier_version,message_kind,topic_ids,normalized_demand,confidence,needs_review,processed_at,users!script_insights_user_id_fkey(nivel)')
          .eq('status', 'classified').gte('source_created_at', windowStart).lt('source_created_at', windowEnd)
          .eq('taxonomy_version', TAXONOMY_VERSION).eq('classifier_version', `${model}.${CLASSIFIER_VERSION}`)
          .order('script_id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
        assertNoDbError(error);
        if (!Array.isArray(data)) throw new Error('invalid_insight_page');
        for (const row of data) { const insight = parseInsight(row); if (insight) all.push(insight); }
        if (data.length < PAGE_SIZE) { reachedEnd = true; break; }
      }
      if (!reachedEnd) throw new Error('insight_cap_reached');
      const latest = await fetchSources();
      const byId = new Map(latest.map(row => [row.id, row]));
      return all.filter(insight => {
        const source = byId.get(insight.sourceId);
        if (!source || source.userLevel !== 'user') return false;
        try {
          return prepareInsightInput(source, latest, insight.taxonomyVersion, insight.classifierVersion).sourceHash === insight.sourceHash;
        } catch { return false; }
      });
    },
    async listJobs() {
      const all: InsightJob[] = [];
      for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
        const { data, error } = await client.from('insight_jobs')
          .select('job_key,script_id,user_id,source_hash,status,attempts,next_attempt_at,locked_until,lock_token,error_code')
          .gte('created_at', windowStart).lt('created_at', windowEnd)
          .order('created_at', { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
        assertNoDbError(error);
        if (!Array.isArray(data)) throw new Error('invalid_job_page');
        all.push(...data.map(parseJob));
        if (data.length < PAGE_SIZE) return all;
      }
      throw new Error('job_cap_reached');
    },
  };
}
