'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { runHistoryWorkflow, requestPartition, projectResult, safeError, ENDPOINT, WORKERS,
  MAX_ROUNDS, REQUEST_TIMEOUT_MS, RUN_TIMEOUT_MS, RETRY_WAIT_MS, MAX_RESPONSE_BYTES } = require('../../scripts/insights-history-runner.cjs');

const TOKEN = 'synthetic-worker-token-never-print-0123456789';
const result = extra => ({ mode: 'live', inspected: 100, completed: 10, skipped: 80, excluded: 0, pending: 0,
  failed: 3, remainingUninspected: 10, budgetSettlementFailed: 0, hasMore: true, budgetStopped: false,
  estimatedCostUsd: .001, reservedUsd: .01, releasedUsd: .009, ...extra });
const response = extra => new Response(JSON.stringify(result(extra)));
const options = extra => ({ token: TOKEN, log: () => {}, ...extra });

test('exactly eight fixed read-protected worker POSTs, without configuration payload', async () => {
  const paths = [];
  const outcome = await runHistoryWorkflow(options({ fetchImpl: async (url, request) => {
    paths.push(url);
    assert.equal(request.method, 'POST');
    assert.equal(request.redirect, 'error');
    assert.equal(request.cache, 'no-store');
    assert.equal(request.body, undefined);
    assert.equal(request.headers.Authorization, `Bearer ${TOKEN}`);
    return response({ hasMore: false });
  } }));
  assert.deepEqual(paths.sort(), Array.from({ length: 8 }, (_, n) => ENDPOINT + n));
  assert.equal(outcome.reason, 'source_scan_finished_requires_audit');
  assert.equal(outcome.hasFailedSources, true);
  assert.equal(outcome.completed, 80);
  assert.equal(outcome.estimatedCostUsd, .008);
  assert.equal(outcome.knownRetainedReserveUsd, 0);
});

test('invalid partition is rejected before any network use', async () => {
  let calls = 0;
  for (const partition of [-1, 8, 1.5, '0', null, undefined, NaN, Infinity]) {
    await assert.rejects(requestPartition({ token: TOKEN, partition, fetchImpl: async () => { calls++; } }));
  }
  assert.equal(calls, 0);
});

test('all eight must finish scanning before source-scan outcome', async () => {
  let calls = 0;
  const outcome = await runHistoryWorkflow(options({ fetchImpl: async url => {
    calls++;
    return response({ hasMore: calls <= 8 && url.endsWith('/7') });
  } }));
  assert.equal(calls, 16);
  assert.equal(outcome.reason, 'source_scan_finished_requires_audit');
});

test('one HTTP error drains seven other requests and never automatically retries', async () => {
  let calls = 0, drained = 0;
  const logs = [];
  const outcome = await runHistoryWorkflow(options({ log: line => logs.push(line), fetchImpl: async url => {
    calls++;
    if (url.endsWith('/0')) return new Response('{"code":"worker_unavailable","error":"PRIVATE BODY"}', { status: 503 });
    await new Promise(resolve => setTimeout(resolve, 5));
    drained++;
    return response();
  } }));
  assert.equal(calls, 8);
  assert.equal(drained, 7);
  assert.equal(outcome.reason, 'request_failed_drained_requires_audit');
  const round = JSON.parse(logs.find(line => JSON.parse(line).event === 'insights_history_round'));
  assert.deepEqual(round.requestErrors, [{ code: 'worker_http_error', httpStatus: 503, workerCode: 'worker_unavailable' }]);
  assert.equal(logs.join('').includes('PRIVATE BODY'), false);
  assert.equal(logs.join('').includes(TOKEN), false);
});

test('unknown error and response fields cannot leak into logs', async () => {
  const logs = [];
  const outcome = await runHistoryWorkflow(options({ log: line => logs.push(line), fetchImpl: async url => {
    if (url.endsWith('/0')) throw new Error('PRIVATE NETWORK ' + TOKEN);
    return new Response(JSON.stringify({ ...result({ hasMore: false }), rawText: 'PRIVATE CONTENT', sourceIds: ['PRIVATE ID'] }));
  } }));
  assert.equal(outcome.failedRequests, 1);
  assert.equal(logs.join('').includes('PRIVATE'), false);
  assert.equal(logs.join('').includes(TOKEN), false);
  assert.deepEqual(safeError(new Error('PRIVATE')), { code: 'runner_failed', httpStatus: null, workerCode: null });
});

test('request timeout is fixed and marked ambiguous, without retry', async () => {
  let calls = 0, timeout;
  await assert.rejects(requestPartition({ partition: 0, token: TOKEN,
    setTimer: (callback, milliseconds) => { timeout = milliseconds; return setImmediate(callback); },
    clearTimer: clearImmediate,
    fetchImpl: async (url, request) => {
      calls++;
      return new Promise((resolve, reject) => request.signal.addEventListener('abort', () => reject(new Error('PRIVATE'))));
    } }), error => safeError(error).code === 'worker_timeout_ambiguous');
  assert.equal(timeout, 280000);
  assert.equal(calls, 1);
});

