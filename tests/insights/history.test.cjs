const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, source, root } = require('./helpers.cjs');
const { parseInsightFilters } = load('filters');
const { buildDemoReport } = load('report');
const { insightProcessingWindow, runDailyInsights } = load('daily');
const { createInMemoryInsightRepository, processInsightBatch } = load('processor');
const { createSupabaseInsightRepository, findInsightHistoryStart } = load('supabase-repository');
const { prepareInsightInput, groupInsightSourcesByChat } = load('privacy');
const { CLASSIFIER_VERSION } = load('classifier');
const { TAXONOMY_VERSION } = load('taxonomy');
const now = new Date('2026-10-15T21:00:00.000Z');
const classification = { kind: 'question', topicIds: ['feedback'], normalizedDemand: 'Preparar feedback.', confidence: .9, needsReview: false };
const env = { INSIGHTS_MODE: 'live', INSIGHTS_PROCESSING_ENABLED: 'true', INSIGHTS_OPENAI_ENABLED: 'true',
  INSIGHTS_MODEL: 'gpt-5.4-nano', OPENAI_API_KEY: 'synthetic', INSIGHTS_MAX_SPEND_USD: '.03',
  INSIGHTS_BUDGET_SCOPE: 'existing-pilot-scope', INSIGHTS_BACKFILL_START: '2026-01-02T00:00:00.000Z', INSIGHTS_BACKFILL_END: '2026-10-15T12:00:00.000Z' };

test('all-history is an explicit strict filter and spans actual history without a fictitious previous period', () => {
  assert.deepEqual(parseInsightFilters(new URLSearchParams('days=all&agentType=all')), { days: 'all', agentType: 'all' });
  for (const query of ['days=all&days=30', 'days=all&start=1900-01-01', 'days=365', 'days=-1']) {
    assert.throws(() => parseInsightFilters(new URLSearchParams(query)), /Filtro|Período/);
  }
  const rows = [
    { ...source({ id: 1, createdAt: '2024-05-10T01:00:00.000Z' }), status: 'classified', classification },
    { ...source({ id: 2, userId: 'second', chatId: 'second', agentType: 'postagem' }), status: 'pending' },
    { ...source({ id: 3, userLevel: 'admin', agentType: 'apresentacao' }), status: 'classified', classification },
    { ...source({ id: 4, userLevel: null, agentType: 'conversas_dificeis' }), status: 'pending' },
    { ...source({ id: 5, createdAt: '2026-10-16T12:00:00.000Z' }), status: 'pending' },
  ];
  const report = buildDemoReport({ days: 'all', agentType: 'all' }, now, rows);
  assert.equal(report.window.start, '2024-05-09T03:00:00.000Z');
  assert.equal(report.summary.eligibleMessages, 2);
  assert.equal(report.summary.classifiedMessages, 1);
  assert.equal(report.summary.excludedAdminMessages, 1);
  assert.equal(report.summary.coveragePercent, 50);
  assert.equal(report.agents.length, 4);
  assert.ok(report.topics.every(topic => topic.trendPercent === null));
  assert.equal(report.trend[0].date, '2024-05-09');
  assert.equal(report.trend.at(-1).date, '2026-10-15');
  assert.equal(report.trend.reduce((sum, day) => sum + day.messages, 0), 2);
  assert.equal(buildDemoReport({ days: 90, agentType: 'all' }, now, rows).summary.eligibleMessages, 1);
  const empty = buildDemoReport({ days: 'all', agentType: 'all' }, now, []);
  assert.equal(empty.summary.eligibleMessages, 0);
  assert.equal(empty.window.start, '2026-10-15T03:00:00.000Z');
});

test('historical worker requires both explicit canonical bounds and an existing durable budget scope', () => {
  const window = insightProcessingWindow(env, now);
  assert.equal(window.start.toISOString(), env.INSIGHTS_BACKFILL_START);
  assert.equal(window.end.toISOString(), env.INSIGHTS_BACKFILL_END);
  assert.equal(window.historical, true);
  assert.equal(insightProcessingWindow({}, now).historical, false);
  for (const changes of [
    { INSIGHTS_BACKFILL_START: undefined }, { INSIGHTS_BACKFILL_END: undefined },
    { INSIGHTS_BACKFILL_START: '' }, { INSIGHTS_BACKFILL_START: '2026-02-30T00:00:00.000Z' },
    { INSIGHTS_BACKFILL_START: '2026-01-02' }, { INSIGHTS_BACKFILL_END: '2026-10-16T00:00:00.000Z' },
    { INSIGHTS_BACKFILL_END: env.INSIGHTS_BACKFILL_START }, { INSIGHTS_BUDGET_SCOPE: undefined },
  ]) assert.throws(() => insightProcessingWindow({ ...env, ...changes }, now), /backfill/);
});

