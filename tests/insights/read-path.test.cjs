'use strict';
// Read-path accelerators must return exactly what the original sequential path returns.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { load, root } = require('./helpers.cjs');
const repositoryModule = load('supabase-repository');
const { prepareInsightInput } = load('privacy');
const { CLASSIFIER_VERSION } = load('classifier');
const { TAXONOMY_VERSION } = load('taxonomy');

const now = new Date('2026-10-20T15:00:00.000Z');
const version = `gpt-5.4-nano.${CLASSIFIER_VERSION}`;
const env = { INSIGHTS_MODE: 'live', INSIGHTS_MODEL: 'gpt-5.4-nano' };
const classification = { kind: 'question', topicIds: ['feedback'], normalizedDemand: 'Resumo.', confidence: .9, needsReview: false };

/** Minimal PostgREST-like fake that really evaluates the filters used by the repository. */
function fakeClient(tables) {
  const stats = { requests: 0, byTable: {} };
  const value = (row, column) => column.split('.').reduce((item, key) => item?.[key], row);
  const cmp = (a, b) => typeof a === 'number' && typeof b === 'number' ? a - b
    : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
  const time = v => /\d{4}-\d{2}-\d{2}T/.test(String(v)) ? Date.parse(v) : v;
  const compare = (a, b) => cmp(time(a), time(b));
  function from(table) {
    const predicates = []; const orders = []; let limit = Infinity;
    const run = single => {
      stats.requests++; stats.byTable[table] = (stats.byTable[table] ?? 0) + 1;
      let rows = (tables[table] ?? []).filter(row => predicates.every(p => p(row)));
      rows = rows.slice().sort((a, b) => { for (const [column, asc] of orders) { const c = compare(value(a, column), value(b, column)); if (c) return asc ? c : -c; } return 0; });
      rows = rows.slice(0, limit);
      return { data: single ? rows[0] ?? null : rows, error: null };
    };
    const builder = {
      select() { return builder; },
      eq(column, v) { predicates.push(row => value(row, column) === v); return builder; },
      neq(column, v) { predicates.push(row => value(row, column) !== v); return builder; },
      gte(column, v) { predicates.push(row => compare(value(row, column), v) >= 0); return builder; },
      gt(column, v) { predicates.push(row => compare(value(row, column), v) > 0); return builder; },
      lt(column, v) { predicates.push(row => compare(value(row, column), v) < 0); return builder; },
      lte(column, v) { predicates.push(row => compare(value(row, column), v) <= 0); return builder; },
      in(column, list) { predicates.push(row => list.includes(value(row, column))); return builder; },
      like(column, pattern) { const re = new RegExp('^' + pattern.replace(/%/g, '.*') + '$'); predicates.push(row => re.test(String(value(row, column)))); return builder; },
      or(filter) {
        const m = /^created_at\.gt\.([^,]+),and\(created_at\.eq\.([^,]+),id\.gt\.(\d+)\)$/.exec(filter);
        if (!m) throw new Error('unsupported_or');
        predicates.push(row => compare(row.created_at, m[1]) > 0 || (compare(row.created_at, m[2]) === 0 && row.id > Number(m[3])));
        return builder;
      },
      order(column, options = {}) { orders.push([column, options.ascending !== false]); return builder; },
      limit(n) { limit = n; return builder; },
      maybeSingle() { return Promise.resolve(run(true)); },
      then(resolve, reject) { return Promise.resolve(run(false)).then(resolve, reject); },
    };
    return builder;
  }
  return { client: { from, rpc: async () => ({ data: null, error: null }) }, stats };
}

