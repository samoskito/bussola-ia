'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runDailyInsightWorkflow, safeError, parseValidationMode, ENDPOINT, MAX_ROUNDS, CALLS_PER_ROUND, REQUEST_TIMEOUT_MS } = require('../../scripts/insights-daily-runner.cjs');
const token = 'synthetic-machine-token-over-32-characters';
const batch = (changes = {}) => ({ mode: 'live', inspected: 10, completed: 10, skipped: 0, excluded: 0, pending: 0, failed: 0,
  hasMore: true, remainingUninspected: 1, budgetStopped: false, reservedUsd: .1, releasedUsd: .09, estimatedCostUsd: .01,
  budgetSettlementFailed: 0, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, reasoningTokens: 0 }, ...changes });
const response = value => Response.json(value);
function setup(results, changes = {}) {
  const logs = [], requests = [];
  let inFlight = 0, maximumInFlight = 0;
  const options = { token, clock: () => 1_000_000, log: line => logs.push(line), fetchImpl: async (url, init) => {
    requests.push({ url, init });
    inFlight++; maximumInFlight = Math.max(inFlight, maximumInFlight);
    try {
      await Promise.resolve();
      const item = results[requests.length - 1];
      if (item instanceof Error) throw item;
      if (item === undefined) throw new Error('Unexpected extra HTTP request');
      return item instanceof Response ? item : response(item);
    } finally { inFlight--; }
  }, ...changes };
  return { logs, requests, options, maximumInFlight: () => maximumInFlight };
}

test('daily runner performs sequential fixed-origin POSTs and projects only safe result fields', async () => {
  const run = setup([batch({ examples: [{ demand: 'PRIVATE-CONVERSATION' }], userId: 'PRIVATE-USER' }), batch({ hasMore: false, remainingUninspected: 0 })]);
  const outcome = await runDailyInsightWorkflow(run.options);
  assert.equal(outcome.reason, 'completed');
  assert.equal(outcome.calls, 2);
  assert.equal(outcome.completed, 20);
  assert.equal(outcome.exitCode, 0);
  assert.equal(run.maximumInFlight(), 1);
  for (const request of run.requests) {
    assert.equal(request.url, 'https://ia.bussolaexecutiva.com.br/api/insights/process/daily');
    assert.equal(request.url, ENDPOINT);
    assert.equal(request.init.method, 'POST');
    assert.equal(request.init.redirect, 'error');
    assert.equal(request.init.headers.Authorization, `Bearer ${token}`);
    assert.equal(request.init.body, undefined, 'request parameters cannot widen server processing scope');
    assert.ok(request.init.signal instanceof AbortSignal);
  }
  for (const forbidden of [token, 'PRIVATE-CONVERSATION', 'PRIVATE-USER', 'examples', 'userId', 'usage']) assert.ok(!run.logs.join('').includes(forbidden));
});

test('daily runner stops at twenty rounds without issuing a forty-first paid request', async () => {
  const run = setup(Array.from({ length: 40 }, () => batch()));
  const outcome = await runDailyInsightWorkflow(run.options);
  assert.equal(MAX_ROUNDS, 20);
  assert.equal(CALLS_PER_ROUND, 2);
  assert.equal(outcome.calls, 40);
  assert.equal(run.requests.length, 40);
  assert.equal(outcome.reason, 'round_limit_backlog_remaining');
  assert.equal(outcome.exitCode, 2);
});

test('manual validation mode limits work to two calls and reports remaining backlog without claiming completion', async () => {
  const run = setup([batch(), batch(), batch()], { validateOnly: parseValidationMode('true') });
  const outcome = await runDailyInsightWorkflow(run.options);
  assert.equal(outcome.calls, 2);
  assert.equal(run.requests.length, 2);
  assert.equal(outcome.executionMode, 'validate');
  assert.equal(outcome.reason, 'validation_limit_backlog_remaining');
  assert.equal(outcome.exitCode, 0);
  assert.equal(parseValidationMode(undefined), false);
  assert.equal(parseValidationMode('false'), false);
  for (const invalid of ['', 'TRUE', 'validate', '1', true]) assert.throws(() => parseValidationMode(invalid), /invalid_validation_mode/);
  await assert.rejects(runDailyInsightWorkflow({ ...run.options, validateOnly: 'true' }), /invalid_validation_mode/);
});

