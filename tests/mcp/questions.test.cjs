'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../insights/helpers.cjs');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { createInsightsMcpHandler } = require('../../src/lib/insights-mcp/protocol.ts');
const { buildInsightReport } = require('../../src/lib/insights/report.ts');
const questions = load('questions');
const service = load('service');
const privacy = load('privacy');
const { TAXONOMY_VERSION } = load('taxonomy');

const SECRET = 'synthetic-pseudonym-secret-for-tests-only-0001';
const now = new Date('2026-10-20T15:00:00.000Z');
const classified = (topicIds = ['feedback']) => ({ kind: 'initial_request', topicIds, normalizedDemand: 'Resumo derivado.', confidence: .9, needsReview: false });
const row = (id, overrides = {}) => ({ id, userId: 'USER-UUID-1', chatId: 'CHAT-UUID-1', agentType: 'comunicacao', input: `Pergunta ${id}`,
  createdAt: new Date(now.getTime() - id * 3600_000).toISOString(), userLevel: 'user', status: 'pending', ...overrides });
const query = (overrides = {}) => ({ days: 30, agentType: 'all', onlyInitial: false, status: 'all', limit: 20, ...overrides });

test('pseudonyms are stable, prefixed, secret-bound and never the raw identifier', () => {
  const a = questions.createPseudonymizer(SECRET), b = questions.createPseudonymizer(SECRET), c = questions.createPseudonymizer(SECRET + 'x');
  assert.equal(a.person('USER-UUID-1'), b.person('USER-UUID-1'));
  assert.match(a.person('USER-UUID-1'), /^p_[a-f0-9]{16}$/);
  assert.match(a.conversation('CHAT-UUID-1'), /^c_[a-f0-9]{16}$/);
  assert.notEqual(a.person('USER-UUID-1'), c.person('USER-UUID-1'));
  assert.notEqual(a.person('X').slice(2), a.conversation('X').slice(2), 'person and conversation domains are separated');
  assert.throws(() => questions.createPseudonymizer('short'));
});

test('range: days windows, inclusive BRT explicit dates, future/inverted rejected', () => {
  const r30 = questions.resolveQuestionRange({ days: 30 }, now);
  assert.equal(r30.start.toISOString(), '2026-09-21T03:00:00.000Z');
  assert.equal(r30.loadStart.getTime(), r30.start.getTime() - 3 * 86400000);
  const explicit = questions.resolveQuestionRange({ days: 30, startDate: '2026-10-01', endDate: '2026-10-05' }, now);
  assert.equal(explicit.start.toISOString(), '2026-10-01T03:00:00.000Z');
  assert.equal(explicit.end.toISOString(), '2026-10-06T02:59:59.999Z');
  assert.equal(questions.resolveQuestionRange({ days: 30, startDate: '2026-10-19', endDate: '2026-12-31' }, now).end.toISOString(), now.toISOString());
  assert.equal(questions.resolveQuestionRange({ days: 30, endDate: '2026-10-05' }, now, new Date('2025-06-09T12:00:00Z')).start.toISOString(), '2025-06-09T03:00:00.000Z');
  for (const bad of [{ startDate: '2026-10-05', endDate: '2026-10-01' }, { startDate: '2026-11-01' }, { startDate: '2026-02-30' }, { startDate: '2026-1-01' }])
    assert.throws(() => questions.resolveQuestionRange({ days: 30, ...bad }, now), error => error.code === 'invalid_range');
});