test('backfill preserves a completed pilot, its retained spend, current role exclusion and both processing bounds', async () => {
  const oldFlag = process.env.INSIGHTS_OPENAI_ENABLED;
  process.env.INSIGHTS_OPENAI_ENABLED = 'true';
  try {
    const rows = [source({ id: 1, createdAt: '2026-01-01T10:00:00.000Z' }),
      source({ id: 2, createdAt: '2026-01-02T10:00:00.000Z' }), source({ id: 3 }),
      source({ id: 4, userId: 'admin', userLevel: 'admin', createdAt: '2026-01-02T10:00:00.000Z' }),
      source({ id: 5, createdAt: '2026-10-15T12:00:00.000Z' }), source({ id: 6, createdAt: '2026-10-15T20:00:00.000Z' })];
    const repository = createInMemoryInsightRepository(rows);
    const calls = [];
    const classifier = { provider: 'openai', version: `gpt-5.4-nano.${CLASSIFIER_VERSION}`, async classify(input) {
      calls.push(input.source.id);
      if (input.source.id === 2) assert.deepEqual(input.context.map(item => item.id), [1]);
      return { classification, usage: null };
    } };
    await processInsightBatch({ repository, classifier, now, sourceIds: [3], maxSpendUsd: .01, reserveUsdPerCall: .01, budgetScope: env.INSIGHTS_BUDGET_SCOPE });
    const pilot = (await repository.listCompleted())[0];
    const blocked = await runDailyInsights({ env: { ...env, INSIGHTS_MAX_SPEND_USD: '.01' }, repository, classifier, now });
    assert.equal(blocked.budgetStopped, true);
    assert.deepEqual(calls, [3]);
    const backfill = await runDailyInsights({ env, repository, classifier, now });
    assert.equal(backfill.completed, 1);
    assert.equal(backfill.skipped, 1);
    assert.equal(backfill.excluded, 1);
    assert.deepEqual(calls, [3, 2]);
    assert.deepEqual((await repository.listCompleted()).find(row => row.sourceId === 3), pilot);
    assert.equal((await repository.listCompleted()).length, 2);
    const resumed = await runDailyInsights({ env, repository, classifier, now });
    assert.equal(resumed.completed, 0);
    assert.deepEqual(calls, [3, 2]);
    // A remaining pilot manifest remains restrictive even when a historical window is configured.
    const restricted = await runDailyInsights({ env: { ...env, INSIGHTS_PILOT_SOURCE_IDS: '3' }, repository, classifier, now });
    assert.equal(restricted.inspected, 1);
  } finally {
    if (oldFlag === undefined) delete process.env.INSIGHTS_OPENAI_ENABLED;
    else process.env.INSIGHTS_OPENAI_ENABLED = oldFlag;
  }
});

test('conversation indexing preserves source hashes and rejects foreign conversation context', () => {
  const rows = [source(), source({ id: 2, createdAt: '2026-10-14T13:00:00.000Z' }),
    source({ id: 3, chatId: 'different', input: 'Outro contexto privado.' })];
  const grouped = groupInsightSourcesByChat(rows);
  const full = prepareInsightInput(rows[1], rows, 'taxonomy', 'classifier');
  const scoped = prepareInsightInput(rows[1], grouped.get(rows[1].chatId), 'taxonomy', 'classifier');
  assert.equal(scoped.sourceHash, full.sourceHash);
  assert.deepEqual(scoped.context, full.context);
});

