'use strict';
// Admin panel exports: file names/headers shared with the client, full-question export rules.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../insights/helpers.cjs');
const questions = load('questions');
const service = load('service');
const files = load('export-files');
const { handleQuestionsExport } = load('questions-export');

const SECRET = 'synthetic-pseudonym-secret-for-tests-only-0001';
const now = new Date('2026-10-20T15:00:00.000Z');
const row = (id, overrides = {}) => ({ id, userId: 'USER-UUID-1', chatId: 'CHAT-UUID-1', agentType: 'comunicacao', input: `Pergunta ${id}`,
  createdAt: new Date(now.getTime() - id * 3600_000).toISOString(), userLevel: 'user', status: 'pending', ...overrides });

test('export file names are deterministic, ASCII and shared by header and client link', () => {
  assert.equal(files.exportFileName({ kind: 'insights', mode: 'live', days: 30, agentType: 'all', format: 'json' }), 'insights-30dias.json');
  assert.equal(files.exportFileName({ kind: 'perguntas', mode: 'live', days: 'all', agentType: 'postagem', format: 'csv' }), 'perguntas-todo-historico-postagem.csv');
  assert.equal(files.exportFileName({ kind: 'insights', mode: 'demo', days: 7, agentType: 'all', format: 'csv' }), 'insights-demonstracao-7dias.csv');
  assert.equal(files.attachmentHeader('insights-30dias.json'), 'attachment; filename="insights-30dias.json"');
  assert.equal(files.attachmentHeader('a"b\r\n.json'), 'attachment; filename="a_b__.json"');
  assert.match(files.EXPORT_CONTENT_TYPES.json, /^application\/json/);
});

function chain(resolve) {
  const state = { filters: [] };
  const q = new Proxy({}, { get(_t, prop) {
    if (prop === 'then') return (ok, ko) => Promise.resolve(resolve(state)).then(ok, ko);
    if (prop === 'maybeSingle') return async () => resolve({ ...state, single: true });
    return (...args) => { state.filters.push([prop, ...args]); return q; };
  } });
  return q;
}
async function withRows(rows, users, run) {
  const selects = [];
  const fake = { versions: { taxonomyVersion: 'x', classifierVersion: 'y' }, historyStart: async () => new Date('2025-06-09T12:00:00Z'),
    load: async () => ({ rows, lastProcessedAt: null }),
    client: { from(table) { return chain(state => { selects.push([table, state.filters]); return table === 'users' ? { data: users, error: null } : { data: [], error: null }; }); } } };
  const original = service.openLiveInsightSource;
  service.openLiveInsightSource = async () => fake;
  try { await run(selects); } finally { service.openLiveInsightSource = original; }
}

test('live export returns every matching question with FULL text, excluding admins, unknown roles and promoted users', async () => {
  const long = 'z'.repeat(questions.QUESTION_PREVIEW_CHARS + 900);
  const rows = [row(1, { input: long }), row(2, { userId: 'ADMIN', chatId: 'CHAT-ADMIN', userLevel: 'admin', input: 'ADMIN-PRIVATE' }),
    row(3, { userLevel: null, userId: 'UNKNOWN', input: 'UNKNOWN-PRIVATE' }), row(4, { userId: 'PROMOTED', chatId: 'CHAT-P', input: 'PROMOTED-PRIVATE' }),
    row(5, { agentType: 'postagem', chatId: 'CHAT-UUID-2' }), ...Array.from({ length: 80 }, (_, i) => row(10 + i, { chatId: `CHAT-${i % 9}` }))];
  await withRows(rows, [{ id: 'USER-UUID-1', nivel: 'user', cargo: ' Gerente ' }, { id: 'PROMOTED', nivel: 'admin', cargo: null }], async selects => {
    const data = await questions.exportLiveStudentQuestions({ days: 30, agentType: 'all' }, now, SECRET);
    assert.equal(data.questions.length, 82, 'not limited to one MCP page');
    assert.equal(data.questions[0].text, long);
    assert.equal(data.questions[0].truncated, false);
    assert.equal(data.questions[0].studentRole, 'Gerente');
    assert.equal(data.totals.excludedAdminMessages, 1);
    const text = JSON.stringify(data);
    for (const forbidden of ['USER-UUID-1', 'CHAT-UUID-1', 'ADMIN-PRIVATE', 'UNKNOWN-PRIVATE', 'PROMOTED-PRIVATE', '"email"', '"telefone"', '"nome"']) assert.ok(!text.includes(forbidden), forbidden);
    assert.equal(selects.find(([table]) => table === 'users')[1].find(([op]) => op === 'select')[1], 'id,nivel,cargo');
    const filtered = await questions.exportLiveStudentQuestions({ days: 30, agentType: 'postagem' }, now, SECRET);
    assert.deepEqual(filtered.questions.map(q => q.questionId), [5]);
    const csv = questions.questionsToCsv(data, service.csvCell);
    assert.ok(csv.startsWith('﻿"question_id"'));
    assert.equal(csv.split('\r\n').filter(Boolean).length, 83);
  });
});

