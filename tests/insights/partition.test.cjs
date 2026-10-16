const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { load, source, root } = require('./helpers.cjs');
const { processInsightBatch, createInMemoryInsightRepository } = load('processor');
const daily = load('daily');
const now = new Date('2026-10-16T12:00:00.000Z');
const env = { INSIGHTS_MODE: 'live', INSIGHTS_PROCESSING_ENABLED: 'true', INSIGHTS_OPENAI_ENABLED: 'true',
  OPENAI_API_KEY: 'synthetic', INSIGHTS_MODEL: 'gpt-5.4-nano', INSIGHTS_MAX_SPEND_USD: '5',
  INSIGHTS_BUDGET_SCOPE: 'unchanged-shared-scope', INSIGHTS_BACKFILL_START: '2025-06-09T00:00:00.000Z',
  INSIGHTS_BACKFILL_END: '2026-10-16T01:00:00.000Z' };
const classification = { kind: 'question', topicIds: ['feedback'], normalizedDemand: 'Preparar feedback.', confidence: .9, needsReview: false };
const rows = Array.from({ length: 24 }, (_, index) => source({ id: index + 1 }));
function classifier(provider = 'demo', capture = () => {}) {
  return { provider, version: 'synthetic-version', async classify(input) { capture(input); return { classification, usage: null }; } };
}

test('eight fixed partitions form the baseline without overlap, preserving context and source hashes', async () => {
  const baselineRepo = createInMemoryInsightRepository(rows);
  const baselineInputs = new Map();
  await processInsightBatch({ repository: baselineRepo, classifier: classifier('demo', input => baselineInputs.set(input.source.id, input)), now });
  const baseline = new Map((await baselineRepo.listCompleted()).map(row => [row.sourceId, row.sourceHash]));
  const seen = [];
  for (let partition = 0; partition < 8; partition++) {
    const repository = createInMemoryInsightRepository(rows);
    await processInsightBatch({ repository, classifier: classifier('demo', input => {
      assert.equal(input.source.id % 8, partition);
      assert.deepEqual(input.context, baselineInputs.get(input.source.id).context);
    }), partition, now });
    for (const result of await repository.listCompleted()) {
      assert.equal(result.sourceHash, baseline.get(result.sourceId));
      seen.push(result.sourceId);
    }
  }
  assert.equal(new Set(seen).size, rows.length);
  assert.deepEqual(seen.sort((a, b) => a - b), [...baseline.keys()]);
  assert.ok(baselineInputs.get(9).context.some(row => row.id % 8 !== 1));
  for (const partition of [-1, 8, NaN, 1.5, '1']) {
    await assert.rejects(processInsightBatch({ repository: baselineRepo, classifier: classifier(), partition, now }), /invalid_partition/);
  }
});