test('historical repository uses keyset pages past 20k for sources, jobs and valid active classifications', async () => {
  const count = 20_001;
  const createdAt = '2024-01-01T10:00:00.000Z';
  const version = `gpt-5.4-nano.${CLASSIFIER_VERSION}`;
  const sources = Array.from({ length: count }, (_, index) => source({ id: index + 1, chatId: `chat-${index}`, createdAt }));
  const sourceRows = sources.map(row => ({ id: row.id, user_id: row.userId, chatid: row.chatId, input: row.input, created_at: row.createdAt,
    users: { nivel: 'user' }, chats: { agent_type: row.agentType, user_id: row.userId } }));
  const insightRows = sources.map(row => ({ script_id: row.id, user_id: row.userId, chat_id: row.chatId, agent_type: row.agentType,
    source_created_at: row.createdAt, source_hash: prepareInsightInput(row, [row], TAXONOMY_VERSION, version).sourceHash,
    taxonomy_version: TAXONOMY_VERSION, classifier_version: version, processed_at: now.toISOString(),
    message_kind: classification.kind, topic_ids: classification.topicIds, normalized_demand: classification.normalizedDemand,
    confidence: classification.confidence, needs_review: false, users: { nivel: 'user' } }));
  const jobs = sources.map(row => ({ job_key: `job-${String(row.id).padStart(6, '0')}`, script_id: row.id, user_id: row.userId,
    source_hash: 'hash', status: 'completed', attempts: 1 }));
  const queries = [];
  const client = { from(table) {
    const query = { table, after: undefined, limit: undefined };
    queries.push(query);
    const builder = {
      select() { return this; }, gte() { return this; }, lt() { return this; }, eq() { return this; }, order() { return this; },
      or(filter) { query.after = Number(filter.match(/id\.gt\.(\d+)/)[1]); return this; },
      gt(_field, value) { query.after = value; return this; },
      limit(value) { query.limit = value; return this; },
      then(resolve, reject) {
        const rows = table === 'scripts' ? sourceRows : table === 'script_insights' ? insightRows : jobs;
        const key = table === 'scripts' ? 'id' : table === 'script_insights' ? 'script_id' : 'job_key';
        return Promise.resolve({ data: rows.filter(row => query.after === undefined || row[key] > query.after).slice(0, query.limit), error: null }).then(resolve, reject);
      },
    };
    return builder;
  } };
  const options = { env, now, windowStart: new Date(createdAt), allowHistoricalWindow: true };
  assert.throws(() => createSupabaseInsightRepository(client, { ...options, allowHistoricalWindow: false }), /repository_window/);
  assert.throws(() => createSupabaseInsightRepository(client, { ...options, windowEnd: new Date('2027-01-01T00:00:00.000Z') }), /repository_window/);
  const repository = createSupabaseInsightRepository(client, options);
  assert.equal((await repository.listSources()).length, count);
  assert.equal((await repository.listJobs()).length, count);
  assert.equal((await repository.listCompleted()).length, count);
  for (const table of ['scripts', 'script_insights', 'insight_jobs']) {
    const pages = queries.filter(query => query.table === table);
    assert.ok(pages.length > 40);
    assert.ok(pages.some(query => query.after !== undefined));
    assert.ok(pages.every(query => query.limit === 500));
  }
});

test('all-history discovery reads only the earliest source timestamp and handles an empty database', async () => {
  const columns = [];
  const client = { from(table) {
    assert.equal(table, 'scripts');
    return { select(value) { columns.push(value); return this; }, lt() { return this; }, order() { return this; }, limit(value) { assert.equal(value, 1); return this; },
      async maybeSingle() { return { data: columns.length === 1 ? { created_at: '2024-01-01T10:00:00.000Z' } : null, error: null }; } };
  } };
  assert.equal((await findInsightHistoryStart(client, now)).toISOString(), '2024-01-01T10:00:00.000Z');
  assert.equal(await findInsightHistoryStart(client, now), undefined);
  assert.deepEqual(columns, ['created_at', 'created_at']);
});

test('unsupported/null historical agents are excluded without guessing an IA or stopping the source cursor', async () => {
  const rows = Array.from({ length: 501 }, (_, index) => ({ id: index + 1, user_id: 'synthetic-user', chatid: `chat-${index}`,
    input: 'Conteúdo sintético.', created_at: '2025-06-10T10:00:00.000Z', users: { nivel: 'user' },
    chats: { user_id: 'synthetic-user', agent_type: index === 500 ? 'postagem' : index % 2 ? null : 'unsupported' } }));
  const cursors = [];
  const makeClient = data => ({ from() {
    let after = 0;
    return { select() { return this; }, gte() { return this; }, lt() { return this; }, order() { return this; },
      or(filter) { after = Number(filter.match(/id\.gt\.(\d+)/)[1]); cursors.push(after); return this; }, limit() { return this; },
      then(resolve, reject) { return Promise.resolve({ data: data.filter(row => row.id > after).slice(0, 500), error: null }).then(resolve, reject); } };
  } });
  const options = { env, now, windowStart: new Date('2025-06-01T00:00:00.000Z'), allowHistoricalWindow: true };
  const supported = await createSupabaseInsightRepository(makeClient(rows), options).listSources();
  assert.equal(supported.length, 1);
  assert.equal(supported[0].id, 501);
  assert.equal(supported[0].agentType, 'postagem');
  assert.deepEqual(cursors, [500]);
  for (const broken of [
    { ...rows[0], chats: null }, { ...rows[0], users: null },
    { ...rows[0], chats: { ...rows[0].chats, user_id: 'different-owner' } },
    { ...rows[0], users: { nivel: 'unknown-role' } },
  ]) await assert.rejects(createSupabaseInsightRepository(makeClient([broken]), options).listSources(), /invalid_source_relationship|invalid_user_level/);
});

