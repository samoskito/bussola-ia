'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../insights/helpers.cjs');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { createInsightsMcpHandler } = require('../../src/lib/insights-mcp/protocol.ts');
const { buildInsightReport } = require('../../src/lib/insights/report.ts');
const clock = () => new Date('2026-10-15T21:00:00Z');
const endpoint = 'https://insights.example/api/insights-mcp';
const base = { id: 1923812, userId: 'CUSTOMER-ID-PRIVATE', chatId: 'CHAT-ID-PRIVATE', agentType: 'comunicacao',
  input: 'RAW-INPUT-PRIVATE', createdAt: '2026-10-15T12:00:00Z', userLevel: 'user', status: 'classified',
  classification: { kind: 'initial_request', topicIds: ['feedback'], normalizedDemand: 'Preparar feedback para person@example.com.', confidence: .9, needsReview: false } };
const fixtures = [base, { ...base, id: 2, classification: { ...base.classification, normalizedDemand: 'REVIEW-PRIVATE', needsReview: true } },
  { ...base, id: 3, status: 'pending', classification: undefined },
  { ...base, id: 4, userLevel: 'admin', classification: { ...base.classification, normalizedDemand: 'ADMIN-PRIVATE' } },
  { ...base, id: 5, userLevel: null, classification: { ...base.classification, normalizedDemand: 'UNKNOWN-PRIVATE' } },
  { ...base, id: 6, createdAt: '2026-09-15T12:00:00Z' }];
