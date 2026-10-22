const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fs, path, root, load } = require('./helpers.cjs');

const { handleHotmartRecovery, reprocessStuckHotmartEvents, verifyRecoveryAuthorization, HOTMART_RECOVERY } = load('recovery');
const SECRET = 'cron-secret-sintetico-0123456789';

function repo(ids = ['a', 'b']) {
  const calls = [];
  return { calls, repo: { pendingEvents: async (...args) => { calls.push(args); return ids; } } };
}

test('recuperação: inofensiva com integração desligada, exige segredo próprio em tempo constante', async () => {
  const r = repo();
  const off = await handleHotmartRecovery(null, { env: {}, repo: () => r.repo, process: async () => ({ status: 'applied' }) });
  assert.deepEqual([off.status, off.body.skipped, r.calls.length], [200, 'hotmart_off', 0]);
  const env = { HOTMART_WEBHOOK_MODE: 'live' };
  assert.equal((await handleHotmartRecovery(`Bearer ${SECRET}`, { env, repo: () => r.repo, process: async () => ({ status: 'x' }) })).status, 503, 'sem segredo configurado');
  assert.equal(verifyRecoveryAuthorization(`Bearer ${SECRET}`, { CRON_SECRET: 'curto' }), 'unconfigured', 'segredo fraco ignorado');
  for (const header of [null, 'Bearer errado', SECRET]) {
    assert.equal((await handleHotmartRecovery(header, { env: { ...env, CRON_SECRET: SECRET }, repo: () => r.repo, process: async () => ({ status: 'x' }) })).status, 401);
  }
  assert.equal(r.calls.length, 0);
  assert.equal(verifyRecoveryAuthorization(`Bearer ${SECRET}`, { HOTMART_REPROCESS_SECRET: SECRET }), 'ok');
  const ok = await handleHotmartRecovery(`Bearer ${SECRET}`, { env: { ...env, CRON_SECRET: SECRET }, repo: () => r.repo, process: async id => ({ status: `done:${id}` }) });
  assert.deepEqual(ok.body, { pending: 2, processed: 2, statuses: ['done:a', 'done:b'] });
  assert.deepEqual(r.calls[0], [HOTMART_RECOVERY.olderThanMinutes, HOTMART_RECOVERY.maxAttempts, HOTMART_RECOVERY.limit]);
});

test('recuperação respeita orçamento de tempo e isola falhas por evento', async () => {
  let clock = 0;
  const r = repo(['a', 'b', 'c']);
  const result = await reprocessStuckHotmartEvents({ repo: r.repo, now: () => clock, process: async id => { clock += 30000; if (id === 'a') throw new Error('x'); return { status: 'applied' }; } });
  assert.deepEqual(result.results.map(x => x.status), ['error', 'applied']);
  assert.equal(result.pending, 3);
});

test('cron agendado em vercel.json aponta para a rota protegida', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const cron = config.crons.find(item => item.path === '/api/hotmart/reprocess');
  assert.ok(cron);
  assert.match(cron.schedule, /^[0-9*/,\- ]+$/);
});
