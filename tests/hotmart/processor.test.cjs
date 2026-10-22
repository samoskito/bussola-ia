const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, USER, snapshot, context } = require('./helpers.cjs');

const { processHotmartEvent } = load('processor');
const { HotmartError } = load('config');

function fakeRepo({ ctx, commitResults = [], claim = { claimed: true } } = {}) {
  const calls = { commit: [], fail: [], invite: [], delivery: [], contexts: 0 };
  return {
    calls,
    repo: {
      claim: async () => claim,
      context: async () => { calls.contexts++; return typeof ctx === 'function' ? ctx(calls.contexts) : ctx; },
      commit: async (id, revision, plan) => {
        calls.commit.push({ id, revision, plan: JSON.parse(JSON.stringify(plan)) });
        const next = commitResults.shift();
        if (next instanceof Error) throw next;
        return next ?? { status: plan.outcome, userId: plan.userId ?? USER, invite: !!plan.invite };
      },
      fail: async (id, code) => calls.fail.push(code),
      issueInvite: async (userId, hash, expiresAt) => { calls.invite.push({ userId, hash }); return { id: 'inv-1', email: 'comprador@example.invalid', expiresAt }; },
      inviteDelivery: async (id, status) => calls.delivery.push(status),
    },
  };
}
const deps = (repo, extra = {}) => ({ repo, env: { HOTMART_GRACE_DAYS: '3' }, hashPassword: async () => '$2b$12$' + 'a'.repeat(53), ...extra });

test('live: comprador novo é criado com hash bcrypt desconhecido e recebe convite', async () => {
  const sent = [];
  const { repo, calls } = fakeRepo({ ctx: context(), commitResults: [{ status: 'applied', userId: USER, userCreated: true, invite: true }] });
  const result = await processHotmartEvent('row-1', deps(repo, { invite: { origin: () => 'https://app.example.invalid', send: async mail => sent.push(mail) } }));
  assert.equal(result.status, 'applied');
  assert.equal(result.invite, 'sent');
  assert.match(calls.commit[0].plan.createUser.passwordHash, /^\$2b\$12\$/);
  assert.equal(result.plan.createUser.passwordHash, undefined, 'hash não volta no resultado');
  assert.equal(calls.invite.length, 1);
  assert.match(calls.invite[0].hash, /^[0-9a-f]{64}$/);
  assert.match(sent[0].url, /^https:\/\/app\.example\.invalid\/auth\/first-access#token=[A-Za-z0-9_-]{43}$/);
  assert.ok(!sent[0].url.includes(calls.invite[0].hash), 'banco recebe só o hash');
  assert.deepEqual(calls.delivery, ['sent']);
});

test('shadow: o SQL não pede convite, então nenhum e-mail é enviado', async () => {
  const sent = [];
  const { repo, calls } = fakeRepo({ ctx: context({ event: { mode: 'shadow' } }), commitResults: [{ status: 'shadow_planned', userId: null, invite: false }] });
  const result = await processHotmartEvent('row-1', deps(repo, { invite: { origin: () => 'https://x.invalid', send: async mail => sent.push(mail) } }));
  assert.equal(result.status, 'shadow_planned');
  assert.equal(calls.commit[0].plan.createUser.email, 'comprador@example.invalid', 'o plano "o que faria" é registrado');
  assert.deepEqual([sent.length, calls.invite.length], [0, 0]);
});

test('conflito de revisão recalcula o plano sobre o estado novo; falha persistente marca evento', async () => {
  const conflict = new HotmartError(409, 'revision_conflict', 'mudou');
  const { repo, calls } = fakeRepo({ ctx: n => context({ emailUser: snapshot({ revision: `rev-${n}` }) }), commitResults: [conflict] });
  const result = await processHotmartEvent('row-1', deps(repo));
  assert.equal(result.status, 'applied');
  assert.deepEqual(calls.commit.map(c => c.revision), ['rev-1', 'rev-2']);
  const always = fakeRepo({ ctx: context({ emailUser: snapshot() }), commitResults: [conflict, conflict, conflict] });
  assert.equal((await processHotmartEvent('row-1', deps(always.repo))).status, 'failed');
  assert.deepEqual(always.calls.fail, ['revision_conflict']);
  const broken = fakeRepo({ ctx: context(), commitResults: [new Error('boom')] });
  assert.equal((await processHotmartEvent('row-1', deps(broken.repo))).status, 'failed');
  assert.deepEqual(broken.calls.fail, ['processing_error']);
});

test('evento já reservado por outro processador não é processado de novo', async () => {
  const { repo, calls } = fakeRepo({ ctx: context(), claim: { claimed: false, reason: 'status_applied' } });
  assert.equal((await processHotmartEvent('row-1', deps(repo))).status, 'skipped:status_applied');
  assert.equal(calls.commit.length, 0);
});

test('falha no envio do convite é registrada (gera revisão no SQL) sem desfazer o acesso', async () => {
  const { repo, calls } = fakeRepo({ ctx: context(), commitResults: [{ status: 'applied', userId: USER, invite: true }] });
  const result = await processHotmartEvent('row-1', deps(repo, { invite: { origin: () => 'https://x.invalid', send: async () => { throw new Error('smtp'); } } }));
  assert.deepEqual([result.status, result.invite, calls.delivery[0]], ['applied', 'failed', 'failed']);
  const noMail = fakeRepo({ ctx: context(), commitResults: [{ status: 'applied', userId: USER, invite: true }] });
  assert.equal((await processHotmartEvent('row-1', deps(noMail.repo, { invite: null }))).invite, 'skipped');
});
