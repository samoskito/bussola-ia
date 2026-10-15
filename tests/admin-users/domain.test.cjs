const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');

const { createDemoAdminUsersStore } = load('domain');
const ACTOR = 'synthetic-admin';
const AGENTS = ['comunicacao', 'apresentacao', 'conversas_dificeis', 'postagem'];

function clock() {
  let current = new Date('2026-10-15T12:00:00.000Z');
  return {
    now: () => current,
    advance(ms) { current = new Date(current.getTime() + ms); },
  };
}

function create(store, suffix, overrides = {}) {
  return store.create({
    nome: `Pessoa ${suffix}`,
    email: `pessoa-${suffix}@example.invalid`,
    telefone: '11999999999',
    agentTypes: ['comunicacao'],
    expiresAt: '2026-12-31',
    reason: 'Teste sintético',
    ...overrides,
  }, ACTOR);
}

function effective(user, agentType) {
  return user.access.find(access => access.agentType === agentType);
}

test('create, search, pagination and effective individual access', async () => {
  const time = clock();
  const store = createDemoAdminUsersStore(time.now);
  const user = await create(store, 'unique-search');
  assert.equal(user.revision, 1);
  assert.equal(user.nivel, 'user');
  assert.equal(effective(user, 'comunicacao').effective, true);
  for (const agent of AGENTS.slice(1)) assert.equal(effective(user, agent).effective, false);
  const byEmail = await store.list({ q: 'pessoa-unique-search@example.invalid' });
  assert.equal(byEmail.users.some(item => item.id === user.id), true);
  const byName = await store.list({ q: 'Pessoa unique-search' });
  assert.equal(byName.users.some(item => item.id === user.id), true);
  const byPhone = await store.list({ q: '11999999999' });
  assert.equal(byPhone.users.some(item => item.id === user.id), true);
  const filtered = await store.list({ agentType: 'comunicacao', status: 'active', page: 1, pageSize: 1 });
  assert.equal(filtered.pageSize, 1);
  assert.ok(filtered.total >= 1);
  assert.ok(filtered.users.length <= 1);
});

test('duplicate create, invalid fields and unknown agent are rejected without a new user', async () => {
  const store = createDemoAdminUsersStore(clock().now);
  await create(store, 'duplicate');
  const before = (await store.list({})).total;
  await assert.rejects(async () => (create(store, 'duplicate', { email: 'PESSOA-DUPLICATE@example.invalid' })), error => error.status === 409);
  for (const overrides of [
    { nome: '' },
    { email: 'not-an-email' },
    { agentTypes: ['unknown-agent'] },
    { expiresAt: 'not-a-date' },
  ]) {
    await assert.rejects(async () => (create(store, `invalid-${Math.random()}`, overrides)), error => error.status === 400);
  }
  assert.equal((await store.list({})).total, before);
});

test('access edits require matching revision, a reason and do not change unrelated agents', async () => {
  const store = createDemoAdminUsersStore(clock().now);
  let user = await create(store, 'revisions', { agentTypes: ['comunicacao', 'postagem'] });
  const originalRevision = user.revision;
  await assert.rejects(async () => (store.setAccess(user.id, {
    revision: originalRevision,
    access: user.access.map(({ agentType, enabled, expiresAt }) => ({ agentType, enabled: agentType === 'comunicacao' ? false : enabled, expiresAt })),
    reason: '',
  }, ACTOR)), error => error.status === 400);
  user = await store.setAccess(user.id, {
    revision: originalRevision,
    access: user.access.map(({ agentType, enabled, expiresAt }) => ({ agentType, enabled: agentType === 'comunicacao' ? false : enabled, expiresAt })),
    reason: 'Revogar Comunicação',
  }, ACTOR);
  assert.equal(user.revision, originalRevision + 1);
  assert.equal(effective(user, 'comunicacao').effective, false);
  assert.equal(effective(user, 'postagem').effective, true);
  await assert.rejects(async () => (store.update(user.id, {
    revision: originalRevision,
    nome: 'Atualização obsoleta',
    reason: 'Teste',
  }, ACTOR)), error => error.status === 409);
  assert.equal((await store.get(user.id)).nome, user.nome);
});

test('expiry closes access and an active admin has all four agents', async () => {
  const time = clock();
  const store = createDemoAdminUsersStore(time.now);
  const user = await create(store, 'expiry', { expiresAt: '2026-10-15' });
  assert.equal(effective(user, 'comunicacao').effective, true);
  time.advance(24 * 60 * 60 * 1000);
  const expired = await store.get(user.id);
  assert.equal(effective(expired, 'comunicacao').effective, false);
  assert.equal(expired.status, 'expired');
  const admins = (await store.list({})).users.filter(item => item.nivel === 'admin');
  assert.ok(admins.length >= 1, 'demo seed must include an admin fixture');
  for (const agent of AGENTS) {
    assert.equal(effective(admins[0], agent).effective, true);
    assert.equal(effective(admins[0], agent).source, 'admin');
  }
});