function setup(overrides = {}) {
  const state = { authenticated: true, role: 'admin', revoked: false, reads: [], authChecks: 0 };
  const deps = { enabled: () => true, canonicalOrigin: () => 'https://insights.example', now: clock,
    authenticate: async request => {
      state.authChecks++;
      if (!state.authenticated || request.headers.get('authorization') !== 'Bearer synthetic-test-token' || state.role !== 'admin' || state.revoked) throw new Error('denied');
    },
    authError: () => Response.json({ error: 'invalid_token' }, { status: 401, headers: { 'WWW-Authenticate': 'Bearer resource_metadata="https://insights.example/.well-known/oauth-protected-resource/api/insights-mcp"' } }),
    readReport: async (filters, now, examples) => {
      state.reads.push({ filters, now, ...(examples ? { examples } : {}) });
      return buildInsightReport(filters, now, overrides.fixtures ?? fixtures, { mode: 'live', examples, processing: { provider: 'openai', state: 'ready', scheduleLabel: 'prepared', lastProcessedAt: clock().toISOString() } });
    }, ...overrides };
  return { state, handler: createInsightsMcpHandler(deps) };
}
async function withClient(run, overrides) {
  const { state, handler } = setup(overrides);
  const client = new Client({ name: 'live-mcp-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: { headers: { Authorization: 'Bearer synthetic-test-token' } },
    fetch: (url, init) => handler(new Request(url, init)),
  });
  try { await client.connect(transport); await run(client, state); }
  finally { await client.close(); }
}
function payload(result) {
  assert.notEqual(result.isError, true, JSON.stringify(result));
  const data = JSON.parse(result.content.find(c => c.type === 'text').text);
  assert.deepEqual(result.structuredContent, data);
  assert.equal(data.mode, 'live');
  assert.equal(data.generatedAt, clock().toISOString());
  return data;
}
test('live stateless SDK handshake, five strict read-only tools (question tools gated off), real reader projections and coverage', async () => {
  await withClient(async (client, state) => {
    const tools = (await client.listTools()).tools;
    assert.deepEqual(tools.map(t => t.name).sort(), ['compare_insight_periods', 'get_insight_summary', 'get_topic_examples', 'get_topic_trend', 'list_demand_topics']);
    for (const tool of tools) {
      assert.equal(tool.annotations.readOnlyHint, true);
      assert.equal(tool.annotations.destructiveHint, false);
      assert.equal(tool.inputSchema.additionalProperties, false);
    }
    assert.equal(state.reads.length, 0, 'handshake and discovery never load data');
    const call = async (name, args = {}) => payload(await client.callTool({ name, arguments: args }));
    const summary = await call('get_insight_summary');
    assert.equal(summary.summary.eligibleMessages, 3);
    assert.equal(summary.summary.classifiedMessages, 2);
    assert.equal(summary.summary.excludedAdminMessages, 1);
    assert.equal(summary.summary.coveragePercent, 66.7);
    assert.deepEqual(summary.filters, { days: 30, agentType: 'all' });
    const topics = await call('list_demand_topics', { topicId: 'feedback' });
    assert.equal(topics.topics[0].messages, 2);
    assert.equal(topics.coverage.coveragePercent, 66.7);
    const trend = await call('get_topic_trend', { topicId: 'feedback', days: 7 });
    assert.equal(trend.trend.length, 7);
    const examples = await call('get_topic_examples', { topicId: 'feedback', limit: 1 });
    assert.deepEqual(examples.examples, []);
    assert.equal(examples.availability, 'disabled_pending_review');
    const comparison = await call('compare_insight_periods', { topicId: 'feedback' });
    assert.equal(Date.parse(comparison.previous.window.end) + 30 * 86400000, Date.parse(comparison.current.window.end));
    assert.equal(comparison.previous.topics[0].messages, 1);
    assert.equal(comparison.current.topics[0].messages, 2);
    assert.equal(comparison.changes[0].messageDelta, 1);
    for (const data of [summary, topics, trend, examples, comparison]) {
      const text = JSON.stringify(data);
      for (const forbidden of ['RAW-INPUT-PRIVATE', 'ADMIN-PRIVATE', 'UNKNOWN-PRIVATE', 'CUSTOMER-ID-PRIVATE', 'CHAT-ID-PRIVATE', 'REVIEW-PRIVATE', '1923812']) assert.ok(!text.includes(forbidden));
      assert.match(data.qualityNotice, /parciais/);
      assert.match(data.qualityNotice, /não confiáveis/);
    }
  });
});
test('separate opt-in examples project derived fields with questionId, unmasked for admins, and exclude review cases', async () => {
  await withClient(async (client, state) => {
    const data = payload(await client.callTool({ name: 'get_topic_examples', arguments: { topicId: 'feedback' } }));
    assert.equal(data.examples.length, 1);
    assert.deepEqual(Object.keys(data.examples[0]).sort(), ['agentType', 'confidence', 'createdAt', 'demand', 'kind', 'needsReview', 'questionId', 'topicId']);
    assert.equal(data.examples[0].questionId, base.id, 'questionId leads to get_student_question');
    assert.equal(data.examples[0].demand, 'Preparar feedback para person@example.com.', 'admin-only summaries are no longer masked (product decision)');
    assert.ok(!JSON.stringify(data).includes('RAW-INPUT-PRIVATE') && !JSON.stringify(data).includes('REVIEW-PRIVATE'));
    assert.ok(!JSON.stringify(data).includes('ADMIN-PRIVATE') && !JSON.stringify(data).includes('UNKNOWN-PRIVATE'));
    assert.ok(!JSON.stringify(data).includes('CUSTOMER-ID-PRIVATE') && !JSON.stringify(data).includes('CHAT-ID-PRIVATE'));
    assert.equal(data.availability, 'automated_summaries');
    assert.match(data.examplesNotice, /sem confirmação de revisão humana/);
    assert.match(data.dataNotice, /questionId/);
    assert.deepEqual(state.reads.at(-1).examples, { limit: 5, excludeNeedsReview: true });
  }, { examplesEnabled: () => true });
});
test('examples fill the requested limit even when the newest rows need review', async () => {
  const many = [
    ...Array.from({ length: 15 }, (_, i) => ({ ...base, id: 100 + i, createdAt: `2026-10-15T1${String(i % 10)}:${String(10 + i)}:00Z`,
      classification: { ...base.classification, normalizedDemand: `REVIEW-${i}`, needsReview: true } })),
    ...Array.from({ length: 10 }, (_, i) => ({ ...base, id: 200 + i, createdAt: `2026-10-1${i % 5}T08:00:0${i % 10}Z`,
      classification: { ...base.classification, normalizedDemand: `OK-${i}` } })),
  ];
  await withClient(async client => {
    const data = payload(await client.callTool({ name: 'get_topic_examples', arguments: { topicId: 'feedback', limit: 8 } }));
    assert.equal(data.examples.length, 8);
    assert.ok(data.examples.every(example => example.needsReview === false && example.demand.startsWith('OK-')));
    const all = payload(await client.callTool({ name: 'get_topic_examples', arguments: { topicId: 'feedback', limit: 12 } }));
    assert.equal(all.examples.length, 10, 'every non-review example available, not 12 minus review rows');
  }, { examplesEnabled: () => true, fixtures: many });
});
test('SDK rejects invalid filters, arbitrary queries, URLs and unregistered tools before reading', async () => {
  await withClient(async (client, state) => {
    for (const [name, args] of [
      ['get_insight_summary', { days: 31 }], ['get_insight_summary', { days: '30' }], ['get_insight_summary', { agentType: 'admin' }],
      ['list_demand_topics', { topicId: 'invalid' }], ['get_topic_trend', {}], ['get_topic_examples', { limit: 13 }],
      ['get_topic_examples', { limit: 0 }], ['get_insight_summary', { sql: 'select * from users' }],
      ['get_insight_summary', { url: 'https://outside.example' }], ['get_insight_summary', { userId: 'private' }],
      ['classify_messages', {}],
    ]) {
      try { const result = await client.callTool({ name, arguments: args }); assert.equal(result.isError, true); }
      catch (e) { assert.match(String(e), /invalid|argument|parameter|parse|32602|not found|unknown/i); }
    }
    assert.equal(state.reads.length, 0);
  });
});
test('auth is rechecked after handshake; role downgrade and revocation prevent discovery and data', async () => {
  await withClient(async (client, state) => {
    state.role = 'user';
    await assert.rejects(client.listTools());
    await assert.rejects(client.callTool({ name: 'get_insight_summary', arguments: {} }));
    state.role = 'admin'; state.revoked = true;
    await assert.rejects(client.callTool({ name: 'get_insight_summary', arguments: {} }));
    assert.equal(state.reads.length, 0);
    assert.ok(state.authChecks >= 4);
  });
});
test('denial precedes body reads; disabled gate, host/origin, HTTP verbs and body bound fail closed', async () => {
  const { handler, state } = setup();
  const denied = new Request(endpoint, { method: 'POST', body: 'not-json' });
  denied.json = () => { throw new Error('body must not parse'); };
  const refusal = await handler(denied);
  assert.equal(refusal.status, 401);
  assert.match(refusal.headers.get('www-authenticate'), /resource_metadata/);
  assert.match(refusal.headers.get('cache-control'), /no-store/);
  assert.equal(state.reads.length, 0);
  const disabled = setup({ enabled: () => false });
  assert.equal((await disabled.handler(denied)).status, 503);
  assert.equal(disabled.state.authChecks, 0);
  const headers = { Authorization: 'Bearer synthetic-test-token', 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  for (const extra of [{ Origin: 'https://outside.example' }, { Origin: 'null' }, { Host: 'outside.example' }]) {
    assert.equal((await handler(new Request(endpoint, { method: 'POST', headers: { ...headers, ...extra }, body: '{}' }))).status, 403);
  }
  assert.equal((await handler(new Request('https://outside.example/api/insights-mcp', { method: 'POST', headers, body: '{}' }))).status, 403);
  for (const method of ['GET', 'DELETE', 'OPTIONS', 'PUT']) assert.equal((await handler(new Request(endpoint, { method, headers }))).status, 405);
  assert.equal((await handler(new Request(endpoint, { method: 'POST', headers, body: 'x'.repeat(65537) }))).status, 413);
  assert.equal(state.reads.length, 0);
});
test('reader failures never expose errors, secrets or dependency paths', async () => {
  await withClient(async client => {
    const result = await client.callTool({ name: 'get_insight_summary', arguments: {} });
    assert.equal(result.isError, true);
    assert.ok(!JSON.stringify(result).includes('SECRET-PRIVATE'));
    assert.match(JSON.stringify(result), /insights_unavailable/);
  }, { readReport: async () => { throw new Error('SECRET-PRIVATE /internal/path'); } });
});

test('all-history SDK reads preserve strict schemas, disabled examples and an undefined prior comparison', async () => {
  await withClient(async (client, state) => {
    const summary = payload(await client.callTool({ name: 'get_insight_summary', arguments: { days: 'all' } }));
    assert.deepEqual(summary.filters, { days: 'all', agentType: 'all' });
    assert.equal(summary.summary.eligibleMessages, 4);
    assert.equal(summary.summary.classifiedMessages, 3);
    assert.equal(summary.window.start, '2026-09-15T03:00:00.000Z');
    assert.equal(summary.summary.excludedAdminMessages, 1);
    const before = state.reads.length;
    const comparison = payload(await client.callTool({ name: 'compare_insight_periods', arguments: { days: 'all' } }));
    assert.equal(state.reads.length, before + 1, 'all history must never issue a fabricated previous-period read');
    assert.equal(comparison.previous, null);
    assert.deepEqual(comparison.changes, []);
    assert.match(comparison.comparisonNotice, /não tem período anterior/);
    assert.ok(comparison.current.topics.every(topic => topic.trendPercent === null));
    const examples = payload(await client.callTool({ name: 'get_topic_examples', arguments: { days: 'all' } }));
    assert.deepEqual(examples.examples, []);
    assert.equal(examples.availability, 'disabled_pending_review');
    const trend = payload(await client.callTool({ name: 'get_topic_trend', arguments: { days: 'all', topicId: 'feedback' } }));
    assert.equal(trend.trend[0].date, '2026-09-15');
    assert.equal(trend.trend.at(-1).date, '2026-10-15');
  });
});