test('selection excludes admins/unknown roles, filters, orders newest first and paginates with a filter-bound cursor', () => {
  const rows = [row(1, { status: 'classified', classification: classified() }), row(2, { userLevel: 'admin', input: 'ADMIN' }), row(3, { userLevel: null }),
    row(4, { agentType: 'postagem' }), row(5, { status: 'failed' }), row(6, { status: 'classified', classification: classified(['resultados']) }),
    row(7, { chatId: 'CHAT-UUID-2' }), row(8, { input: '   ' }), row(24 * 40, { input: 'fora do período' })];
  const range = questions.resolveQuestionRange({ days: 30 }, now);
  const initial = r => r.id === 7;
  let s = questions.selectStudentQuestions(rows, query(), range, initial);
  assert.deepEqual(s.page.map(r => r.id), [1, 4, 5, 6, 7]);
  assert.equal(s.excludedAdminMessages, 1);
  assert.equal(s.distinctConversations, 2);
  assert.deepEqual(questions.selectStudentQuestions(rows, query({ agentType: 'postagem' }), range, initial).page.map(r => r.id), [4]);
  assert.deepEqual(questions.selectStudentQuestions(rows, query({ topicId: 'feedback' }), range, initial).page.map(r => r.id), [1]);
  assert.deepEqual(questions.selectStudentQuestions(rows, query({ status: 'rejected' }), range, initial).page.map(r => r.id), [5]);
  assert.deepEqual(questions.selectStudentQuestions(rows, query({ status: 'pending' }), range, initial).page.map(r => r.id), [4, 7]);
  assert.deepEqual(questions.selectStudentQuestions(rows, query({ onlyInitial: true }), range, initial).page.map(r => r.id), [7]);
  const first = questions.selectStudentQuestions(rows, query({ limit: 2 }), range, initial);
  assert.deepEqual(first.page.map(r => r.id), [1, 4]);
  const second = questions.selectStudentQuestions(rows, query({ limit: 2, cursor: first.nextCursor }), range, initial);
  assert.deepEqual(second.page.map(r => r.id), [5, 6]);
  const third = questions.selectStudentQuestions(rows, query({ limit: 2, cursor: second.nextCursor }), range, initial);
  assert.deepEqual(third.page.map(r => r.id), [7]);
  assert.equal(third.nextCursor, null);
  for (const cursor of ['garbage', Buffer.from('{"v":1}').toString('base64url')])
    assert.throws(() => questions.selectStudentQuestions(rows, query({ cursor }), range, initial), e => e.code === 'invalid_cursor');
  assert.throws(() => questions.selectStudentQuestions(rows, query({ limit: 2, agentType: 'postagem', cursor: first.nextCursor }), range, initial), e => e.code === 'invalid_cursor');
});

test('page size is bounded by a character budget and long texts are truncated in projection', () => {
  const long = 'x'.repeat(questions.QUESTION_PREVIEW_CHARS + 500);
  const rows = Array.from({ length: 30 }, (_, i) => row(i + 1, { input: long }));
  const s = questions.selectStudentQuestions(rows, query({ limit: 50 }), questions.resolveQuestionRange({ days: 30 }, now), () => false);
  assert.equal(s.page.length, Math.floor(questions.QUESTION_PAGE_CHAR_BUDGET / questions.QUESTION_PREVIEW_CHARS));
  assert.ok(s.nextCursor);
  const item = questions.projectStudentQuestion(s.page[0], { initial: false, role: null, pseudonyms: questions.createPseudonymizer(SECRET),
    text: long.slice(0, questions.QUESTION_PREVIEW_CHARS), truncated: true });
  assert.equal(item.textLength, long.length);
  assert.equal(item.truncated, true);
  assert.equal(item.createdAtLocal.length, 19);
  assert.equal(questions.normalizeRole('  Gerente   de  Vendas '), 'Gerente de Vendas');
  assert.equal(questions.normalizeRole(''), null);
  assert.equal(questions.normalizeRole(42), null);
  assert.equal(questions.normalizeRole('a'.repeat(300)).length, 120);
});