test('oversized and invalid JSON responses preserve status without body', async () => {
  for (const [body, expected] of [['x'.repeat(MAX_RESPONSE_BYTES + 1), 'response_too_large'], ['PRIVATE HTML', 'response_invalid_json']]) {
    await assert.rejects(requestPartition({ partition: 0, token: TOKEN, fetchImpl: async () => new Response(body, { status: 504 }) }),
      error => safeError(error).httpStatus === 504 && safeError(error).code === expected);
  }
});

test('zero progress with pending work waits for recorded job retries and then defers', async () => {
  let calls = 0, waits = 0;
  const outcome = await runHistoryWorkflow(options({
    fetchImpl: async () => { calls++; return response({ completed: 0, pending: 1, estimatedCostUsd: 0, reservedUsd: 0, releasedUsd: 0 }); },
    sleep: async ms => { assert.equal(ms, 60000); waits++; }
  }));
  assert.equal(outcome.reason, 'deferred_no_progress_requires_audit');
  assert.equal(outcome.exitCode, 2);
  assert.equal(calls, 24);
  assert.equal(waits, 2);
});

test('retry wait is included in runtime deadline', async () => {
  let time = 0, calls = 0, waits = 0;
  const outcome = await runHistoryWorkflow(options({ clock: () => time,
    fetchImpl: async () => { calls++; time = RUN_TIMEOUT_MS - REQUEST_TIMEOUT_MS - RETRY_WAIT_MS + 1; return response({ completed: 0 }); },
    sleep: async () => { waits++; }
  }));
  assert.equal(outcome.reason, 'run_time_limit_requires_audit');
  assert.equal(calls, 8);
  assert.equal(waits, 0);
});

test('known input rejections with forward progress do not stop remaining scans', async () => {
  let calls = 0;
  const outcome = await runHistoryWorkflow(options({ fetchImpl: async () => {
    calls++;
    return response({ failed: 264, hasMore: calls <= 8 });
  } }));
  assert.equal(outcome.reason, 'source_scan_finished_requires_audit');
  assert.equal(calls, 16);
  assert.equal(outcome.hasFailedSources, true);
});

test('budget stop and failed settlement stop after draining, even when scan flags are finished', async () => {
  for (const [field, value, reason] of [['budgetStopped', true, 'budget_limit_requires_audit'],
    ['budgetSettlementFailed', 1, 'budget_settlement_failed_requires_audit']]) {
    let calls = 0;
    const outcome = await runHistoryWorkflow(options({ fetchImpl: async () => {
      calls++;
      return response({ hasMore: false, [field]: value });
    } }));
    assert.equal(calls, 8);
    assert.equal(outcome.reason, reason);
    assert.equal(outcome.exitCode, 2);
  }
});

test('fixed 200-round bound does not claim coverage completion', async () => {
  let calls = 0;
  const outcome = await runHistoryWorkflow(options({ fetchImpl: async () => { calls++; return response(); } }));
  assert.equal(calls, 1600);
  assert.equal(outcome.reason, 'round_limit_requires_audit');
  assert.equal(outcome.exitCode, 2);
  assert.equal(MAX_ROUNDS, 200);
  assert.equal(WORKERS, 8);
  assert.equal(RUN_TIMEOUT_MS, 345 * 60000);
});

test('projection validates cost bounds and counts and never exposes arbitrary fields', () => {
  for (const key of ['estimatedCostUsd', 'reservedUsd', 'releasedUsd']) {
    for (const value of [-1, 6, NaN, Infinity, undefined]) assert.throws(() => projectResult(result({ [key]: value })));
  }
  assert.throws(() => projectResult(result({ completed: 11 })));
  assert.throws(() => projectResult(result({ hasMore: 'false' })));
  assert.equal(projectResult({ ...result(), token: 'PRIVATE' }).token, undefined);
});

test('known conservative reservation is reported, never refunded by runner', async () => {
  const outcome = await runHistoryWorkflow(options({ fetchImpl: async () => response({ hasMore: false, releasedUsd: 0 }) }));
  assert.equal(outcome.knownRetainedReserveUsd, .072);
  assert.equal(outcome.reservedUsd, .08);
});

test('missing token fails before network, CLI rejects arbitrary options', async () => {
  let calls = 0;
  await assert.rejects(runHistoryWorkflow(options({ token: '', fetchImpl: async () => { calls++; } })));
  assert.equal(calls, 0);
  const cli = spawnSync(process.execPath, [path.join(__dirname, '../../scripts/insights-history-runner.cjs'), '--rounds', '1'], { encoding: 'utf8' });
  assert.equal(cli.status, 1);
  assert.equal(JSON.parse(cli.stderr).code, 'unexpected_arguments');
});

test('workflow checks out the dispatched commit under trusted-main guard', () => {
  const workflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/insights-history.yml'), 'utf8');
  assert.match(workflow, /github\.repository == 'samoskito\/bussola-ia'/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /vars\.INSIGHTS_DAILY_ENABLED == 'true'/);
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(workflow, /ref: main/);
  assert.match(workflow, /group: insights-daily-production/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /permissions:\s+contents: read/);
  assert.match(workflow, /INSIGHTS_WORKER_TOKEN: \$\{\{ secrets\.INSIGHTS_WORKER_TOKEN \}\}/);
  assert.doesNotMatch(workflow, /OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|pull_request|schedule:/);
});