test('calendar expiry uses São Paulo day boundary, including the full expiry date', () => {
  let current = new Date('2026-10-16T01:00:00.000Z'); // 15 October, 22:00 in São Paulo.
  const store = createDemoAdminUsersStore(() => current);
  const user = create(store, 'local-day', { expiresAt: '2026-10-15' });
  assert.equal(effective(user, 'comunicacao').effective, true);
  current = new Date('2026-10-16T03:00:00.000Z'); // 16 October, 00:00 in São Paulo.
  assert.equal(effective(store.get(user.id), 'comunicacao').effective, false);
});

test('revoking one agent from global access materializes only the remaining effective agents', async () => {
  const store = createDemoAdminUsersStore(clock().now);
  const global = await store.get('demo-user-1');
  assert.equal(global.plano, 'Todas');
  for (const agent of AGENTS) assert.equal(effective(global, agent).effective, true);
  const updated = await store.setAccess(global.id, {
    revision: global.revision,
    access: global.access.map(({ agentType, enabled, expiresAt }) => ({ agentType, enabled: agentType === 'comunicacao' ? false : enabled, expiresAt })),
    reason: 'Revogação individual no demo',
  }, ACTOR);
  assert.equal(updated.plano, 'Personalizado');
  assert.equal(effective(updated, 'comunicacao').effective, false);
  for (const agent of AGENTS.slice(1)) assert.equal(effective(updated, agent).effective, true);
  assert.equal((await store.audit(global.id))[0].action, 'access_updated');
  const admin = await store.get('demo-user-5');
  await assert.rejects(async () => store.setAccess(admin.id, {
    revision: admin.revision,
    access: [],
    reason: 'Não permitido',
  }, ACTOR), error => error.status === 403);
});

test('audit omits invitation tokens and password material', async () => {
  const store = createDemoAdminUsersStore(clock().now);
  const user = await create(store, 'audit');
  const issued = await store.issueInvite(user.id, { revision: user.revision, action: 'generate' }, ACTOR);
  assert.match(issued.invite.url, /token=/);
  const audit = await store.audit(user.id);
  assert.ok(audit.some(event => event.action === 'created'));
  assert.ok(audit.some(event => event.action === 'invite_generated'));
  const serialized = JSON.stringify(audit);
  assert.equal(serialized.includes(new URL(issued.invite.url).searchParams.get('token')), false);
  assert.doesNotMatch(serialized, /"(?:password|senha|token|tokenHash|token_hash)"/i);
});

test('reissued invitations invalidate old tokens; current token expires and is single use', async () => {
  const time = clock();
  const store = createDemoAdminUsersStore(time.now);
  const user = await create(store, 'invite');
  const first = await store.issueInvite(user.id, { revision: user.revision, action: 'generate' }, ACTOR);
  assert.equal(first.invite.simulated, true);
  const firstToken = new URL(first.invite.url).searchParams.get('token');
  const second = await store.issueInvite(user.id, { revision: first.user.revision, action: 'send' }, ACTOR);
  const secondToken = new URL(second.invite.url).searchParams.get('token');
  assert.notEqual(firstToken, secondToken);
  await assert.rejects(async () => (store.consumeInvite(firstToken)), error => error.status === 400);
  const consumed = await store.consumeInvite(secondToken);
  assert.ok(consumed);
  await assert.rejects(async () => (store.consumeInvite(secondToken)), error => error.status === 400);
  const third = await store.issueInvite(user.id, { revision: (await store.get(user.id)).revision, action: 'generate' }, ACTOR);
  time.advance(48 * 60 * 60 * 1000);
  await assert.rejects(async () => (store.consumeInvite(new URL(third.invite.url).searchParams.get('token'))), error => error.status === 400);
});

test('email edit invalidates outstanding invitation; invitation links require local origin', async () => {
  const store = createDemoAdminUsersStore(clock().now);
  const user = create(store, 'invite-email');
  await assert.rejects(async () => store.issueInvite(user.id, { revision: user.revision, action: 'generate' }, ACTOR, 'https://example.com'), error => error.status === 400);
  assert.equal(store.get(user.id).revision, user.revision);
  const issued = store.issueInvite(user.id, { revision: user.revision, action: 'generate' }, ACTOR);
  const token = new URL(issued.invite.url).searchParams.get('token');
  const updated = store.update(user.id, { revision: issued.user.revision, email: 'new-address@example.invalid' }, ACTOR);
  assert.equal(updated.invite.status, 'none');
  await assert.rejects(async () => store.consumeInvite(token), error => error.status === 400);
});


