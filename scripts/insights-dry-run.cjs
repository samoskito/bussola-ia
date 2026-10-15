// Synthetic, in-memory smoke run. No .env loading, Supabase client, or HTTP calls.
process.env.INSIGHTS_OPENAI_ENABLED = 'false';
delete process.env.OPENAI_API_KEY;
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

require.extensions['.ts'] = function loadTypeScript(mod, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText;
  mod._compile(compiled, filename);
};
const originalLoad = Module._load;
Module._load = function mockServerOnly(request, parent, isMain) {
  if (request === 'server-only') return {};
  return originalLoad.call(this, request, parent, isMain);
};

const { createMockClassifier } = require('../src/lib/insights/classifier.ts');
const { createInMemoryInsightRepository, processInsightBatch } = require('../src/lib/insights/processor.ts');
const { prepareInsightInput } = require('../src/lib/insights/privacy.ts');

const sources = [
  { id: 1, userId: 'synthetic-user-1', chatId: 'synthetic-chat-1', agentType: 'comunicacao', input: 'Preciso de uma comunicação clara para equipe.', createdAt: '2026-10-13T10:00:00Z', userLevel: 'user' },
  { id: 2, userId: 'synthetic-user-1', chatId: 'synthetic-chat-1', agentType: 'comunicacao', input: 'Também inclua o prazo no aviso.', createdAt: '2026-10-13T10:05:00Z', userLevel: 'user' },
  { id: 4, userId: 'synthetic-user-2', chatId: 'synthetic-chat-3', agentType: 'postagem', input: 'Quero posicionamento no LinkedIn.', createdAt: '2026-10-13T10:10:00Z', userLevel: 'user' },
  { id: 3, userId: 'synthetic-admin', chatId: 'synthetic-chat-2', agentType: 'postagem', input: 'Mensagem administrativa sintética.', createdAt: '2026-10-13T11:00:00Z', userLevel: 'admin' },
];

(async () => {
  const repository = createInMemoryInsightRepository(sources);
  const classifier = createMockClassifier();
  const first = await processInsightBatch({ repository, classifier, maxMessages: 2 });
  const second = await processInsightBatch({ repository, classifier, maxMessages: 2 });
  const third = await processInsightBatch({ repository, classifier, maxMessages: 2 });
  const completed = await repository.listCompleted();
  const jobs = await repository.listJobs();
  const leaseRepo = createInMemoryInsightRepository(sources.slice(0, 1));
  let tick = Date.parse('2026-10-14T12:00:00Z');
  const clock = () => new Date(tick);
  const slow = { ...classifier, async classify(input) { tick += 61_000; return classifier.classify(input); } };
  const leaseExpired = await processInsightBatch({ repository: leaseRepo, classifier: slow, maxMessages: 1, clock });
  const retried = await processInsightBatch({ repository: leaseRepo, classifier, maxMessages: 1, clock });
  const older = { ...sources[0], id: 5, createdAt: '2026-10-01T10:00:00Z' };
  const agedContext = prepareInsightInput(sources[1], [older], 'test-taxonomy', classifier.version);
  const replayRepo = createInMemoryInsightRepository(sources.slice(0, 1));
  const firstVersion = await processInsightBatch({ repository: replayRepo, classifier, maxMessages: 1 });
  replayRepo.upsertSource({ ...sources[0], input: 'Preciso de feedback para equipe.' });
  const changedVersion = await processInsightBatch({ repository: replayRepo, classifier, maxMessages: 1 });
  replayRepo.upsertSource(sources[0]);
  const restoredVersion = await processInsightBatch({ repository: replayRepo, classifier, maxMessages: 1 });
  replayRepo.upsertSource({ ...sources[0], agentType: 'apresentacao', createdAt: '2026-10-13T10:01:00Z' });
  const changedMetadata = await processInsightBatch({ repository: replayRepo, classifier, maxMessages: 1 });
  if (first.completed !== 2 || !first.hasMore || first.remainingUninspected !== 2 ||
      first.excluded + second.excluded !== 1 || second.completed !== 1 || second.skipped !== 2 ||
      third.completed !== 0 || third.skipped !== 3 || completed.length !== 3 ||
      jobs.some(job => job.userId === 'synthetic-admin') || leaseExpired.pending !== 1 || retried.completed !== 1 ||
      agedContext.context.length !== 0 || firstVersion.completed !== 1 || changedVersion.completed !== 1 ||
      restoredVersion.completed !== 1 || changedMetadata.completed !== 1) {
    throw new Error('dry_run_invariant_failed');
  }
  console.log(JSON.stringify({ mode: 'synthetic_in_memory', classifier: classifier.provider,
    first: { completed: first.completed, excluded: first.excluded },
    second: { completed: second.completed, skipped: second.skipped, excluded: second.excluded },
    stored: completed.length, leaseRetry: retried.completed, restoredSourceReprocessed: restoredVersion.completed,
    externalCalls: 0 }));
})().catch(error => {
  console.error(error instanceof Error ? error.message : 'dry_run_failed');
  process.exitCode = 1;
});
