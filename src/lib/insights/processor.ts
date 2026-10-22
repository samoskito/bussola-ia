import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Classification, SourceMessage } from './types';
import { validateClassification, type InsightClassifier, type TokenUsage } from './classifier';
import { prepareInsightInput, groupInsightSourcesByChat } from './privacy';
import { TAXONOMY_VERSION } from './taxonomy';

export interface StoredInsight {
  sourceId: number; userId: string; chatId: string; agentType: SourceMessage['agentType'];
  createdAt: string; sourceHash: string; taxonomyVersion: string; classifierVersion: string;
  classification: Classification; processedAt: string; usage: TokenUsage | null;
}
export type JobStatus = 'processing' | 'completed' | 'retry' | 'failed';
export interface InsightJob {
  key: string; sourceId: number; userId: string; sourceHash: string;
  status: JobStatus; attempts: number; nextAttemptAt: string | null;
  lockedUntil: string | null; lockToken: string | null; errorCode: string | null;
}
export interface ClaimResult { state: 'claimed' | 'completed' | 'locked' | 'waiting' | 'failed'; token?: string; }

/** A production implementation needs durable atomic compare-and-set and role checks. */
export interface InsightRepository {
  listSources(): Promise<SourceMessage[]>;
  currentUserLevel(userId: string): Promise<SourceMessage['userLevel']>;
  removeDerivedByUser(userId: string): Promise<void>;
  recordRejected(source: SourceMessage, errorCode: string): Promise<void>;
  getJob(key: string): Promise<InsightJob | null>;
  reserveBudget(scope: string, amountUsd: number, capUsd: number): Promise<boolean>;
  releaseBudget(scope: string, amountUsd: number): Promise<void>;
  claim(key: string, sourceId: number, userId: string, sourceHash: string, taxonomyVersion: string, classifierVersion: string, now: Date, lockMs: number, maxAttempts: number): Promise<ClaimResult>;
  complete(key: string, token: string, insight: StoredInsight): Promise<boolean>;
  fail(key: string, token: string, now: Date, errorCode: string, maxAttempts: number): Promise<boolean>;
  listCompleted(): Promise<StoredInsight[]>;
  listJobs(): Promise<InsightJob[]>;
  /** Read-only rejection snapshot, independent of source-window job creation dates. */
  listRejectedSources?(): Promise<Array<{ sourceId: number; userId: string }>>;
  /* Optional read-path accelerators used only by the live report/question reads
   * (never by the processor). Results are equivalent snapshots of the methods above;
   * callers still derive status with fresh hashes and current user levels. */
  /** Same rows as listSources(), fetched in parallel id slices, sorted by (createdAt, id). */
  listSourcesForRead?(): Promise<SourceMessage[]>;
  /** Stored classifications NOT re-verified against sources: the caller must verify hashes. */
  listActiveInsightsForRead?(): Promise<StoredInsight[]>;
  /** Only jobs with status 'failed' (the only status consumers of the read path inspect). */
  listFailedJobsForRead?(): Promise<InsightJob[]>;
  /** Current levels for many users in batched requests; missing users map to null. */
  currentUserLevels?(userIds: readonly string[]): Promise<Map<string, SourceMessage['userLevel']>>;
}

export interface InMemoryInsightRepository extends InsightRepository {
  setCurrentUserLevel(userId: string, level: SourceMessage['userLevel']): void;
  upsertSource(source: SourceMessage): void;
  deleteSource(sourceId: number): void;
}