const accessInput = user => user.access.map(({ agentType, enabled, expiresAt }) => ({ agentType, enabled, expiresAt }));
test('different dates survive renewing and revoking a single IA, including expired unchanged grants', () => {
  const time = clock(), store = createDemoAdminUsersStore(time.now);
  let user = create(store, 'individual-dates', { agentTypes: AGENTS, expiresAt: '2026-12-31' });
  user = store.setAccess(user.id, { revision: user.revision, access: accessInput(user).map(a => a.agentType === 'postagem' ? { ...a, expiresAt: '2027-12-31' } : a), reason: 'LinkedIn 2027 e outras 2026' }, ACTOR);
  const others = user.access.filter(a => a.agentType !== 'comunicacao');
  user = store.setAccess(user.id, { revision: user.revision, access: accessInput(user).map(a => a.agentType === 'comunicacao' ? { ...a, expiresAt: '2027-01-31' } : a), reason: 'Renovar somente Comunicação' }, ACTOR);
  assert.deepEqual(user.access.filter(a => a.agentType !== 'comunicacao'), others);
  user = store.setAccess(user.id, { revision: user.revision, access: accessInput(user).map(a => a.agentType === 'comunicacao' ? { ...a, enabled: false } : a), reason: 'Revogar somente Comunicação' }, ACTOR);
  assert.deepEqual(user.access.filter(a => a.agentType !== 'comunicacao'), others);
  time.advance(90 * 86400000);
  const expired = store.get(user.id);
  user = store.setAccess(user.id, { revision: expired.revision, access: accessInput(expired).map(a => a.agentType === 'postagem' ? { ...a, expiresAt: '2028-01-31' } : a), reason: 'Preservar expirados' }, ACTOR);
  assert.equal(effective(user, 'apresentacao').expiresAt, '2026-12-31');
  assert.equal(effective(user, 'apresentacao').effective, false);
  const audit = store.audit(user.id)[0];
  assert.equal(audit.changes.after.access.length, 4);
});

test('complete granular payload rejects duplicates, malformed fields, legacy contract and new expired grants', () => {
  const store = createDemoAdminUsersStore(clock().now), user = create(store, 'payload');
  const access = accessInput(user);
  const bad = [null, [], access.slice(0, 3), [...access, access[0]], [access[0], access[0], ...access.slice(2)],
    access.map((a, i) => i ? a : { ...a, agentType: 'unknown' }),
    access.map((a, i) => i ? a : { ...a, enabled: 'true' }),
    access.map((a, i) => i ? a : { ...a, expiresAt: '2026-02-30' }),
    access.map((a, i) => i ? a : { ...a, expiresAt: '2020-01-01' }),
    access.map((a, i) => i ? a : { ...a, extra: true }),
    access.map((a, i) => i ? a : { agentType: a.agentType, enabled: a.enabled }),
    [null, ...access.slice(1)]];
  for (const value of bad) assert.throws(() => store.setAccess(user.id, { revision: user.revision, access: value, reason: 'Payload inválido' }, ACTOR), error => error.status === 400);
  assert.throws(() => store.setAccess(user.id, { revision: user.revision, agentTypes: ['postagem'], expiresAt: null, reason: 'Legado' }, ACTOR), error => error.status === 400);
  assert.deepEqual(store.get(user.id), user);
  assert.equal(store.audit(user.id).length, 1);
});

test('global expired and unlimited legacy plans and residual individual cap preserve other IA dates', () => {
  const store = createDemoAdminUsersStore(clock().now);
  for (const id of ['demo-user-1', 'demo-user-3', 'demo-user-6', 'demo-user-7']) {
    const user = store.get(id), before = user.access.filter(a => a.agentType !== 'comunicacao');
    const updated = store.setAccess(id, { revision: user.revision, access: accessInput(user).map(a => a.agentType === 'comunicacao' ? { ...a, enabled: false } : a), reason: 'Preservar vigência ao individualizar' }, ACTOR);
    assert.equal(updated.data_expiracao, null);
    for (const prior of before) {
      const after = effective(updated, prior.agentType);
      assert.equal(after.expiresAt, prior.expiresAt);
      assert.equal(after.enabled, prior.enabled);
      assert.equal(after.effective, prior.effective);
    }
  }
});