// ---------- Live adapters over a mocked service-role client ----------
function chain(resolve) {
  const state = { filters: [] };
  const q = new Proxy({}, { get(_t, prop) {
    if (prop === 'then') return (ok, ko) => Promise.resolve(resolve(state)).then(ok, ko);
    if (prop === 'maybeSingle') return async () => resolve({ ...state, single: true });
    return (...args) => { state.filters.push([prop, ...args]); return q; };
  } });
  return q;
}
function fakeSource(tables, rows = [], historyStart = new Date('2025-06-09T12:00:00Z')) {
  const selects = [];
  return { selects, source: {
    versions: { taxonomyVersion: TAXONOMY_VERSION, classifierVersion: 'model.v1' },
    historyStart: async () => historyStart,
    load: async () => ({ rows, lastProcessedAt: null }),
    client: { from(table) { return chain(state => { selects.push([table, state.filters]); return tables[table](state); }); } },
  } };
}
async function withSource(fake, run) {
  const original = service.openLiveInsightSource;
  service.openLiveInsightSource = async () => fake.source;
  try { await run(); } finally { service.openLiveInsightSource = original; }
}

test('live list re-reads current role, reads cargo only, resolves earlier chat history and never returns direct identifiers', async () => {
  const rows = [row(1, { input: 'Como dar feedback ao meu gerente? meu email é aluno@exemplo.com', status: 'classified', classification: classified() }),
    row(2, { userId: 'USER-UUID-2', chatId: 'CHAT-UUID-2' }), row(3, { userId: 'PROMOTED', chatId: 'CHAT-UUID-3' }),
    row(4, { chatId: 'CHAT-OLD' }), row(5, { userLevel: 'admin', userId: 'ADMIN', chatId: 'CHAT-ADMIN', input: 'ADMIN-PRIVATE' })];
  const fake = fakeSource({
    users: () => ({ data: [{ id: 'USER-UUID-1', nivel: 'user', cargo: ' Coordenadora  de RH ' }, { id: 'USER-UUID-2', nivel: 'user', cargo: null }, { id: 'PROMOTED', nivel: 'admin', cargo: 'x' }], error: null }),
    scripts: () => ({ data: [{ chatid: 'CHAT-OLD' }], error: null }),
  }, rows);
  await withSource(fake, async () => {
    const page = await questions.listLiveStudentQuestions(query(), now, SECRET);
    assert.deepEqual(page.questions.map(q => q.questionId), [1, 2, 4]);
    assert.equal(page.questions[0].studentRole, 'Coordenadora de RH');
    assert.equal(page.questions[1].studentRole, null);
    assert.equal(page.questions[0].text, rows[0].input, 'full text is not masked by product decision');
    assert.equal(page.questions[0].position, 'initial');
    assert.equal(page.questions.find(q => q.questionId === 4).position, 'follow_up', 'chat with messages before the loaded window is not initial');
    assert.deepEqual(page.questions[0].topics, [{ id: 'feedback', label: 'Feedback' }]);
    assert.equal(page.totals.excludedAdminMessages, 1);
    const text = JSON.stringify(page);
    for (const forbidden of ['USER-UUID-1', 'CHAT-UUID-1', 'ADMIN-PRIVATE', 'PROMOTED', '"nome"', '"email"', '"telefone"']) assert.ok(!text.includes(forbidden), forbidden);
    const userSelect = fake.selects.find(([table]) => table === 'users')[1].find(([op]) => op === 'select')[1];
    assert.equal(userSelect, 'id,nivel,cargo');
  });
});