export function createInMemoryInsightRepository(sources: readonly SourceMessage[]): InMemoryInsightRepository {
  // Ephemeral fixture implementation. Never present this as a daily or production store.
  const sourceRows = [...sources];
  const levels = new Map(sources.map(row => [row.userId, row.userLevel]));
  const jobs = new Map<string, InsightJob>();
  const completed = new Map<number, StoredInsight>();
  const reservations = new Map<string, number>();
  return {
    setCurrentUserLevel(userId, level) { levels.set(userId, level); },
    upsertSource(source) {
      const index = sourceRows.findIndex(row => row.id === source.id);
      if (index >= 0) sourceRows[index] = source; else sourceRows.push(source);
      levels.set(source.userId, source.userLevel);
    },
    deleteSource(sourceId) {
      const index = sourceRows.findIndex(row => row.id === sourceId);
      if (index >= 0) sourceRows.splice(index, 1);
      completed.delete(sourceId);
      jobs.forEach((item, key) => { if (item.sourceId === sourceId) jobs.delete(key); });
    },
    async listSources() { return sourceRows.map(row => ({ ...row, userLevel: levels.get(row.userId) ?? null })); },
    async currentUserLevel(userId) { return levels.get(userId) ?? null; },
    async removeDerivedByUser(userId) {
      completed.forEach((item, id) => { if (item.userId === userId) completed.delete(id); });
      jobs.forEach((item, key) => { if (item.userId === userId) jobs.delete(key); });
    },
    async recordRejected(source, errorCode) {
      const key = `rejected:${source.id}`;
      jobs.set(key, { key, sourceId: source.id, userId: source.userId, sourceHash: '',
        status: 'failed', attempts: 0, nextAttemptAt: null, lockedUntil: null,
        lockToken: null, errorCode });
    },
    async getJob(key) {
      const job = jobs.get(key);
      if (!job) return null;
      if (job.status === 'completed' && completed.get(job.sourceId)?.sourceHash !== job.sourceHash) {
        return { ...job, status: 'retry' };
      }
      return job;
    },
    async reserveBudget(scope, amountUsd, capUsd) {
      const existing = reservations.get(scope) ?? 0;
      if (existing + amountUsd > capUsd + Number.EPSILON) return false;
      reservations.set(scope, existing + amountUsd);
      return true;
    },
    async releaseBudget(scope, amountUsd) {
      reservations.set(scope, Math.max(0, (reservations.get(scope) ?? 0) - amountUsd));
    },
    async claim(key, sourceId, userId, sourceHash, _taxonomyVersion, _classifierVersion, now, lockMs, maxAttempts) {
      const existing = jobs.get(key);
      if (existing?.status === 'completed' && completed.get(sourceId)?.sourceHash === sourceHash) return { state: 'completed' };
      if (existing?.status === 'processing' && existing.lockedUntil && Date.parse(existing.lockedUntil) > now.getTime()) return { state: 'locked' };
      if (existing?.status === 'failed' || (existing && existing.status !== 'completed' && existing.attempts >= maxAttempts)) return { state: 'failed' };
      if (existing?.status === 'retry' && existing.nextAttemptAt && Date.parse(existing.nextAttemptAt) > now.getTime()) return { state: 'waiting' };
      const attempts = (existing?.status === 'completed' ? 0 : existing?.attempts ?? 0) + 1;
      if (attempts > maxAttempts) {
        if (existing) jobs.set(key, { ...existing, status: 'failed', lockToken: null, lockedUntil: null });
        return { state: 'failed' };
      }
      const token = randomUUID();
      jobs.set(key, { key, sourceId, userId, sourceHash, status: 'processing', attempts,
        nextAttemptAt: null, lockedUntil: new Date(now.getTime() + lockMs).toISOString(), lockToken: token, errorCode: null });
      return { state: 'claimed', token };
    },
    async complete(key, token, insight) {
      const current = jobs.get(key);
      if (!current || current.status !== 'processing' || current.lockToken !== token ||
          !current.lockedUntil || Date.parse(current.lockedUntil) < Date.parse(insight.processedAt)) return false;
      jobs.set(key, { ...current, status: 'completed', lockToken: null, lockedUntil: null, nextAttemptAt: null });
      completed.set(insight.sourceId, insight); // Active version only; prior hash/version is not counted twice.
      return true;
    },
    async fail(key, token, now, errorCode, maxAttempts) {
      const current = jobs.get(key);
      if (!current || current.status !== 'processing' || current.lockToken !== token) return false;
      const terminal = current.attempts >= maxAttempts;
      jobs.set(key, { ...current, status: terminal ? 'failed' : 'retry', lockToken: null, lockedUntil: null,
        nextAttemptAt: terminal ? null : new Date(now.getTime() + Math.min(3600_000, 60_000 * 2 ** (current.attempts - 1))).toISOString(),
        errorCode });
      return true;
    },
    async listCompleted() { return Array.from(completed.values()); },
    async listJobs() { return Array.from(jobs.values()); },
    async listRejectedSources() {
      return Array.from(jobs.values()).filter(job => job.status === 'failed' && job.errorCode === 'input_rejected' && job.key === `rejected:${job.sourceId}`)
        .map(job => ({ sourceId: job.sourceId, userId: job.userId }));
    },
  };
}

