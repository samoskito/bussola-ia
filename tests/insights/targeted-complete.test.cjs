const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, source } = require('./helpers.cjs');
const { createSupabaseInsightRepository } = load('supabase-repository');
const { prepareInsightInput } = load('privacy');
const { TAXONOMY_VERSION } = load('taxonomy');
const { CLASSIFIER_VERSION } = load('classifier');
const now = new Date('2026-10-15T21:00:00.000Z');
const version = `gpt-5.4-nano.${CLASSIFIER_VERSION}`;
const target = source({ id: 1000, createdAt: '2026-10-14T12:00:00.000400+00:00' });
const base = Array.from({ length: 610 }, (_, index) => source({ id: index + 1,
  createdAt: `2026-10-14T12:00:00.${index % 2 ? '000100' : '000900'}+00:00`,
  input: index === 0 ? 'x'.repeat(2001) : `Contexto ${index + 1}.` }));
base.push(target, source({ id: 1001, createdAt: target.createdAt, input: 'ID posterior não é contexto.' }),
  source({ id: 900, chatId: 'other-chat', input: 'Conversa diferente.' }),
  source({ id: 901, userId: 'other-user', chatId: 'other-owner-chat', input: 'Outra pessoa.' }),
  source({ id: 902, createdAt: '2026-10-11T11:59:59.999999+00:00', input: 'Mais de três dias antes.' }),
  source({ id: 903, createdAt: '2026-10-14T12:00:00.001000+00:00', input: 'Milissegundo posterior.' }));
const prepared = prepareInsightInput(target, base, TAXONOMY_VERSION, version);
assert.deepEqual(prepared.context.map(row => row.id), [608, 609, 610]);
const insight = { sourceId: target.id, userId: target.userId, chatId: target.chatId, agentType: target.agentType,
  createdAt: target.createdAt, sourceHash: prepared.sourceHash, taxonomyVersion: TAXONOMY_VERSION, classifierVersion: version,
  classification: { kind: 'question', topicIds: ['feedback'], normalizedDemand: 'Preparar feedback.', confidence: .9, needsReview: false },
  processedAt: now.toISOString(), usage: null };
const dbRow = item => ({ id: item.id, user_id: item.userId, chatid: item.chatId, input: item.input, created_at: item.createdAt,
  users: { nivel: item.userLevel }, chats: { user_id: item.userId, agent_type: item.agentType } });
function timestamp(value) {
  const fraction = value.match(/\.(\d+)(?:Z|[+-]\d\d:\d\d)$/)?.[1] ?? '';
  return BigInt(Date.parse(value)) * 1_000_000n + BigInt(fraction.slice(3).padEnd(6, '0') || '0');
}
function fixture(changes = () => {}, options = {}) {
  const rows = base.map(dbRow); changes(rows);
  const queries = [], completions = [];
  const client = { from(table) {
    assert.equal(table, 'scripts', 'completion must not fetch the full insight/job tables');
    const query = { filters: [], limit: undefined, cursor: undefined, single: false }; queries.push(query);
    const execute = () => {
      let selected = rows.filter(row => query.filters.every(([kind, key, value]) => kind === 'eq' ? row[key] === value :
        kind === 'gte' ? timestamp(row[key]) >= timestamp(value) : timestamp(row[key]) < timestamp(value)));
      if (query.cursor) {
        const match = query.cursor.match(/^created_at\.gt\.([^,]+),and\(created_at\.eq\.([^,]+),id\.gt\.(\d+)\)$/);
        assert.ok(match, 'cursor must preserve actual DB timestamp precision');
        selected = selected.filter(row => timestamp(row.created_at) > timestamp(match[1]) ||
          (timestamp(row.created_at) === timestamp(match[2]) && row.id > Number(match[3])));
      }
      selected.sort((a, b) => timestamp(a.created_at) < timestamp(b.created_at) ? -1 : timestamp(a.created_at) > timestamp(b.created_at) ? 1 : a.id - b.id);
      if (query.limit !== undefined) selected = selected.slice(0, query.limit);
      return { data: JSON.parse(JSON.stringify(query.single ? selected[0] ?? null : selected)), error: null };
    };
    return { select() { return this; }, eq(key, value) { query.filters.push(['eq', key, value]); return this; },
      gte(key, value) { query.filters.push(['gte', key, value]); return this; }, lt(key, value) { query.filters.push(['lt', key, value]); return this; },
      order() { return this; }, or(value) { query.cursor = value; return this; }, limit(value) { query.limit = value; return this; },
      async maybeSingle() { query.single = true; return execute(); },
      then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject); },
    };
  }, async rpc(name, args) { assert.equal(name, 'insights_complete_job'); completions.push(args); return { data: true, error: null }; } };
  const repository = createSupabaseInsightRepository(client, { env: { INSIGHTS_MODE: 'live', INSIGHTS_MODEL: 'gpt-5.4-nano' }, now,
    windowStart: new Date('2026-10-01T00:00:00.000Z'), windowEnd: now, ...options });
  return { rows, queries, completions, repository };
}
const complete = value => value.repository.complete(`${insight.sourceId}:${insight.sourceHash}`, 'synthetic-lock-token', insight);