test('historical partitions retain manifest, server window, admin exclusion and shared atomic cap', async () => {
  const oldFlag = process.env.INSIGHTS_OPENAI_ENABLED;
  process.env.INSIGHTS_OPENAI_ENABLED = 'true';
  try {
    const repository = createInMemoryInsightRepository([...rows,
      source({ id: 25, userId: 'admin', userLevel: 'admin' }),
      source({ id: 26, createdAt: '2026-10-16T02:00:00.000Z' })]);
    const reserve = repository.reserveBudget;
    const scopeCalls = [];
    repository.reserveBudget = async (...args) => { scopeCalls.push(args); return reserve(...args); };
    await Promise.all(Array.from({ length: 8 }, (_, partition) => daily.runDailyInsights({ env, now, repository,
      classifier: classifier('openai'), partition })));
    assert.equal((await repository.listCompleted()).length, 24);
    assert.ok(scopeCalls.every(([scope, reservation, cap]) => scope === env.INSIGHTS_BUDGET_SCOPE && reservation === .01 && cap === 5));
    const restricted = createInMemoryInsightRepository(rows);
    await daily.runDailyInsights({ env: { ...env, INSIGHTS_PILOT_SOURCE_IDS: '1,9,2' }, now, repository: restricted,
      classifier: classifier('openai'), partition: 1 });
    assert.deepEqual((await restricted.listCompleted()).map(row => row.sourceId), [1, 9]);
    const capped = createInMemoryInsightRepository(rows);
    const results = await Promise.all(Array.from({ length: 8 }, (_, partition) => daily.runDailyInsights({
      env: { ...env, INSIGHTS_MAX_SPEND_USD: '.03' }, now, repository: capped, classifier: classifier('openai'), partition })));
    assert.equal((await capped.listCompleted()).length, 3);
    assert.ok(results.some(row => row.budgetStopped));
    await assert.rejects(daily.runDailyInsights({ env: { ...env, INSIGHTS_BACKFILL_START: undefined, INSIGHTS_BACKFILL_END: undefined },
      now, repository, classifier: classifier('openai'), partition: 0 }), /invalid_backfill_partition/);
    const rolling = createInMemoryInsightRepository(rows.slice(0, 3));
    await daily.runRollingDailyInsights({ env, now, repository: rolling, classifier: classifier('openai'), partition: 0 });
    assert.equal((await rolling.listCompleted()).length, 3, 'rolling daily remains unpartitioned');
  } finally {
    if (oldFlag === undefined) delete process.env.INSIGHTS_OPENAI_ENABLED; else process.env.INSIGHTS_OPENAI_ENABLED = oldFlag;
  }
});

test('partition route authenticates before parameters and never consumes processing configuration', async () => {
  const route = require(path.join(root, 'src/app/api/insights/process/backfill/[partition]/route.ts'));
  const secret = 'synthetic-worker-secret-with-more-than-32-characters';
  const keys = ['INSIGHTS_MODE', 'INSIGHTS_PROCESSING_ENABLED', 'INSIGHTS_OPENAI_ENABLED', 'INSIGHTS_CRON_SECRET'];
  const prior = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const original = daily.runDailyInsights;
  let calls = 0;
  try {
    for (const key of keys.slice(0, 3)) process.env[key] = env[key];
    process.env.INSIGHTS_CRON_SECRET = secret;
    daily.runDailyInsights = async options => { calls++; assert.deepEqual(options, { partition: 3 }); return { completed: 0 }; };
    const url = 'https://bussola.example/api/insights/process/backfill/3?maxSpendUsd=999&partition=7';
    for (const headers of [{}, { cookie: 'auth_token=synthetic-admin' }, { Authorization: 'Bearer wrong' }]) {
      let paramsRead = false;
      const context = { get params() { paramsRead = true; throw new Error('must authenticate first'); } };
      const denied = await route.POST(new Request(url, { method: 'POST', headers }), context);
      assert.equal(denied.status, 401);
      assert.equal(paramsRead, false);
    }
    const request = new Request(url, { method: 'POST', headers: { Authorization: `Bearer ${secret}` }, body: '{"maxSpendUsd":999}' });
    request.json = () => { throw new Error('must not consume request body'); };
    request.text = request.json;
    for (const partition of ['8', '-1', '03', '3.0', '', 'all']) {
      const denied = await route.POST(request, { params: Promise.resolve({ partition }) });
      assert.equal(denied.status, 400);
    }
    assert.equal(calls, 0);
    const success = await route.POST(request, { params: Promise.resolve({ partition: '3' }) });
    assert.equal(success.status, 200);
    assert.match(success.headers.get('cache-control'), /no-store/);
    assert.equal(calls, 1);
    process.env.INSIGHTS_PROCESSING_ENABLED = 'false';
    assert.equal((await route.POST(request, { params: Promise.resolve({ partition: '3' }) })).status, 503);
    assert.equal(calls, 1);
  } finally {
    daily.runDailyInsights = original;
    for (const key of keys) { if (prior[key] === undefined) delete process.env[key]; else process.env[key] = prior[key]; }
  }
});
