const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { load } = require('./helpers.cjs');

let clientConstructions = 0;
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request.endsWith('supabase/server')) return { createServerSupabaseClient() {
    clientConstructions++;
    throw new Error('Real database construction is prohibited in repository tests');
  } };
  return originalLoad.call(this, request, parent, isMain);
};
const { createLiveAdminUsersRepository, mapAdminUsersRpcError } = load('repository');
Module._load = originalLoad;

const actor = '10000000-0000-4000-8000-000000000001';
const userId = '20000000-0000-4000-8000-000000000002';
const revision = '0123456789abcdef0123456789abcdef';
const reason = 'Venda manual aprovada';
const access = ['comunicacao', 'apresentacao', 'conversas_dificeis', 'postagem'].map(agentType => ({ agentType, enabled: true, expiresAt: agentType === 'postagem' ? '2027-12-31' : '2026-12-31' }));
const profile = { nome: 'Pessoa Exemplo', email: ' PESSOA@USUARIOS.EXAMPLE ', telefone: '+55 11 90000-0000', reason };
function fakeClient(response = { data: { id: userId, revision }, error: null }) {
  const calls = [];
  return { calls, async rpc(name, args) { calls.push({ name, args }); return typeof response === 'function' ? response(name, args) : response; } };
}
async function withLive(callback) {
  const values = { ADMIN_USERS_MODE: 'live', ADMIN_USERS_LIVE_ENABLED: 'true', ADMIN_USERS_WRITES_ENABLED: 'true', NODE_ENV: 'production' };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  try { return await callback(); }
  finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
}

test('live repository gates constructor-free reads and writes before all RPCs', () => withLive(async () => {
  const client = fakeClient(), repo = createLiveAdminUsersRepository(client);
  process.env.ADMIN_USERS_LIVE_ENABLED = 'false';
  await assert.rejects(repo.get(userId, actor), error => error.status === 503);
  await assert.rejects(repo.create(profile, actor), error => error.status === 503);
  process.env.ADMIN_USERS_LIVE_ENABLED = 'true'; process.env.ADMIN_USERS_WRITES_ENABLED = 'false';
  await assert.rejects(repo.create(profile, actor), error => error.status === 503);
  await assert.rejects(repo.update(userId, { revision, nome: 'Novo Nome', reason }, actor), error => error.status === 503);
  await assert.rejects(repo.setAccess(userId, { revision, access, reason }, actor), error => error.status === 503);
  await repo.get(userId, actor);
  assert.equal(client.calls.length, 1);
  process.env.ADMIN_USERS_MODE = 'demo'; process.env.NODE_ENV = 'development';
  await assert.rejects(repo.get(userId, actor), error => error.status === 503);
  assert.equal(client.calls.length, 1);
  assert.equal(clientConstructions, 0);
}));

test('create sends only RPC fields and a bcrypt12 hash of a fresh random bootstrap password', () => withLive(async () => {
  const client = fakeClient(), repo = createLiveAdminUsersRepository(client);
  const oldRandom = crypto.randomBytes;
  const bootstrapSecrets = [];
  crypto.randomBytes = function (size, ...args) {
    if (size === 48) {
      const secret = Buffer.alloc(size, 17 + bootstrapSecrets.length);
      bootstrapSecrets.push(secret.toString('base64url'));
      return secret;
    }
    return oldRandom.call(this, size, ...args);
  };
  try {
    await repo.create({ ...profile, agentTypes: ['comunicacao'], expiresAt: '2099-12-31' }, actor);
    await repo.create(profile, actor);
  } finally { crypto.randomBytes = oldRandom; }
  assert.equal(bootstrapSecrets.length, 2);
  assert.notEqual(bootstrapSecrets[0], bootstrapSecrets[1]);
  for (let index = 0; index < 2; index++) {
    const call = client.calls[index];
    assert.equal(call.name, 'admin_users_mutate');
    assert.equal(call.args.p_operation, 'create');
    assert.equal(call.args.p_actor, actor);
    assert.equal(call.args.p_user_id, null);
    assert.equal(call.args.p_expected_revision, null);
    assert.match(call.args.p_password_hash, /^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/);
    assert.equal(await bcrypt.compare(bootstrapSecrets[index], call.args.p_password_hash), true);
    assert.equal(call.args.p_input.email, 'pessoa@usuarios.example');
    assert.equal('nivel' in call.args.p_input, false);
    assert.equal('senha' in call.args.p_input, false);
    assert.equal(JSON.stringify(call.args).includes(bootstrapSecrets[index]), false);
  }
  assert.equal(clientConstructions, 0);
}));