test('resumed exact active snapshots avoid per-user GETs while new work and live reports recheck roles', async () => {
  const repository = createInMemoryInsightRepository(Array.from({ length: 200 }, (_, index) =>
    source({ id: index + 1, userId: `user-${index + 1}`, chatId: `chat-${index + 1}` })));
  let providerCalls = 0;
  const classifier = { provider: 'mock', version: `gpt-5.4-nano.${CLASSIFIER_VERSION}`, async classify(input) {
    providerCalls++;
    return { classification: { ...classification, normalizedDemand: `Derived message ${input.source.id}.` }, usage: null };
  } };
  for (let batch = 0; batch < 4; batch++) await processInsightBatch({ repository, classifier, now, maxMessages: 50 });
  assert.equal(providerCalls, 200);
  const originalLevel = repository.currentUserLevel;
  const originalRemove = repository.removeDerivedByUser;
  const originalComplete = repository.complete;
  let roleReads = 0, removals = 0, writes = 0;
  repository.currentUserLevel = async id => { roleReads++; return originalLevel(id); };
  repository.removeDerivedByUser = async id => { removals++; return originalRemove(id); };
  repository.complete = async (...args) => { writes++; return originalComplete(...args); };
  const resumed = await processInsightBatch({ repository, classifier, now, maxMessages: 10 });
  assert.equal(resumed.skipped, 200);
  assert.equal(roleReads, 0);
  assert.equal(providerCalls, 200);
  assert.equal(writes, 0);
  repository.upsertSource(source({ id: 201, userId: 'user-201', chatId: 'chat-201' }));
  const extended = await processInsightBatch({ repository, classifier, now, maxMessages: 10 });
  assert.equal(extended.skipped, 200);
  assert.equal(extended.completed, 1);
  assert.equal(roleReads, 2, 'new work still rechecks the current role before and after classification');
  assert.equal(writes, 1);
  // The source snapshot is deliberately stale after this promotion. Skipping
  // existing results may retain a stored row, but must not publish/resurrect it.
  const freshSources = repository.listSources;
  const staleSnapshot = await repository.listSources();
  repository.listSources = async () => staleSnapshot;
  repository.setCurrentUserLevel('user-1', 'admin');
  roleReads = 0;
  const promoted = await processInsightBatch({ repository, classifier, now, maxMessages: 10 });
  assert.equal(promoted.skipped, 201);
  assert.equal(roleReads, 0);
  assert.equal(writes, 1);
  assert.equal(removals, 0);
  assert.equal(providerCalls, 201);
  const repositoryModule = load('supabase-repository');
  const serverModule = require(require('node:path').join(root, 'src/lib/supabase/server.ts'));
  const originals = { repository: repositoryModule.createSupabaseInsightRepository,
    history: repositoryModule.findInsightHistoryStart, client: serverModule.createServerSupabaseClient };
  const flags = ['INSIGHTS_MODE', 'INSIGHTS_PROCESSING_ENABLED', 'INSIGHTS_MODEL'];
  const priorEnv = Object.fromEntries(flags.map(key => [key, process.env[key]]));
  try {
    repositoryModule.createSupabaseInsightRepository = () => repository;
    repositoryModule.findInsightHistoryStart = async () => new Date('2026-10-14T12:00:00.000Z');
    serverModule.createServerSupabaseClient = () => ({});
    process.env.INSIGHTS_MODE = 'live';
    process.env.INSIGHTS_PROCESSING_ENABLED = 'true';
    process.env.INSIGHTS_MODEL = 'gpt-5.4-nano';
    const report = await load('service').buildLiveReport({ days: 'all', agentType: 'all' }, now);
    assert.equal(roleReads, 201, 'live report rechecks every current subject instead of trusting the worker snapshot');
    assert.equal(report.summary.eligibleMessages, 200);
    assert.equal(report.summary.classifiedMessages, 200);
    assert.equal(report.summary.excludedAdminMessages, 1);
    assert.ok(report.examples.every(example => example.demand !== 'Derived message 1.'));
    assert.equal(writes, 1);
    assert.equal(providerCalls, 201);
  } finally {
    repositoryModule.createSupabaseInsightRepository = originals.repository;
    repositoryModule.findInsightHistoryStart = originals.history;
    serverModule.createServerSupabaseClient = originals.client;
    for (const key of flags) {
      if (priorEnv[key] === undefined) delete process.env[key]; else process.env[key] = priorEnv[key];
    }
  }
  // If a snapshot already sees admin, cleanup still executes after a live read.
  repository.listSources = freshSources;
  repository.upsertSource(source({ id: 1, userId: 'user-1', chatId: 'chat-1', userLevel: 'admin' }));
  await processInsightBatch({ repository, classifier, now, maxMessages: 10 });
  assert.equal(removals, 1);
  assert.ok(!(await repository.listCompleted()).some(row => row.sourceId === 1));
});