export interface ProcessInsightOptions {
  repository: InsightRepository; classifier: InsightClassifier;
  maxMessages?: number; maxSpendUsd?: number; reserveUsdPerCall?: number; budgetScope?: string;
  now?: Date; clock?: () => Date; processingStart?: Date; processingEnd?: Date;
  sourceIds?: readonly number[];
  /** Fixed eight-way historical worker subset; context remains unpartitioned. */
  partition?: number;
  deadline?: Date;
}
export interface ProcessInsightResult {
  inspected: number; completed: number; skipped: number; excluded: number;
  pending: number; failed: number; budgetStopped: boolean;
  hasMore: boolean; remainingUninspected: number;
  reservedUsd: number; releasedUsd: number; estimatedCostUsd: number;
  budgetSettlementFailed: number; usage: TokenUsage;
}

/** Luna Standard planning rate; provider billing can differ. Rounded upward to six decimals. */
function conservativeModelCost(usage: TokenUsage, reservation: number, pricing = { input: 0.1, output: 0.5 }): number | null {
  const valid = [usage.inputTokens, usage.outputTokens, usage.totalTokens, usage.reasoningTokens]
    .every(value => Number.isSafeInteger(value) && value >= 0);
  if (!valid || usage.inputTokens === 0 || usage.outputTokens === 0 ||
      usage.totalTokens !== usage.inputTokens + usage.outputTokens ||
      usage.reasoningTokens > usage.outputTokens) return null;
  const cost = Math.ceil((usage.inputTokens * pricing.input + usage.outputTokens * pricing.output)) / 1_000_000;
  return cost <= reservation ? cost : null;
}