test('profile and access reject unknown fields, malformed dates and numeric demo revisions before RPC', () => withLive(async () => {
  const client = fakeClient(), repo = createLiveAdminUsersRepository(client);
  for (const input of [{ ...profile, nivel: 'admin' }, { ...profile, senha: 'do-not-store' }, { ...profile, reason: '' }, { ...profile, agentTypes: ['unknown'] }, { ...profile, expiresAt: '2099-02-30' }]) {
    await assert.rejects(repo.create(input, actor), error => error.status === 400);
  }
  await assert.rejects(repo.create(profile, 'not-a-uuid'), error => error.status === 400);
  for (const input of [{ revision: 1, nome: 'Novo Nome', reason }, { revision, nivel: 'admin', reason }, { revision, reason }]) {
    await assert.rejects(repo.update(userId, input, actor), error => error.status === 400);
  }
  for (const input of [{ revision, agentTypes: ['postagem', 'postagem'], expiresAt: null, reason }, { revision, agentTypes: ['postagem'], expiresAt: '2000-01-01', reason }, { revision, agentTypes: [], reason }]) {
    await assert.rejects(repo.setAccess(userId, input, actor), error => error.status === 400);
  }
  assert.equal(client.calls.length, 0);
  await repo.update(userId, { revision, nome: ' Novo Nome ', telefone: null, reason }, actor);
  await repo.setAccess(userId, { revision, access, reason }, actor);
  assert.deepEqual(client.calls[0].args.p_input, { nome: 'Novo Nome', telefone: null, reason });
  assert.equal(client.calls[0].args.p_expected_revision, revision);
  assert.equal(client.calls[0].args.p_operation, 'profile');
  assert.deepEqual(client.calls[1].args.p_input, { access, reason });
  assert.equal(client.calls[1].args.p_operation, 'access');
}));

test('queries use actor-scoped read RPCs and strict pagination, never direct table access', () => withLive(async () => {
  const client = fakeClient(), repo = createLiveAdminUsersRepository(client);
  await repo.list({ q: ' pessoa ', agentType: 'postagem', status: 'active', page: 2, pageSize: 20 }, actor);
  await repo.get(userId, actor);
  await repo.audit(userId, actor);
  assert.deepEqual(client.calls[0], { name: 'admin_users_read', args: { p_actor: actor, p_user_id: null, p_filters: { q: 'pessoa', agentType: 'postagem', status: 'active', page: 2, pageSize: 20 } } });
  assert.equal(client.calls[1].name, 'admin_users_read');
  assert.equal(client.calls[2].name, 'admin_users_audit_read');
  for (const input of [{ page: 0 }, { page: 1.5 }, { pageSize: 101 }, { status: 'invalid' }, { agentType: 'unknown' }, { password: true }]) {
    await assert.rejects(repo.list(input, actor), error => error.status === 400);
  }
  assert.equal(client.calls.length, 3);
}));

test('storage error mapping reports safe conflicts and hides database diagnostics', () => withLive(async () => {
  for (const [code, status] of Object.entries({ forbidden: 403, not_found: 404, revision_conflict: 409, duplicate_email: 409, admin_target_locked: 403, invalid_input: 400 })) {
    const repo = createLiveAdminUsersRepository(fakeClient({ data: null, error: { code: 'P0001', message: `admin_users:${code}` } }));
    await assert.rejects(repo.get(userId, actor), error => error.status === status && error.code === code);
  }
  const internal = mapAdminUsersRpcError({ code: 'XX000', message: 'credential or internal SQL details' });
  assert.equal(internal.status, 503);
  assert.equal(internal.message.includes('credential'), false);
  const missingData = createLiveAdminUsersRepository(fakeClient({ data: null, error: null }));
  await assert.rejects(missingData.get(userId, actor), error => error.status === 503);
  const offline = createLiveAdminUsersRepository(fakeClient(() => { throw new Error('network denied'); }));
  await assert.rejects(offline.get(userId, actor), error => error.status === 503 && !error.message.includes('network denied'));
}));

test('granular access validates the complete strict contract before RPC and forwards each distinct date', () => withLive(async () => {
  const client = fakeClient(), repo = createLiveAdminUsersRepository(client);
  for (const value of [null, [], access.slice(1), [...access, access[0]], [access[0], access[0], ...access.slice(2)],
    access.map((a, i) => i ? a : { ...a, enabled: 'true' }), access.map((a, i) => i ? a : { ...a, expiresAt: '2026-02-30' }),
    access.map((a, i) => i ? a : { ...a, agentType: 'unknown' }), access.map((a, i) => i ? a : { ...a, extra: 1 }),
    access.map((a, i) => i ? a : { agentType: a.agentType, enabled: true }), [null, ...access.slice(1)]]) {
    await assert.rejects(repo.setAccess(userId, { revision, access: value, reason }, actor), e => e.status === 400);
  }
  await assert.rejects(repo.setAccess(userId, { revision, access, agentTypes: [], reason }, actor), e => e.status === 400);
  assert.equal(client.calls.length, 0);
  await repo.setAccess(userId, { revision, access, reason }, actor);
  assert.deepEqual(client.calls[0].args.p_input, { access, reason });
  assert.equal(client.calls[0].args.p_expected_revision, revision);
  // SQL must compare old expiry under its lock; repository must not reject an
  // otherwise valid expired grant that an unrelated edit needs to preserve.
  const expired = access.map((a, i) => i ? a : { ...a, expiresAt: '2000-01-01' });
  await repo.setAccess(userId, { revision, access: expired, reason }, actor);
  assert.deepEqual(client.calls[1].args.p_input.access, expired);
}));
