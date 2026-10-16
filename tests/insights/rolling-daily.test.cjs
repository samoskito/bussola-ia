const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { load, source, root } = require('./helpers.cjs');
const daily = load('daily');
const { createInMemoryInsightRepository } = load('processor');
const { CLASSIFIER_VERSION } = load('classifier');
const now = new Date('2026-10-15T21:00:00.000Z');
const env = { INSIGHTS_MODE: 'live', INSIGHTS_PROCESSING_ENABLED: 'true', INSIGHTS_OPENAI_ENABLED: 'true',
  OPENAI_API_KEY: 'synthetic', INSIGHTS_MODEL: 'gpt-5.4-nano', INSIGHTS_MAX_SPEND_USD: '1',
  INSIGHTS_BUDGET_SCOPE: 'same-historical-durable-scope', INSIGHTS_BACKFILL_START: 'invalid-historical-start',
  INSIGHTS_BACKFILL_END: 'invalid-historical-end' };
const rows = [source({ id: 1, createdAt: '2025-06-10T10:00:00.000Z' }),
  source({ id: 2, createdAt: '2026-09-15T21:00:00.000Z' }), source({ id: 3 }),
  source({ id: 4, createdAt: '2026-09-15T20:59:59.999Z' }),
  source({ id: 5, createdAt: '2026-10-16T00:00:00.000Z' })];

test('fixed daily runner uses rolling 30 days despite historical env, preserves context and shared scope', async () => {
  const oldFlag = process.env.INSIGHTS_OPENAI_ENABLED;
  process.env.INSIGHTS_OPENAI_ENABLED = 'true';
  try {
    const repository = createInMemoryInsightRepository(rows);
    const scopes = [], classified = [];
    const reserve = repository.reserveBudget;
    repository.reserveBudget = async (...args) => { scopes.push(args); return reserve(...args); };
    const classifier = { provider: 'openai', version: `gpt-5.4-nano.${CLASSIFIER_VERSION}`, async classify(input) {
      classified.push(input.source.id);
      if (input.source.id === 2) assert.ok(input.context.some(row => row.id === 4), 'context before processing start remains available');
      return { classification: { kind: 'question', topicIds: ['feedback'], normalizedDemand: 'Preparar feedback.', confidence: .9, needsReview: false }, usage: null };
    } };
    const result = await daily.runRollingDailyInsights({ env, now, repository, classifier });
    assert.equal(result.completed, 2);
    assert.deepEqual(classified, [2, 3]);
    assert.ok(scopes.every(([scope, reservation, cap]) => scope === env.INSIGHTS_BUDGET_SCOPE && reservation === .01 && cap === 1));
    assert.equal(env.INSIGHTS_BACKFILL_START, 'invalid-historical-start');
    assert.equal(env.INSIGHTS_BACKFILL_END, 'invalid-historical-end');
    assert.equal((await daily.runRollingDailyInsights({ env, now, repository, classifier })).completed, 0);
    const restricted = await daily.runRollingDailyInsights({ env: { ...env, INSIGHTS_PILOT_SOURCE_IDS: '3' }, now,
      repository: createInMemoryInsightRepository(rows), classifier });
    assert.equal(restricted.inspected, 1);
    assert.equal(restricted.completed, 1, 'rolling worker must not bypass a pilot manifest still active on the server');
    await assert.rejects(daily.runRollingDailyInsights({ env: { ...env, INSIGHTS_MAX_SPEND_USD: '0' }, now, repository, classifier }), /budget/);
    await assert.rejects(daily.runRollingDailyInsights({ env: { ...env, INSIGHTS_PROCESSING_ENABLED: 'false' }, now, repository, classifier }), /processing_disabled/);
  } finally {
    if (oldFlag === undefined) delete process.env.INSIGHTS_OPENAI_ENABLED; else process.env.INSIGHTS_OPENAI_ENABLED = oldFlag;
  }
});

test('fixed daily route requires machine authentication and never reads request processing parameters', async () => {
  const route = require(path.join(root, 'src/app/api/insights/process/daily/route.ts'));
  const secret = 'synthetic-daily-worker-secret-over-32-characters';
  const keys = ['INSIGHTS_MODE', 'INSIGHTS_PROCESSING_ENABLED', 'INSIGHTS_OPENAI_ENABLED', 'INSIGHTS_CRON_SECRET'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const original = daily.runRollingDailyInsights;
  let calls = 0;
  try {
    process.env.INSIGHTS_MODE = 'live'; process.env.INSIGHTS_PROCESSING_ENABLED = 'true';
    process.env.INSIGHTS_OPENAI_ENABLED = 'true'; process.env.INSIGHTS_CRON_SECRET = secret;
    daily.runRollingDailyInsights = async (...args) => { calls++; assert.deepEqual(args, []); return { completed: 0 }; };
    const url = 'https://bussola.example/api/insights/process/daily?start=1900-01-01&maxSpendUsd=999999';
    for (const headers of [{}, { cookie: 'auth_token=synthetic-admin' }, { Authorization: 'Bearer wrong' }]) {
      const response = await route.POST(new Request(url, { method: 'POST', headers }));
      assert.equal(response.status, 401);
      assert.match(response.headers.get('cache-control'), /no-store/);
    }
    assert.equal(calls, 0);
    const request = new Request(url, { method: 'POST', headers: { Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ model: 'unapproved', sourceIds: [999], maxSpendUsd: 999999, start: '1900-01-01' }) });
    request.json = () => { throw new Error('Request body must not be parsed'); };
    request.text = () => { throw new Error('Request body must not be parsed'); };
    const success = await route.POST(request);
    assert.equal(success.status, 200);
    assert.equal(calls, 1);
    assert.deepEqual(await success.json(), { mode: 'live', completed: 0 });
    process.env.INSIGHTS_PROCESSING_ENABLED = 'false';
    assert.equal((await route.POST(request)).status, 503);
    assert.equal(calls, 1);
  } finally {
    daily.runRollingDailyInsights = original;
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
  }
});
