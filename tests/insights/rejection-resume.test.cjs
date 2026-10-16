const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, source } = require('./helpers.cjs');
const { createInMemoryInsightRepository, processInsightBatch } = load('processor');
const { createMockClassifier } = load('classifier');
const { createSupabaseInsightRepository } = load('supabase-repository');
const now = new Date('2026-10-15T21:00:00.000Z');

test('resumed invalid sources always recheck roles/preparation but never rewrite 264 identical rejection pairs', async () => {
  const rows = Array.from({ length: 264 }, (_, index) => source({ id: index + 1, userId: `user-${index + 1}`,
    chatId: `chat-${index + 1}`, input: 'x'.repeat(6001) }));
  const repository = createInMemoryInsightRepository(rows);
  const originalReject = repository.recordRejected, originalRole = repository.currentUserLevel, originalRemove = repository.removeDerivedByUser;
  let writes = 0, reads = 0, removals = 0, calls = 0;
  repository.recordRejected = async (...args) => { writes++; return originalReject(...args); };
  repository.currentUserLevel = async (...args) => { reads++; return originalRole(...args); };
  repository.removeDerivedByUser = async (...args) => { removals++; return originalRemove(...args); };
  const mock = createMockClassifier();
  const classifier = { ...mock, async classify(...args) { calls++; return mock.classify(...args); } };
  const options = { repository, classifier, now, maxMessages: 10 };
  const first = await processInsightBatch(options);
  assert.equal(first.failed, 264); assert.equal(writes, 264); assert.equal(calls, 0);
  reads = 0;
  const resumed = await processInsightBatch(options);
  assert.equal(resumed.failed, 264); assert.equal(writes, 264);
  assert.equal(reads, 264, 'known rejection pairs still require current role checks');
  assert.equal(calls, 0);
  repository.upsertSource({ ...rows[0], input: 'Como preparar feedback?' });
  const corrected = await processInsightBatch(options);
  assert.equal(corrected.completed, 1); assert.equal(corrected.failed, 263);
  assert.equal(writes, 264); assert.equal(calls, 1);
  assert.ok((await repository.listCompleted()).some(row => row.sourceId === 1), 'a corrected input must not remain hidden by its historical rejection');
  repository.upsertSource({ ...rows[1], userId: 'new-owner', chatId: 'new-owner-chat' });
  await processInsightBatch(options);
  assert.equal(writes, 265, 'an ownership change is a different rejection pair and must be persisted');
  assert.equal((await repository.listJobs()).find(job => job.key === 'rejected:2').userId, 'new-owner');
  repository.setCurrentUserLevel(rows[2].userId, 'admin');
  const promoted = await processInsightBatch(options);
  assert.equal(promoted.excluded, 1); assert.equal(removals, 1);
  assert.equal(writes, 265); assert.equal(calls, 1);
  assert.ok(!(await repository.listJobs()).some(job => job.sourceId === 3));
});

test('a corrected context is prepared again and non-input rejection metadata cannot suppress a new record', async () => {
  const context = source({ id: 1, input: 'x'.repeat(2001), createdAt: '2026-10-14T11:00:00.000Z' });
  const target = source({ id: 2, createdAt: '2026-10-14T12:00:00.000Z' });
  const repository = createInMemoryInsightRepository([context, target]);
  const originalReject = repository.recordRejected;
  let writes = 0;
  repository.recordRejected = async (...args) => { writes++; return originalReject(...args); };
  const classifier = createMockClassifier();
  const options = { repository, classifier, now, sourceIds: [2] };
  assert.equal((await processInsightBatch(options)).failed, 1);
  assert.equal(writes, 1);
  assert.equal((await processInsightBatch(options)).failed, 1);
  assert.equal(writes, 1);
  await originalReject(target, 'classification_failed');
  await processInsightBatch(options);
  assert.equal(writes, 2, 'only failed/input_rejected metadata qualifies for the shortcut');
  repository.upsertSource({ ...context, input: 'Contexto válido e curto.' });
  assert.equal((await processInsightBatch(options)).completed, 1);
  assert.equal(writes, 2);
});

test('rejection snapshot is optional for existing repository adapters', async () => {
  const repository = createInMemoryInsightRepository([source({ input: 'x'.repeat(6001) })]);
  delete repository.listRejectedSources;
  let writes = 0;
  const record = repository.recordRejected;
  repository.recordRejected = async (...args) => { writes++; return record(...args); };
  const options = { repository, classifier: createMockClassifier(), now };
  await processInsightBatch(options); await processInsightBatch(options);
  assert.equal(writes, 2);
});

test('live rejection snapshot paginates safe pairs without excluding jobs created after the backfill end', async () => {
  const rows = Array.from({ length: 501 }, (_, index) => ({ script_id: 100001 + index, user_id: `user-${index}`,
    job_key: `rejected:${100001 + index}`, created_at: '2026-10-15T20:00:00.000Z' }));
  const queries = [];
  const client = { from(table) {
    assert.equal(table, 'insight_jobs');
    const query = { after: undefined, fields: undefined, filters: [] }; queries.push(query);
    return { select(fields) { query.fields = fields; return this; },
      eq(key, value) { query.filters.push([key, value]); return this; },
      like(key, value) { assert.deepEqual([key, value], ['job_key', 'rejected:%']); return this; },
      order(key) { assert.equal(key, 'job_key'); return this; },
      gt(key, value) { assert.equal(key, 'job_key'); query.after = value; return this; },
      gte() { throw new Error('A rejection snapshot must not filter job creation dates'); },
      lt() { throw new Error('A rejection snapshot must not filter job creation dates'); },
      limit(count) { assert.equal(count, 500); return this; },
      then(resolve, reject) { return Promise.resolve({ data: rows.filter(row => !query.after || row.job_key > query.after).slice(0, 500), error: null }).then(resolve, reject); },
    };
  } };
  const repository = createSupabaseInsightRepository(client, { env: { INSIGHTS_MODE: 'live' }, now,
    windowStart: new Date('2026-09-01T00:00:00.000Z'), windowEnd: new Date('2026-09-30T00:00:00.000Z') });
  const snapshot = await repository.listRejectedSources();
  assert.equal(snapshot.length, 501);
  assert.deepEqual(snapshot[0], { sourceId: 100001, userId: 'user-0' });
  assert.equal(queries.length, 2);
  for (const query of queries) {
    assert.equal(query.fields, 'script_id,user_id,job_key');
    assert.deepEqual(query.filters, [['status', 'failed'], ['error_code', 'input_rejected']]);
  }
});