test('fresh targeted completion matches full-scan hashes across >500 context rows and sub-ms timestamp/id ties', async () => {
  const value = fixture();
  assert.equal(await complete(value), true);
  assert.equal(value.completions.length, 1);
  assert.equal(value.queries.length, 3, 'one source lookup and two pages of this chat instead of twenty full-history pages');
  assert.deepEqual(value.queries[0].filters.slice(0, 1), [['eq', 'id', target.id]]);
  for (const query of value.queries.slice(1)) {
    assert.ok(query.filters.some(filter => JSON.stringify(filter) === JSON.stringify(['eq', 'user_id', target.userId])));
    assert.ok(query.filters.some(filter => JSON.stringify(filter) === JSON.stringify(['eq', 'chatid', target.chatId])));
    assert.ok(query.filters.some(filter => JSON.stringify(filter) === JSON.stringify(['gte', 'created_at', '2026-10-11T12:00:00.000Z'])));
    assert.ok(query.filters.some(filter => JSON.stringify(filter) === JSON.stringify(['lt', 'created_at', '2026-10-14T12:00:00.001Z'])));
    assert.equal(query.limit, 500);
  }
  assert.equal(value.completions[0].p_created_at, target.createdAt, 'CAS retains the original full-precision source timestamp');
});

test('targeted completion rejects edited/deleted/moved/promoted/unsupported sources before CAS', async () => {
  const edits = [
    rows => { rows.find(row => row.id === target.id).input = 'Fonte editada depois da classificação.'; },
    rows => { rows.splice(rows.findIndex(row => row.id === target.id), 1); },
    rows => { const row = rows.find(row => row.id === target.id); row.user_id = 'new-owner'; row.chats.user_id = 'new-owner'; },
    rows => { rows.find(row => row.id === target.id).chatid = 'moved-chat'; },
    rows => { rows.find(row => row.id === target.id).users.nivel = 'admin'; },
    rows => { rows.find(row => row.id === target.id).users.nivel = null; },
    rows => { rows.find(row => row.id === target.id).chats.agent_type = 'apresentacao'; },
    rows => { rows.find(row => row.id === target.id).chats.agent_type = null; },
    rows => { rows.find(row => row.id === target.id).chats.agent_type = 'unknown-agent'; },
    rows => { rows.find(row => row.id === target.id).created_at = '2026-10-14T12:00:00.001000+00:00'; },
    rows => { rows.find(row => row.id === target.id).created_at = '2026-09-01T12:00:00.000Z'; },
  ];
  for (const edit of edits) {
    const value = fixture(edit);
    assert.equal(await complete(value), false);
    assert.equal(value.completions.length, 0);
  }
  for (const edit of [rows => { rows.find(row => row.id === target.id).chats = null; },
    rows => { rows.find(row => row.id === target.id).chats.user_id = 'wrong-owner'; },
    rows => { rows.find(row => row.id === target.id).users = null; }]) {
    const value = fixture(edit);
    await assert.rejects(complete(value), /invalid_source_relationship/);
    assert.equal(value.completions.length, 0);
  }
});

test('targeted completion revalidates selected context edits/deletions/ownership/roles/agents/timestamps and additions', async () => {
  for (const edit of [
    rows => { rows.find(row => row.id === 609).input = 'Contexto editado.'; },
    rows => { rows.splice(rows.findIndex(row => row.id === 609), 1); },
    rows => { const row = rows.find(row => row.id === 609); row.user_id = 'new-owner'; row.chats.user_id = 'new-owner'; },
    rows => { rows.find(row => row.id === 609).users.nivel = 'admin'; },
    rows => { rows.find(row => row.id === 609).chats.agent_type = 'postagem'; },
    rows => { rows.find(row => row.id === 609).created_at = '2026-10-14T12:00:00.001Z'; },
    rows => { rows.find(row => row.id === 609).created_at = '2026-10-10T12:00:00.000Z'; },
    rows => { rows.find(row => row.id === 609).input = 'x'.repeat(2001); },
    rows => { rows.push(dbRow(source({ id: 999, createdAt: target.createdAt, input: 'Novo contexto relevante.' }))); },
  ]) {
    const value = fixture(edit);
    assert.equal(await complete(value), false);
    assert.equal(value.completions.length, 0);
  }
  const irrelevant = fixture(rows => { rows.find(row => row.id === 1).input = 'Outro texto antigo fora dos três selecionados.'; });
  assert.equal(await complete(irrelevant), true, 'an edit outside the three selected messages must not change the hash contract');
});

test('targeted context remains clipped to the same authorized canonical repository window', async () => {
  const value = fixture(() => {}, { windowStart: new Date('2026-10-14T12:00:00.000Z') });
  assert.equal(await complete(value), true);
  for (const query of value.queries.slice(1)) assert.ok(query.filters.some(filter =>
    JSON.stringify(filter) === JSON.stringify(['gte', 'created_at', '2026-10-14T12:00:00.000Z'])));
});
