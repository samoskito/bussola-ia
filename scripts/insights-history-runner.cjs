'use strict';

// Machine orchestration only. The server selects the historical window, model,
// admin exclusion and shared durable budget; this runner cannot override them.
const ENDPOINT = 'https://ia.bussolaexecutiva.com.br/api/insights/process/backfill/';
const WORKERS = 8;
const MAX_ROUNDS = 200;
const REQUEST_TIMEOUT_MS = 280_000;
const RUN_TIMEOUT_MS = 345 * 60_000;
const RETRY_WAIT_MS = 60_000;
const MAX_RESPONSE_BYTES = 16_384;
const ALLOWED_CODES = new Set(['worker_unavailable', 'processing_disabled', 'worker_configuration', 'unauthenticated', 'invalid_configuration']);

class RunnerError extends Error {
  constructor(code, status = null, workerCode = null) {
    super(code);
    this.safe = { code, httpStatus: Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
      workerCode: ALLOWED_CODES.has(workerCode) ? workerCode : null };
  }
}
const fail = code => { throw new RunnerError(code); };
const rounded = value => Math.round(value * 1e6) / 1e6;
const safeError = error => error instanceof RunnerError ? { ...error.safe } :
  { code: 'runner_failed', httpStatus: null, workerCode: null };

function projectResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.mode !== 'live') fail('invalid_worker_response');
  const result = {};
  for (const key of ['inspected', 'completed', 'skipped', 'excluded', 'pending', 'failed', 'remainingUninspected', 'budgetSettlementFailed']) {
    if (!Number.isSafeInteger(value[key]) || value[key] < 0 || value[key] > 1_000_000_000) fail('invalid_worker_response');
    result[key] = value[key];
  }
  if (result.completed > 10 || result.completed > result.inspected) fail('invalid_worker_response');
  for (const key of ['hasMore', 'budgetStopped']) {
    if (typeof value[key] !== 'boolean') fail('invalid_worker_response');
    result[key] = value[key];
  }
  for (const key of ['reservedUsd', 'releasedUsd', 'estimatedCostUsd']) {
    if (!Number.isFinite(value[key]) || value[key] < 0 || value[key] > 5) fail('invalid_worker_cost');
    result[key] = value[key];
  }
  return result;
}

async function readResult(response) {
  if (!response.body) throw new RunnerError('response_empty', response.status);
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) throw new RunnerError('response_too_large', response.status);
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new RunnerError('response_too_large', response.status);
      }
      chunks.push(Buffer.from(part.value));
    }
  } finally { reader.releaseLock(); }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new RunnerError('response_invalid_json', response.status); }
  if (!response.ok) throw new RunnerError('worker_http_error', response.status, value && value.code);
  return projectResult(value);
}