test('live single read returns the full text in chunks, derived status and hides admin or missing questions', async () => {
  const userId = 'USER-UUID-1', chatId = 'CHAT-UUID-1';
  const dbRow = (id, input, createdAt) => ({ id, user_id: userId, chatid: chatId, input, created_at: createdAt, users: { nivel: 'user' }, chats: { agent_type: 'apresentacao', user_id: userId } });
  const text = 'y'.repeat(questions.QUESTION_FULL_CHUNK_CHARS + 10);
  const first = dbRow(10, 'Primeira pergunta', '2026-10-19T12:00:00.000Z'), target = dbRow(11, text, '2026-10-19T13:00:00.000Z');
  let level = 'user';
  const fake = fakeSource({
    scripts: state => state.single ? { data: state.filters.some(([op, col, v]) => op === 'eq' && col === 'id' && v === 999) ? null : target, error: null } : { data: [first, target], error: null },
    users: () => ({ data: [{ id: userId, nivel: level, cargo: 'Diretor' }], error: null }),
    script_insights: () => ({ data: null, error: null }),
    insight_jobs: () => ({ data: [{ job_key: 'rejected:11', status: 'failed' }], error: null }),
  });
  await withSource(fake, async () => {
    const one = await questions.getLiveStudentQuestion({ questionId: 11, offset: 0 }, now, SECRET);
    assert.equal(one.question.text.length, questions.QUESTION_FULL_CHUNK_CHARS);
    assert.equal(one.question.truncated, true);
    assert.equal(one.nextOffset, questions.QUESTION_FULL_CHUNK_CHARS);
    assert.equal(one.question.status, 'rejected', 'texts above the classifier limit report the recorded rejection');
    assert.equal(one.question.position, 'follow_up');
    assert.equal(one.question.studentRole, 'Diretor');
    const rest = await questions.getLiveStudentQuestion({ questionId: 11, offset: one.nextOffset }, now, SECRET);
    assert.equal(rest.question.text.length, 10);
    assert.equal(rest.nextOffset, null);
    await assert.rejects(questions.getLiveStudentQuestion({ questionId: 11, offset: text.length + 5 }, now, SECRET), e => e.code === 'invalid_offset');
    await assert.rejects(questions.getLiveStudentQuestion({ questionId: 999, offset: 0 }, now, SECRET), e => e.code === 'question_not_found');
    level = 'admin';
    await assert.rejects(questions.getLiveStudentQuestion({ questionId: 11, offset: 0 }, now, SECRET), e => e.code === 'question_not_found');
  });
});

// ---------- MCP tools over the stateless SDK transport ----------
async function withClient(run, overrides = {}) {
  const reads = [];
  const handler = createInsightsMcpHandler({ enabled: () => true, canonicalOrigin: () => 'https://insights.example', now: () => now,
    authenticate: async request => { if (request.headers.get('authorization') !== 'Bearer synthetic') throw new Error('denied'); },
    authError: () => Response.json({ error: 'invalid_token' }, { status: 401 }),
    readReport: async (filters, clock) => buildInsightReport(filters, clock, [], { mode: 'live', processing: { provider: 'openai', state: 'ready', scheduleLabel: 'x', lastProcessedAt: null } }),
    questionsEnabled: () => true,
    questions: {
      list: async (q, clock) => { reads.push(['list', q]); return questions.listLiveStudentQuestions(q, clock, SECRET); },
      get: async (input, clock) => { reads.push(['get', input]); return questions.getLiveStudentQuestion(input, clock, SECRET); },
    }, ...overrides });
  const client = new Client({ name: 'questions-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL('https://insights.example/api/insights-mcp'), {
    requestInit: { headers: { Authorization: 'Bearer synthetic' } }, fetch: (url, init) => handler(new Request(url, init)) });
  try { await client.connect(transport); await run(client, reads); } finally { await client.close(); }
}

test('SDK: question tools are read-only, strict, validated before reading and schema-checked on output', async () => {
  const fake = fakeSource({ users: () => ({ data: [{ id: 'USER-UUID-1', nivel: 'user', cargo: null }], error: null }), scripts: () => ({ data: [], error: null }) },
    [row(1, { status: 'classified', classification: classified() })]);
  await withSource(fake, () => withClient(async (client, reads) => {
    const tools = (await client.listTools()).tools.filter(t => t.name.includes('student_question'));
    assert.equal(tools.length, 2);
    for (const tool of tools) { assert.equal(tool.annotations.readOnlyHint, true); assert.equal(tool.inputSchema.additionalProperties, false); }
    const result = await client.callTool({ name: 'list_student_questions', arguments: { days: 'all' } });
    assert.notEqual(result.isError, true, JSON.stringify(result));
    assert.equal(result.structuredContent.questions[0].text, 'Pergunta 1');
    assert.match(result.structuredContent.dataNotice, /não confiável/);
    for (const [name, args] of [['list_student_questions', { limit: 51 }], ['list_student_questions', { startDate: '01/10/2026' }], ['list_student_questions', { userId: 'x' }],
      ['list_student_questions', { email: 'x' }], ['get_student_question', {}], ['get_student_question', { questionId: -1 }], ['get_student_question', { questionId: 1.5 }]]) {
      try { const r = await client.callTool({ name, arguments: args }); assert.equal(r.isError, true); }
      catch (e) { assert.match(String(e), /invalid|argument|parameter|32602/i); }
    }
    assert.equal(reads.length, 1, 'invalid inputs never reach the reader');
  }));
});