test('budget stop and settlement failures stop immediately, preserving durable backend accounting', async () => {
  for (const [fields, expected] of [
    [{ completed: 0, pending: 1, budgetStopped: true }, 'budget_limit'],
    [{ budgetSettlementFailed: 1 }, 'budget_settlement_failed'],
  ]) {
    const run = setup([batch(fields), batch()]);
    const outcome = await runDailyInsightWorkflow(run.options);
    assert.equal(outcome.reason, expected);
    assert.equal(outcome.exitCode, 2);
    assert.equal(run.requests.length, 1);
  }
});

test('waiting leases/retries defer instead of looping or declaring pending messages permanently failed', async () => {
  for (const [fields, expected] of [
    [{ pending: 2 }, 'deferred_pending_retry'], [{ pending: 0 }, 'deferred_no_progress'],
  ]) {
    const run = setup([batch({ ...fields, completed: 0 }), batch()]);
    const outcome = await runDailyInsightWorkflow(run.options);
    assert.equal(outcome.reason, expected);
    assert.equal(outcome.exitCode, 0);
    assert.equal(run.requests.length, 1);
  }
  const doneWithRejections = setup([batch({ completed: 0, failed: 264, hasMore: false, remainingUninspected: 0 })]);
  assert.equal((await runDailyInsightWorkflow(doneWithRejections.options)).reason, 'completed_with_failures');
});

test('authentication, HTTP, malformed data and network failures never retry an ambiguous worker request', async () => {
  for (const [item, expected] of [
    [new Response('SECRET-PRIVATE', { status: 401 }), 'worker_auth_denied'],
    [new Response('SECRET-PRIVATE', { status: 403 }), 'worker_auth_denied'],
    [new Response('SECRET-PRIVATE', { status: 429 }), 'worker_rate_limited'],
    [new Response('SECRET-PRIVATE', { status: 503 }), 'worker_disabled_or_unavailable'],
    [new Response('SECRET-PRIVATE', { status: 500 }), 'worker_http_error'],
    [new Response('SECRET-PRIVATE'), 'invalid_worker_response'],
    [batch({ completed: 11 }), 'invalid_worker_response'],
    [batch({ completed: 'SECRET-PRIVATE' }), 'invalid_worker_response'],
    [batch({ mode: 'demo' }), 'invalid_worker_response'],
    [new Error('SECRET-PRIVATE authorization=' + token), 'worker_network_error'],
  ]) {
    const run = setup([item, batch()]);
    await assert.rejects(runDailyInsightWorkflow(run.options), error => {
      assert.equal(safeError(error).code, expected);
      assert.ok(!JSON.stringify(safeError(error)).includes('SECRET-PRIVATE'));
      assert.ok(!JSON.stringify(safeError(error)).includes(token));
      return true;
    });
    assert.equal(run.requests.length, 1);
    assert.ok(!run.logs.join('').includes('SECRET-PRIVATE'));
  }
  assert.deepEqual(safeError(new Error(token)), { event: 'insights_daily_failed', code: 'runner_failed' });
});

test('response bodies are bounded whether or not Content-Length is supplied', async () => {
  for (const item of [new Response('x'.repeat(16_385)), new Response('x', { headers: { 'Content-Length': '9999999' } })]) {
    const run = setup([item]);
    await assert.rejects(runDailyInsightWorkflow(run.options), /worker_response_too_large/);
    assert.equal(run.requests.length, 1);
  }
});

test('request timeout aborts without a second request or raw diagnostic output', async () => {
  const originalTimeout = global.setTimeout;
  const originalClear = global.clearTimeout;
  let abort;
  global.setTimeout = (callback, ms) => { assert.equal(ms, REQUEST_TIMEOUT_MS); abort = callback; return 'synthetic-timer'; };
  global.clearTimeout = () => {};
  try {
    const run = setup([], { fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('SECRET-PRIVATE')), { once: true });
    }) });
    const pending = runDailyInsightWorkflow(run.options);
    abort();
    await assert.rejects(pending, /worker_request_timeout/);
    assert.deepEqual(run.logs, []);
  } finally { global.setTimeout = originalTimeout; global.clearTimeout = originalClear; }
});

