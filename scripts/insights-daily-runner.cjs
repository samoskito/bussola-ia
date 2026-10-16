'use strict';

// Dependency-free machine runner. No dotenv, database access, conversation
// content, arbitrary endpoint, command input or direct provider credentials.
const ENDPOINT = 'https://ia.bussolaexecutiva.com.br/api/insights/process/daily';
const MAX_ROUNDS = 20;
const CALLS_PER_ROUND = 2;
const REQUEST_TIMEOUT_MS = 270_000;
const RUN_TIMEOUT_MS = 185 * 60_000;
const MAX_RESPONSE_BYTES = 16_384;

class RunnerError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = code => { throw new RunnerError(code); };

function parseValidationMode(value) {
  if (value === undefined || value === 'false') return false;
  if (value === 'true') return true;
  fail('invalid_validation_mode');
}

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
    if (!Number.isFinite(value[key]) || value[key] < 0 || value[key] > 5) fail('invalid_worker_response');
    result[key] = value[key];
  }
  return result;
}

async function readResult(response) {
  if (!response.ok) fail(response.status === 401 || response.status === 403 ? 'worker_auth_denied' :
    response.status === 429 ? 'worker_rate_limited' : response.status === 503 ? 'worker_disabled_or_unavailable' : 'worker_http_error');
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) fail('worker_response_too_large');
  if (!response.body) fail('invalid_worker_response');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        fail('worker_response_too_large');
      }
      chunks.push(Buffer.from(part.value));
    }
  } finally { reader.releaseLock(); }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { fail('invalid_worker_response'); }
  return projectResult(value);
}

/** Injectable transport/clock/log are for synthetic tests; the CLI exposes none of them. */
async function runDailyInsightWorkflow({ token, validateOnly = false, fetchImpl = globalThis.fetch, clock = Date.now, log = line => console.log(line) } = {}) {
  if (typeof validateOnly !== 'boolean') fail('invalid_validation_mode');
  if (typeof token !== 'string' || !/^[\x21-\x7e]{32,512}$/.test(token)) fail('worker_token_missing_or_invalid');
  if (typeof fetchImpl !== 'function') fail('node_fetch_unavailable');
  const deadline = clock() + RUN_TIMEOUT_MS;
  const totals = { calls: 0, completed: 0, failed: 0, estimatedCostUsd: 0 };
  const finish = (reason, exitCode) => {
    const outcome = { event: 'insights_daily_finished', executionMode: validateOnly ? 'validate' : 'update', reason, ...totals, estimatedCostUsd: Math.round(totals.estimatedCostUsd * 1e6) / 1e6 };
    log(JSON.stringify(outcome));
    return { ...outcome, exitCode };
  };
  const rounds = validateOnly ? 1 : MAX_ROUNDS;
  for (let round = 1; round <= rounds; round++) {
    for (let call = 1; call <= CALLS_PER_ROUND; call++) {
      if (clock() + REQUEST_TIMEOUT_MS >= deadline) return finish('run_time_limit', 2);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let result;
      try {
        const response = await fetchImpl(ENDPOINT, { method: 'POST', redirect: 'error', cache: 'no-store',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: controller.signal });
        result = await readResult(response);
      } catch (error) {
        if (error instanceof RunnerError) throw error;
        // Do not repeat an ambiguous paid request; backend leases/reservations
        // remain authoritative and a later scheduled run may resume safely.
        fail(controller.signal.aborted ? 'worker_request_timeout' : 'worker_network_error');
      } finally { clearTimeout(timeout); }
      totals.calls++;
      totals.completed += result.completed;
      totals.failed = result.failed; // Snapshot count, not newly failed sources; do not sum across resumed batches.
      totals.estimatedCostUsd += result.estimatedCostUsd;
      log(JSON.stringify({ event: 'insights_daily_batch', round, call, ...result }));
      if (result.budgetSettlementFailed > 0) return finish('budget_settlement_failed', 2);
      if (result.budgetStopped) return finish('budget_limit', 2);
      if (!result.hasMore) return finish(result.failed ? 'completed_with_failures' : 'completed', 0);
      if (result.completed === 0) return finish(result.pending ? 'deferred_pending_retry' : 'deferred_no_progress', 0);
    }
  }
  return finish(validateOnly ? 'validation_limit_backlog_remaining' : 'round_limit_backlog_remaining', validateOnly ? 0 : 2);
}

function safeError(error) {
  return { event: 'insights_daily_failed', code: error instanceof RunnerError ? error.code : 'runner_failed' };
}

if (require.main === module) {
  if (process.argv.length !== 2) {
    console.error(JSON.stringify(safeError(new RunnerError('unexpected_arguments'))));
    process.exitCode = 1;
  } else {
    Promise.resolve().then(() => runDailyInsightWorkflow({ token: process.env.INSIGHTS_WORKER_TOKEN,
      validateOnly: parseValidationMode(process.env.INSIGHTS_DAILY_VALIDATE_ONLY) })).then(result => { process.exitCode = result.exitCode; })
      .catch(error => { console.error(JSON.stringify(safeError(error))); process.exitCode = 1; });
  }
}

module.exports = { runDailyInsightWorkflow, safeError, projectResult, parseValidationMode, ENDPOINT, MAX_ROUNDS, CALLS_PER_ROUND, REQUEST_TIMEOUT_MS };