// Transport/timer injection is only available through this module for tests.
async function requestPartition({ partition, token, fetchImpl = globalThis.fetch, setTimer = setTimeout, clearTimer = clearTimeout }) {
  if (!Number.isInteger(partition) || partition < 0 || partition >= WORKERS) fail('invalid_partition');
  const controller = new AbortController();
  const timer = setTimer(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let status = null;
  try {
    const response = await fetchImpl(ENDPOINT + partition, { method: 'POST', redirect: 'error', cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: controller.signal });
    status = response.status;
    return await readResult(response);
  } catch (error) {
    if (error instanceof RunnerError) throw error;
    throw new RunnerError(controller.signal.aborted ? 'worker_timeout_ambiguous' : 'worker_network_error_ambiguous', status);
  } finally { clearTimer(timer); }
}

async function runHistoryWorkflow({ token, fetchImpl = globalThis.fetch, clock = Date.now,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), log = line => console.log(line) } = {}) {
  if (typeof token !== 'string' || !/^[\x21-\x7e]{32,512}$/.test(token)) fail('worker_token_missing_or_invalid');
  if (typeof fetchImpl !== 'function') fail('node_fetch_unavailable');
  const deadline = clock() + RUN_TIMEOUT_MS;
  const totals = { calls: 0, completed: 0, failedRequests: 0, estimatedCostUsd: 0, reservedUsd: 0, releasedUsd: 0 };
  let zeroRounds = 0;
  const finish = (reason, exitCode, extra = {}) => {
    const outcome = { event: 'insights_history_finished', reason, ...totals,
      // Known returned reservations only. Ambiguous requests may retain more;
      // only a subsequent database audit can establish actual coverage/spend.
      knownRetainedReserveUsd: rounded(Math.max(0, totals.reservedUsd - totals.releasedUsd - totals.estimatedCostUsd)), ...extra };
    log(JSON.stringify(outcome));
    return { ...outcome, exitCode };
  };
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    if (clock() + REQUEST_TIMEOUT_MS >= deadline) return finish('run_time_limit_requires_audit', 2);
    const settled = await Promise.allSettled(Array.from({ length: WORKERS }, (_, partition) => requestPartition({ partition, token, fetchImpl })));
    const results = settled.filter(item => item.status === 'fulfilled').map(item => item.value);
    const requestErrors = settled.filter(item => item.status === 'rejected').map(item => safeError(item.reason));
    const batch = { round, calls: WORKERS, completed: 0, failedSnapshot: 0, pending: 0, budgetStopped: false,
      budgetSettlementFailed: 0, estimatedCostUsd: 0, reservedUsd: 0, releasedUsd: 0, requestErrors };
    for (const result of results) {
      for (const key of ['completed', 'pending', 'budgetSettlementFailed', 'estimatedCostUsd', 'reservedUsd', 'releasedUsd']) batch[key] += result[key];
      batch.failedSnapshot += result.failed;
      batch.budgetStopped ||= result.budgetStopped;
    }
    totals.calls += WORKERS;
    totals.failedRequests += requestErrors.length;
    totals.completed += batch.completed;
    for (const key of ['estimatedCostUsd', 'reservedUsd', 'releasedUsd']) {
      batch[key] = rounded(batch[key]);
      totals[key] = rounded(totals[key] + batch[key]);
    }
    log(JSON.stringify({ event: 'insights_history_round', ...batch }));
    // All eight requests have settled before any operational stop. Never retry
    // an ambiguous paid request automatically or release its reservation.
    if (requestErrors.length) return finish('request_failed_drained_requires_audit', 2);
    if (batch.budgetSettlementFailed) return finish('budget_settlement_failed_requires_audit', 2);
    if (batch.budgetStopped) return finish('budget_limit_requires_audit', 2);
    if (results.length === WORKERS && results.every(result => result.hasMore === false)) {
      return finish('source_scan_finished_requires_audit', 0, { hasFailedSources: batch.failedSnapshot > 0 });
    }
    zeroRounds = batch.completed === 0 ? zeroRounds + 1 : 0;
    if (zeroRounds >= 3) return finish('deferred_no_progress_requires_audit', 2);
    if (zeroRounds > 0) {
      if (clock() + RETRY_WAIT_MS + REQUEST_TIMEOUT_MS >= deadline) return finish('run_time_limit_requires_audit', 2);
      log(JSON.stringify({ event: 'insights_history_retry_wait', milliseconds: RETRY_WAIT_MS, consecutiveZeroRounds: zeroRounds }));
      await sleep(RETRY_WAIT_MS);
    }
  }
  return finish('round_limit_requires_audit', 2);
}

if (require.main === module) {
  if (process.argv.length !== 2) {
    console.error(JSON.stringify({ event: 'insights_history_failed', ...safeError(new RunnerError('unexpected_arguments')) }));
    process.exitCode = 1;
  } else {
    runHistoryWorkflow({ token: process.env.INSIGHTS_WORKER_TOKEN }).then(result => { process.exitCode = result.exitCode; })
      .catch(error => { console.error(JSON.stringify({ event: 'insights_history_failed', ...safeError(error) })); process.exitCode = 1; });
  }
}

module.exports = { runHistoryWorkflow, requestPartition, projectResult, safeError,
  ENDPOINT, WORKERS, MAX_ROUNDS, REQUEST_TIMEOUT_MS, RUN_TIMEOUT_MS, RETRY_WAIT_MS, MAX_RESPONSE_BYTES };