test('total run deadline and invalid credentials stop before any network operation', async () => {
  let ticks = 0;
  const run = setup([], { clock: () => ticks++ === 0 ? 0 : 186 * 60_000 });
  assert.equal((await runDailyInsightWorkflow(run.options)).reason, 'run_time_limit');
  assert.equal(run.requests.length, 0);
  for (const invalid of [undefined, '', 'short', token + '\n', token + ' ']) {
    await assert.rejects(runDailyInsightWorkflow({ ...run.options, token: invalid }), /worker_token_missing_or_invalid/);
    assert.equal(run.requests.length, 0);
  }
});

test('CLI rejects arguments and missing secrets without loading credentials or making a request', () => {
  const script = path.resolve(__dirname, '../../scripts/insights-daily-runner.cjs');
  for (const [args, expected] of [[[], 'worker_token_missing_or_invalid'], [['https://outside.invalid'], 'unexpected_arguments']]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { PATH: process.env.PATH } });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(JSON.parse(result.stderr).code, expected);
    assert.ok(!result.stderr.includes('outside.invalid'));
  }
  const invalidMode = spawnSync(process.execPath, [script], { encoding: 'utf8', env: { PATH: process.env.PATH,
    INSIGHTS_WORKER_TOKEN: token, INSIGHTS_DAILY_VALIDATE_ONLY: 'unexpected-mode' } });
  assert.equal(invalidMode.status, 1);
  assert.equal(invalidMode.stdout, '');
  assert.equal(JSON.parse(invalidMode.stderr).code, 'invalid_validation_mode');
  assert.ok(!invalidMode.stderr.includes(token));
});

test('CLI validation environment produces only two synthetic calls with explicit incomplete-backlog outcome', () => {
  const script = path.resolve(__dirname, '../../scripts/insights-daily-runner.cjs');
  const preload = `let calls = 0; globalThis.fetch = async (url, init) => {
    if (url !== ${JSON.stringify(ENDPOINT)} || init.redirect !== 'error' || ++calls > 2) throw new Error('Unexpected synthetic request');
    return Response.json(${JSON.stringify(batch())});
  };`;
  const result = spawnSync(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(preload)}`, script], {
    encoding: 'utf8', env: { PATH: process.env.PATH, INSIGHTS_WORKER_TOKEN: token, INSIGHTS_DAILY_VALIDATE_ONLY: 'true' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  const logs = result.stdout.trim().split(/\r?\n/).map(line => JSON.parse(line));
  assert.equal(logs.filter(row => row.event === 'insights_daily_batch').length, 2);
  const finished = logs.at(-1);
  assert.equal(finished.calls, 2);
  assert.equal(finished.executionMode, 'validate');
  assert.equal(finished.reason, 'validation_limit_backlog_remaining');
  assert.ok(!result.stdout.includes(token));
});

test('workflow is gated to trusted main, one secret, bounded mode choice and no install step', () => {
  const workflow = fs.readFileSync(path.resolve(__dirname, '../../.github/workflows/insights-daily.yml'), 'utf8');
  assert.match(workflow, /cron: '17 6 \* \* \*'/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /mode:\s+description:[^\n]+\s+type: choice\s+required: true\s+default: update\s+options:\s+- update\s+- validate/);
  assert.match(workflow, /INSIGHTS_DAILY_VALIDATE_ONLY: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.mode == 'validate' && 'true' \|\| 'false' \}\}/);
  assert.match(workflow, /github\.repository == 'samoskito\/bussola-ia'/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /vars\.INSIGHTS_DAILY_ENABLED == 'true'/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /actions\/checkout@[a-f0-9]{40}/);
  assert.deepEqual([...workflow.matchAll(/secrets\.([A-Z_]+)/g)].map(match => match[1]), ['INSIGHTS_WORKER_TOKEN']);
  assert.equal((workflow.match(/\binputs:/g) || []).length, 1);
  assert.equal((workflow.match(/\binputs\./g) || []).length, 1);
  for (const unsafe of ['pull_request', 'workflow_run', 'npm install', 'npm ci', 'github.event.', 'curl ', 'set -x']) assert.ok(!workflow.includes(unsafe));
});