function dataset(count = 2600) {
  const users = Array.from({ length: 140 }, (_, i) => ({ id: `user-${i}`, nivel: i % 23 === 0 ? 'admin' : i % 37 === 0 ? null : 'user' }));
  const scripts = [];
  let id = 10;
  for (let i = 0; i < count; i++) {
    id += 1 + (i % 7 === 0 ? 5 : 0); // id gaps
    const user = users[(i * 11) % users.length];
    // Timestamps intentionally NOT monotonic with ids, with sub-second ties.
    const t = Date.parse('2025-06-09T12:00:00.000Z') + ((i * 7919) % count) * 3_600_000 + (i % 3) * 250;
    const agent = i % 211 === 0 ? 'legado' : ['comunicacao', 'apresentacao', 'conversas_dificeis', 'postagem'][i % 4];
    scripts.push({ id, user_id: user.id, chatid: `chat-${user.id}-${i % 5}`, input: i % 401 === 0 ? 'x'.repeat(7000) : `Pergunta ${i}`,
      created_at: new Date(t).toISOString(), users: { nivel: user.nivel }, chats: { agent_type: agent, user_id: user.id } });
  }
  return { users, scripts };
}

function withInsights({ users, scripts }) {
  const parsed = scripts.map(repositoryModule.parseSource).filter(Boolean);
  const byChat = new Map();
  for (const s of parsed) byChat.set(s.chatId, [...(byChat.get(s.chatId) ?? []), s]);
  const level = new Map(users.map(u => [u.id, u.nivel]));
  const insights = [], jobs = [];
  parsed.forEach((s, i) => {
    if (level.get(s.userId) !== 'user') return;
    const current = { ...s, userLevel: 'user' };
    const context = (byChat.get(s.chatId) ?? []).map(item => ({ ...item, userLevel: level.get(item.userId) ?? null }));
    let hash;
    try { hash = prepareInsightInput(current, context, TAXONOMY_VERSION, version).sourceHash; } catch {
      jobs.push({ job_key: `rejected:${s.id}`, script_id: s.id, user_id: s.userId, source_hash: 'rejected', status: 'failed', attempts: 1, error_code: 'input_rejected', created_at: s.createdAt });
      return;
    }
    if (i % 13 === 0) { jobs.push({ job_key: `${s.id}:${hash}`, script_id: s.id, user_id: s.userId, source_hash: hash, status: i % 2 ? 'failed' : 'retry', attempts: 3, created_at: s.createdAt }); return; }
    if (i % 17 === 0) return; // pending
    jobs.push({ job_key: `${s.id}:${hash}`, script_id: s.id, user_id: s.userId, source_hash: hash, status: 'completed', attempts: 1, created_at: s.createdAt });
    insights.push({ script_id: s.id, user_id: s.userId, chat_id: s.chatId, agent_type: s.agentType, source_created_at: s.createdAt,
      source_hash: i % 29 === 0 ? 'stale-hash' : hash, taxonomy_version: TAXONOMY_VERSION, classifier_version: version, status: 'classified',
      processed_at: new Date(Date.parse(s.createdAt) + 60_000).toISOString(), message_kind: classification.kind, topic_ids: classification.topicIds,
      normalized_demand: classification.normalizedDemand, confidence: classification.confidence, needs_review: false, users: { nivel: 'user' } });
  });
  return { users, scripts, script_insights: insights, insight_jobs: jobs };
}

test('idSlices are disjoint, open-ended and cover every id', () => {
  const { idSlices } = repositoryModule;
  assert.deepEqual(idSlices(5, 5), [{}]);
  assert.deepEqual(idSlices(1, 900), [{}]);
  const slices = idSlices(11, 20_010);
  assert.equal(slices.length, 12);
  assert.equal(slices[0].from, undefined);
  assert.equal(slices.at(-1).to, undefined);
  for (let i = 1; i < slices.length; i++) assert.equal(slices[i].from, slices[i - 1].to);
  for (const id of [-5, 11, 1000, 1677, 1678, 20_010, 99_999]) {
    assert.equal(slices.filter(s => (s.from === undefined || id >= s.from) && (s.to === undefined || id < s.to)).length, 1);
  }
  assert.throws(() => idSlices(10, 1));
});