export async function processInsightBatch(options: ProcessInsightOptions): Promise<ProcessInsightResult> {
  const { repository, classifier } = options;
  const maxMessages = options.maxMessages ?? 50;
  const maxSpendUsd = options.maxSpendUsd ?? 0;
  const reserveUsdPerCall = options.reserveUsdPerCall ?? 0.005;
  const budgetScope = options.budgetScope ?? 'insights-default';
  if (!Number.isInteger(maxMessages) || maxMessages < 1 || maxMessages > 50) throw new Error('invalid_batch_limit');
  if (!Number.isFinite(maxSpendUsd) || maxSpendUsd < 0 || !Number.isFinite(reserveUsdPerCall) || reserveUsdPerCall < 0.005) throw new Error('invalid_budget');
  if (!/^[a-zA-Z0-9_.:-]{1,80}$/.test(budgetScope)) throw new Error('invalid_budget_scope');
  if (classifier.provider === 'openai' && process.env.INSIGHTS_OPENAI_ENABLED !== 'true') throw new Error('openai_disabled');
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error('invalid_batch_time');
  if (options.processingStart && (!Number.isFinite(options.processingStart.getTime()) || options.processingStart > now)) throw new Error('invalid_processing_start');
  if (options.processingEnd && (!Number.isFinite(options.processingEnd.getTime()) || options.processingEnd > now ||
      (options.processingStart && options.processingEnd <= options.processingStart))) throw new Error('invalid_processing_end');
  if (options.sourceIds && (!options.sourceIds.length || options.sourceIds.length > 200 || options.sourceIds.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(options.sourceIds).size !== options.sourceIds.length)) throw new Error('invalid_pilot_sources');
  if (options.deadline && !Number.isFinite(options.deadline.getTime())) throw new Error('invalid_deadline');
  if (options.partition !== undefined && (!Number.isInteger(options.partition) || options.partition < 0 || options.partition > 7)) throw new Error('invalid_partition');
  const clock = options.clock ?? (options.now ? () => new Date(options.now!.getTime()) : () => new Date());
  const allSources = (await repository.listSources()).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id);
  const contextByChat = groupInsightSourcesByChat(allSources);
  // One current active-result snapshot avoids two RPC/REST round trips for
  // every completed source on every resumed batch. Hash+versions must match;
  // a historical completed job alone is never sufficient for this shortcut.
  const [activeResults, rejectedSources] = await Promise.all([
    repository.listCompleted(), repository.listRejectedSources?.() ?? Promise.resolve([]),
  ]);
  const rejectedPairs = new Set(rejectedSources.map(row => `${row.sourceId}:${row.userId}`));
  const activeKeys = new Set(activeResults.filter(row => row.taxonomyVersion === TAXONOMY_VERSION && row.classifierVersion === classifier.version)
    .map(row => `${row.sourceId}:${row.sourceHash}`));
  const activeSourceIds = new Set(activeResults.filter(row => row.taxonomyVersion === TAXONOMY_VERSION && row.classifierVersion === classifier.version)
    .map(row => row.sourceId));
  const windowSources = allSources.filter(row =>
    (!options.processingStart || Date.parse(row.createdAt) >= options.processingStart.getTime()) &&
    (!options.processingEnd || Date.parse(row.createdAt) < options.processingEnd.getTime()));
  const allowedSources = options.sourceIds ? new Set(options.sourceIds) : null;
  const manifestSources = allowedSources ? windowSources.filter(row => allowedSources.has(row.id)) : windowSources;
  // Partition only work selection. Hashes must retain the complete chat context,
  // including messages whose IDs belong to another worker.
  const sources = options.partition === undefined ? manifestSources : manifestSources.filter(row => row.id % 8 === options.partition);
  const result: ProcessInsightResult = {
    inspected: 0, completed: 0, skipped: 0, excluded: 0, pending: 0, failed: 0,
    budgetStopped: false, hasMore: false, remainingUninspected: 0,
    reservedUsd: 0, releasedUsd: 0, estimatedCostUsd: 0,
    budgetSettlementFailed: 0,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, reasoningTokens: 0 },
  };
  const levelCache = new Map<string, SourceMessage['userLevel']>();
  const excludedUsers = new Set<string>();
  let claimedCount = 0;
  for (const source of sources) {
    // Leave time for the provider's 25s timeout and durable settlement.
    if (claimedCount >= maxMessages || (options.deadline && clock().getTime() + 35_000 >= options.deadline.getTime())) break;
    result.inspected++;
    // An exact active snapshot can be skipped without a role GET: this branch
    // performs no mutation, provider call or returned content. A role change
    // after this snapshot cannot authorize fresh processing or publication;
    // live reports independently recheck current roles before metrics/examples.
    // Known admin/unknown snapshots still take the live role/cleanup path below.
    if (source.userLevel === 'user' && activeSourceIds.has(source.id)) {
      try {
        const snapshot = prepareInsightInput(source, contextByChat.get(source.chatId) ?? [], TAXONOMY_VERSION, classifier.version);
        if (activeKeys.has(`${source.id}:${snapshot.sourceHash}`)) { result.skipped++; continue; }
      } catch { /* Invalid or changed input must take the normal current-role path. */ }
    }
    let level = levelCache.get(source.userId);
    if (level === undefined) {
      level = await repository.currentUserLevel(source.userId);
      levelCache.set(source.userId, level);
    }
    if (level !== 'user') {
      if (!excludedUsers.has(source.userId)) {
        await repository.removeDerivedByUser(source.userId);
        excludedUsers.add(source.userId);
      }
      result.excluded++;
      continue;
    }
    const current = { ...source, userLevel: level };
    const contextCandidates = (contextByChat.get(source.chatId) ?? []).filter(row => row.userId === source.userId).map(row => ({ ...row, userLevel: level }));
    let prepared;
    try {
      prepared = prepareInsightInput(current, contextCandidates, TAXONOMY_VERSION, classifier.version);
    } catch {
      // The current role and input/context were checked again above. Existing
      // rejection metadata never bypasses preparation or hides a corrected input.
      const pair = `${source.id}:${source.userId}`;
      if (!rejectedPairs.has(pair)) {
        await repository.recordRejected(source, 'input_rejected');
        rejectedPairs.add(pair);
      }
      result.failed++; // Oversize/empty input is explicit, never silently truncated.
      continue;
    }
    const key = `${source.id}:${prepared.sourceHash}`;
    if (activeKeys.has(key)) { result.skipped++; continue; }
    if ((await repository.getJob(key))?.status === 'completed') { result.skipped++; continue; }
    let reserved = false;
    if (classifier.provider === 'openai') {
      reserved = await repository.reserveBudget(budgetScope, reserveUsdPerCall, maxSpendUsd);
      if (!reserved) {
        result.budgetStopped = true;
        result.pending++;
        break;
      }
    }
    const claimNow = clock();
    if (!Number.isFinite(claimNow.getTime())) throw new Error('invalid_clock');
    const claim = await repository.claim(key, source.id, source.userId, prepared.sourceHash, TAXONOMY_VERSION, classifier.version, claimNow, 60_000, 3);
    if (claim.state !== 'claimed' || !claim.token) {
      if (reserved) await repository.releaseBudget(budgetScope, reserveUsdPerCall);
      if (claim.state === 'completed') result.skipped++;
      else if (claim.state === 'failed') result.failed++;
      else result.pending++;
      continue;
    }
    claimedCount++;
    if (reserved) result.reservedUsd += reserveUsdPerCall;
    try {
      const classified = await classifier.classify(prepared);
      const validClassification = validateClassification(classified.classification);
      const insight: StoredInsight = {
        sourceId: source.id, userId: source.userId, chatId: source.chatId, agentType: source.agentType,
        createdAt: source.createdAt, sourceHash: prepared.sourceHash, taxonomyVersion: TAXONOMY_VERSION,
        classifierVersion: classifier.version, classification: validClassification,
        processedAt: clock().toISOString(), usage: classified.usage,
      };
      // Recheck after an external call to catch role changes during processing.
      if (await repository.currentUserLevel(source.userId) !== 'user') {
        await repository.removeDerivedByUser(source.userId);
        result.excluded++;
        continue;
      }
      if (!await repository.complete(key, claim.token, insight)) { result.pending++; continue; }
      result.completed++;
      if (classified.usage) {
        result.usage.inputTokens += classified.usage.inputTokens;
        result.usage.outputTokens += classified.usage.outputTokens; // Includes reasoning in provider usage.
        result.usage.totalTokens += classified.usage.totalTokens;
        result.usage.reasoningTokens += classified.usage.reasoningTokens; // Subset of output, not additive.
        if (reserved) {
          const estimated = conservativeModelCost(classified.usage, reserveUsdPerCall, classifier.pricing);
          if (estimated !== null) {
            result.estimatedCostUsd += estimated;
            const release = Math.round((reserveUsdPerCall - estimated) * 1_000_000) / 1_000_000;
            if (release > 0) {
              try {
                await repository.releaseBudget(budgetScope, release);
                result.releasedUsd += release;
              } catch {
                // Persisted result stays valid; retained reservation is conservative.
                result.budgetSettlementFailed++;
              }
            }
          }
        }
      }
    } catch (error) {
      const safeCodes = /^(openai_(http_\d{3}|incomplete|refusal)|invalid_(classification_shape|message_kind|topic_ids|normalized_demand|confidence|review_flag|openai_response|openai_output|openai_json)|unclassifiable_with_topic|missing_topic|uncertain_without_review)$/;
      const code = error instanceof Error && error.name === 'AbortError' ? 'openai_timeout' : error instanceof Error && safeCodes.test(error.message) ? error.message : 'classification_failed';
      await repository.fail(key, claim.token, clock(), code, 3);
      result.failed++;
    }
  }
  result.remainingUninspected = Math.max(0, sources.length - result.inspected);
  result.hasMore = result.remainingUninspected > 0 || result.pending > 0;
  return result;
}