test('SDK: disabled gate and reader failures return safe errors without data', async () => {
  await withClient(async (client, reads) => {
    const r = await client.callTool({ name: 'list_student_questions', arguments: {} });
    assert.equal(r.isError, true);
    assert.match(JSON.stringify(r), /student_questions_disabled/);
    assert.equal(reads.length, 0);
  }, { questionsEnabled: () => false });
  await withClient(async client => {
    const r = await client.callTool({ name: 'get_student_question', arguments: { questionId: 5 } });
    assert.equal(r.isError, true);
    assert.ok(!JSON.stringify(r).includes('SECRET-PATH'));
    assert.match(JSON.stringify(r), /insights_unavailable/);
  }, { questions: { list: async () => { throw new Error('SECRET-PATH'); }, get: async () => { throw new Error('SECRET-PATH'); } } });
  await withClient(async client => {
    const r = await client.callTool({ name: 'list_student_questions', arguments: {} });
    assert.equal(r.isError, true);
    assert.match(JSON.stringify(r), /student_questions_disabled/);
  }, { questions: undefined });
});

test('live single read reports a stored classification only when its source hash still matches', async () => {
  const userId = 'USER-UUID-1', chatId = 'CHAT-UUID-1', createdAt = '2026-10-19T13:00:00.000Z';
  const target = { id: 21, user_id: userId, chatid: chatId, input: 'Como abrir a reunião de resultados?', created_at: createdAt, users: { nivel: 'user' }, chats: { agent_type: 'apresentacao', user_id: userId } };
  const sourceHash = privacy.prepareInsightInput({ id: 21, userId, chatId, agentType: 'apresentacao', input: target.input, createdAt, userLevel: 'user' }, [], TAXONOMY_VERSION, 'model.v1').sourceHash;
  let storedHash = sourceHash;
  const fake = fakeSource({
    scripts: state => state.single ? { data: target, error: null } : { data: [target], error: null },
    users: () => ({ data: [{ id: userId, nivel: 'user', cargo: null }], error: null }),
    script_insights: () => ({ data: { script_id: 21, user_id: userId, chat_id: chatId, agent_type: 'apresentacao', source_created_at: createdAt, source_hash: storedHash,
      taxonomy_version: TAXONOMY_VERSION, classifier_version: 'model.v1', message_kind: 'question', topic_ids: ['resultados'], normalized_demand: 'Abrir reunião de resultados.',
      confidence: 0.8, needs_review: false, processed_at: '2026-10-20T06:00:00.000Z', users: { nivel: 'user' } }, error: null }),
    insight_jobs: () => ({ data: [], error: null }),
  });
  await withSource(fake, async () => {
    let one = await questions.getLiveStudentQuestion({ questionId: 21, offset: 0 }, now, SECRET);
    assert.equal(one.question.status, 'classified');
    assert.equal(one.question.position, 'initial');
    assert.deepEqual(one.question.topics, [{ id: 'resultados', label: 'Apresentação de resultados' }]);
    assert.equal(one.question.classificationSummary, 'Abrir reunião de resultados.');
    storedHash = 'f'.repeat(64);
    one = await questions.getLiveStudentQuestion({ questionId: 21, offset: 0 }, now, SECRET);
    assert.equal(one.question.status, 'pending', 'an edited source invalidates the stale classification');
    assert.deepEqual(one.question.topics, []);
  });
});