test('parallel read path returns the same sources, insights, failed jobs and levels as the sequential path', async () => {
  const tables = withInsights(dataset());
  const windowStart = new Date('2025-06-01T00:00:00.000Z');
  const options = { env, now, windowStart, windowEnd: now, allowHistoricalWindow: true };
  const { client, stats } = fakeClient(tables);
  const repo = repositoryModule.createSupabaseInsightRepository(client, options);
  const sequential = (await repo.listSources()).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id);
  const before = stats.requests;
  const parallel = await repo.listSourcesForRead();
  assert.deepEqual(parallel, sequential);
  assert.ok(parallel.length > 2400 && parallel.every(row => row.agentType !== 'legado'));
  assert.ok(stats.requests - before <= 2 + 2 * repositoryModule.idSlices(11, 6000).length + 2, 'two bound reads plus about two pages per slice');

  const verified = await repo.listCompleted();
  const active = await repo.listActiveInsightsForRead();
  assert.ok(active.length > verified.length, 'unverified snapshot keeps stale-hash rows for the caller to reject');
  assert.deepEqual(new Set(verified.map(i => i.sourceId)), new Set(active.filter(i => verified.some(v => v.sourceId === i.sourceId)).map(i => i.sourceId)));

  const failed = await repo.listFailedJobsForRead();
  assert.deepEqual(failed.map(j => j.key).sort(), (await repo.listJobs()).filter(j => j.status === 'failed').map(j => j.key).sort());

  const ids = [...tables.users.map(u => u.id), 'missing-user'];
  const levelsBefore = stats.requests;
  const levels = await repo.currentUserLevels(ids);
  assert.equal(stats.requests - levelsBefore, Math.ceil(ids.length / 100));
  for (const id of ids) assert.equal(levels.get(id), await repo.currentUserLevel(id));
});

test('live load is identical with and without the accelerators, with far fewer requests', async () => {
  const tables = withInsights(dataset());
  const serverModule = require(path.join(root, 'src/lib/supabase/server.ts'));
  const service = load('service');
  const originals = { client: serverModule.createServerSupabaseClient, repo: repositoryModule.createSupabaseInsightRepository };
  const flags = ['INSIGHTS_MODE', 'INSIGHTS_PROCESSING_ENABLED', 'INSIGHTS_MODEL'];
  const prior = Object.fromEntries(flags.map(key => [key, process.env[key]]));
  Object.assign(process.env, { INSIGHTS_MODE: 'live', INSIGHTS_PROCESSING_ENABLED: 'true', INSIGHTS_MODEL: 'gpt-5.4-nano' });
  const run = async strip => {
    const { client, stats } = fakeClient(tables);
    serverModule.createServerSupabaseClient = () => client;
    repositoryModule.createSupabaseInsightRepository = (c, o) => {
      const repo = originals.repo(c, o);
      if (strip) for (const key of ['listSourcesForRead', 'listActiveInsightsForRead', 'listFailedJobsForRead', 'currentUserLevels']) delete repo[key];
      return repo;
    };
    const live = await service.openLiveInsightSource(now);
    const result = await live.load(new Date('2025-06-01T00:00:00.000Z'), true);
    return { result, requests: stats.requests };
  };
  try {
    const slow = await run(true);
    const fast = await run(false);
    assert.deepEqual(fast.result, slow.result);
    const statuses = fast.result.rows.reduce((acc, row) => ({ ...acc, [row.status]: (acc[row.status] ?? 0) + 1 }), {});
    assert.ok(statuses.classified > 1000 && statuses.pending > 0 && statuses.failed > 0, JSON.stringify(statuses));
    assert.ok(fast.result.rows.some(row => row.userLevel === 'admin') && fast.result.rows.some(row => row.userLevel === null));
    assert.ok(fast.requests * 4 < slow.requests, `${fast.requests} vs ${slow.requests}`);
  } finally {
    serverModule.createServerSupabaseClient = originals.client;
    repositoryModule.createSupabaseInsightRepository = originals.repo;
    for (const key of flags) { if (prior[key] === undefined) delete process.env[key]; else process.env[key] = prior[key]; }
  }
});