test('CSV neutralizes spreadsheet formulas and keeps quotes/newlines inside one cell', async () => {
  await withRows([row(1, { input: '=HYPERLINK("x")\nsegunda linha' })], [{ id: 'USER-UUID-1', nivel: 'user', cargo: '@cargo' }], async () => {
    const csv = questions.questionsToCsv(await questions.exportLiveStudentQuestions({ days: 30, agentType: 'all' }, now, SECRET), service.csvCell);
    assert.ok(csv.includes(`"'=HYPERLINK(""x"")\nsegunda linha"`));
    assert.ok(csv.includes(`"'@cargo"`));
  });
});

test('export handler: admin check first, gate, format, size limit and download headers', async () => {
  const sample = { mode: 'live', generatedAt: now.toISOString(), window: {}, filters: {}, totals: {}, dataNotice: 'x', questions: [] };
  const calls = [];
  const deps = (overrides = {}) => ({ authorize: async () => { calls.push('auth'); }, enabled: () => true, pseudonymSecret: () => SECRET,
    exporter: async (filters) => { calls.push(['export', filters]); return sample; }, now: () => now, ...overrides });
  const request = query => new Request(`https://app.example/api/insights/questions-export?${query}`);
  const { InsightsError } = load('config');

  const denied = await handleQuestionsExport(request('days=30'), deps({ authorize: async () => { throw new InsightsError(403, 'forbidden', 'x'); }, enabled: () => { throw new Error('must not be reached'); } }));
  assert.equal(denied.status, 403);
  const disabled = await handleQuestionsExport(request('days=30'), deps({ enabled: () => false }));
  assert.equal(disabled.status, 503);
  assert.equal((await disabled.json()).code, 'questions_export_disabled');
  const noSecret = await handleQuestionsExport(request('days=30'), deps({ pseudonymSecret: () => { throw new Error('mcp disabled'); } }));
  assert.equal(noSecret.status, 503);
  assert.equal((await handleQuestionsExport(request('days=30&format=xml'), deps())).status, 400);
  assert.equal((await handleQuestionsExport(request('days=30&email=x'), deps())).status, 400);

  const csv = await handleQuestionsExport(request('days=all&agentType=postagem&format=csv'), deps());
  assert.equal(csv.status, 200);
  assert.equal(csv.headers.get('content-type'), 'text/csv; charset=utf-8');
  assert.equal(csv.headers.get('content-disposition'), 'attachment; filename="perguntas-todo-historico-postagem.csv"');
  assert.match(csv.headers.get('cache-control'), /no-store/);
  assert.deepEqual(calls.at(-1), ['export', { days: 'all', agentType: 'postagem' }]);
  const json = await handleQuestionsExport(request('days=30&format=json'), deps());
  assert.equal(json.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(json.headers.get('content-disposition'), 'attachment; filename="perguntas-30dias.json"');
  assert.deepEqual(JSON.parse(await json.text()), sample);

  const huge = { ...sample, questions: [{ text: 'x'.repeat(questions.QUESTION_EXPORT_MAX_BYTES) }] };
  const tooLarge = await handleQuestionsExport(request('days=all&format=json'), deps({ exporter: async () => huge }));
  assert.equal(tooLarge.status, 413);
  assert.equal((await tooLarge.json()).code, 'export_too_large');
  const failure = await handleQuestionsExport(request('days=30'), deps({ exporter: async () => { throw new Error('SECRET-INTERNAL'); } }));
  assert.equal(failure.status, 503);
  assert.ok(!(await failure.text()).includes('SECRET-INTERNAL'));
});
