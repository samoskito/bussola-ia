const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const crypto = require('node:crypto');
const { path, root } = require('./helpers.cjs');

const rpcName = 'admin_users_consume_legacy_reset';
const missingCache = { code: 'PGRST202', message: `Could not find the function public.${rpcName}(p_email, p_password_hash, p_token_hash) in the schema cache` };
const missingSql = { code: '42883', message: `function public.${rpcName}(text, text, text) does not exist` };
const invalidReset = { code: '22023', message: 'invalid reset' };
const fakeHash = '$2b$10$' + 'a'.repeat(53);
let currentClient;
let hashes = 0;
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request.endsWith('supabase/server')) return { createServerSupabaseClient: () => currentClient };
  if (request === 'bcryptjs') return { hash: async () => { hashes++; return fakeHash; } };
  return originalLoad.call(this, request, parent, isMain);
};
const route = require(path.join(root, 'src/app/api/auth/reset-password/route.ts'));
Module._load = originalLoad;

function request(overrides = {}) {
  return { json: async () => ({ email: ' Pessoa@Example.invalid ', token: 'synthetic-reset-token', password: 'synthetic-password', ...overrides }) };
}

function client({ rpcError = null, rpcData = { success: true }, throwRpc, legacyToken = true, preflightError = null, consume } = {}) {
  const state = { calls: [], tables: [], userWrites: 0, invalidations: 0 };
  return Object.assign(state, {
    async rpc(name, args) {
      state.calls.push({ name, args });
      assert.equal(name, rpcName);
      assert.equal(args.p_email, 'pessoa@example.invalid');
      assert.equal(args.p_token_hash, crypto.createHash('sha256').update('synthetic-reset-token').digest('hex'));
      assert.equal(args.p_password_hash, fakeHash);
      if (throwRpc) throw new Error('Synthetic transport failure');
      if (consume) return consume(args);
      return { data: rpcData, error: rpcError };
    },
    from(table) {
      state.tables.push(table);
      assert.ok(['users', 'password_reset_tokens'].includes(table));
      let updating = false;
      const query = {
        select() { return query; }, eq() { return query; }, is() { return query; },
        gt() { return query; }, order() { return query; }, limit() { return query; }, ilike() { return query; },
        update() { updating = true; return query; },
        async maybeSingle() {
          if (table === 'users') { assert.equal(updating, true); state.userWrites++; return { data: { id: 'synthetic-user' }, error: null }; }
          return { data: legacyToken ? { id: 'synthetic-token' } : null, error: preflightError };
        },
        then(resolve, reject) {
          assert.equal(table, 'password_reset_tokens');
          assert.equal(updating, true);
          state.invalidations++;
          return Promise.resolve({ error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  });
}

async function withEnv(values, callback) {
  const keys = ['ADMIN_USERS_MODE', 'ADMIN_USERS_LIVE_ENABLED', 'ADMIN_USERS_WRITES_ENABLED', 'PASSWORD_RESET_ATOMIC_REQUIRED'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) {
    if (values[key] === undefined) delete process.env[key]; else process.env[key] = values[key];
  }
  try { return await callback(); }
  finally { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } }
}

test('reset always uses installed atomic consumer in disabled, demo, read-only and live modes', async () => {
  for (const env of [
    { ADMIN_USERS_MODE: 'disabled', ADMIN_USERS_WRITES_ENABLED: 'false' },
    { ADMIN_USERS_MODE: 'demo' },
    { ADMIN_USERS_MODE: 'live', ADMIN_USERS_LIVE_ENABLED: 'true', ADMIN_USERS_WRITES_ENABLED: 'false' },
    { ADMIN_USERS_MODE: 'live', ADMIN_USERS_LIVE_ENABLED: 'true', ADMIN_USERS_WRITES_ENABLED: 'true' },
  ]) await withEnv(env, async () => {
    currentClient = client();
    const response = await route.POST(request());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).success, true);
    assert.equal(currentClient.calls.length, 1);
    assert.deepEqual(currentClient.tables, ['password_reset_tokens']);
    assert.equal(currentClient.userWrites, 0);
    assert.equal(currentClient.invalidations, 0);
  });
});

test('before migration only the exact missing reset RPC allows legacy compatibility', async () => {
  await withEnv({ ADMIN_USERS_MODE: 'disabled', PASSWORD_RESET_ATOMIC_REQUIRED: 'false' }, async () => {
    for (const rpcError of [missingCache, missingSql]) {
      currentClient = client({ rpcError });
      assert.equal((await route.POST(request())).status, 200);
      assert.equal(currentClient.calls.length, 1);
      assert.equal(currentClient.userWrites, 1);
      assert.equal(currentClient.invalidations, 1);
    }
    currentClient = client({ rpcError: missingCache, legacyToken: false });
    assert.equal((await route.POST(request())).status, 400);
    assert.equal(currentClient.userWrites, 0);
  });
});

test('atomic requirement survives disabled panel and missing RPC fails closed even on exact absence', async () => {
  for (const env of [
    { ADMIN_USERS_MODE: 'disabled', ADMIN_USERS_WRITES_ENABLED: 'false', PASSWORD_RESET_ATOMIC_REQUIRED: 'true' },
    { ADMIN_USERS_MODE: 'live', ADMIN_USERS_LIVE_ENABLED: 'true', ADMIN_USERS_WRITES_ENABLED: 'true' },
  ]) await withEnv(env, async () => {
    for (const rpcError of [missingCache, missingSql]) {
      currentClient = client({ rpcError });
      assert.equal((await route.POST(request())).status, 500);
      assert.deepEqual(currentClient.tables, ['password_reset_tokens']);
      assert.equal(currentClient.userWrites, 0);
      assert.equal(currentClient.invalidations, 0);
    }
  });
});

test('network, permission, internal missing function, wrong signature and unexpected results never fall back', async () => {
  await withEnv({ ADMIN_USERS_MODE: 'disabled' }, async () => {
    const failures = [
      { rpcError: { code: '42501', message: 'permission denied' } },
      { rpcError: { code: 'PGRST000', message: 'connection unavailable' } },
      { rpcError: { code: '42883', message: 'function public.admin_users_lock(uuid) does not exist' } },
      { rpcError: { code: 'PGRST202', message: missingCache.message.replace('(p_email, p_password_hash, p_token_hash)', '(p_email, p_token_hash)') } },
      { rpcError: { ...missingCache, code: 'P0001' } },
      { rpcError: { ...missingSql, message: missingSql.message.replace(rpcName, `${rpcName}_other`) } },
      { rpcData: null }, { rpcData: { success: false } }, { rpcData: { success: 'true' } },
      { throwRpc: true },
    ];
    for (const failure of failures) {
      currentClient = client(failure);
      assert.equal((await route.POST(request())).status, 500);
      assert.deepEqual(currentClient.tables, ['password_reset_tokens']);
      assert.equal(currentClient.userWrites, 0);
      assert.equal(currentClient.invalidations, 0);
    }
  });
});

test('invalid, expired or already consumed atomic reset token returns 400 without legacy writes', async () => {
  await withEnv({ ADMIN_USERS_MODE: 'disabled' }, async () => {
    currentClient = client({ rpcError: invalidReset });
    assert.equal((await route.POST(request())).status, 400);
    assert.deepEqual(currentClient.tables, ['password_reset_tokens']);
    assert.equal(currentClient.userWrites, 0);
    assert.equal(currentClient.invalidations, 0);
  });
});

test('recovery remains one-use during panel shutdown and concurrent invitation consumption', async () => {
  await withEnv({ ADMIN_USERS_MODE: 'live', ADMIN_USERS_LIVE_ENABLED: 'true', ADMIN_USERS_WRITES_ENABLED: 'true', PASSWORD_RESET_ATOMIC_REQUIRED: 'true' }, async () => {
    // Model the SQL's shared user lock. PostgreSQL fixture tests exercise its real implementation.
    for (const invitationFirst of [true, false]) {
      process.env.ADMIN_USERS_MODE = 'live';
      process.env.ADMIN_USERS_WRITES_ENABLED = 'true';
      let locked = Promise.resolve();
      let consumed = false;
      let winners = 0;
      let release;
      const lockGate = new Promise(resolve => { release = resolve; });
      const arrivals = [];
      const firstArrival = new Promise(resolve => { arrivals.push(resolve); });
      const secondArrival = new Promise(resolve => { arrivals.push(resolve); });
      function consume() {
        const operation = locked.then(async () => {
          await lockGate;
          if (consumed) return { data: null, error: invalidReset };
          consumed = true; winners++;
          return { data: { success: true }, error: null };
        });
        locked = operation.then(() => undefined);
        return operation;
      }
      currentClient = client({ consume() { arrivals.shift()?.(); return consume(); } });
      let invitation;
      if (invitationFirst) invitation = consume();
      const beforeShutdown = route.POST(request());
      await firstArrival;
      process.env.ADMIN_USERS_MODE = 'disabled';
      process.env.ADMIN_USERS_WRITES_ENABLED = 'false';
      const afterShutdown = route.POST(request());
      await secondArrival;
      if (!invitationFirst) invitation = consume();
      release();
      const [first, second, invite] = await Promise.all([beforeShutdown, afterShutdown, invitation]);
      assert.equal(winners, 1);
      assert.equal([first.status === 200, second.status === 200, invite.data?.success === true].filter(Boolean).length, 1);
      assert.equal(first.status, invitationFirst ? 400 : 200);
      assert.equal(second.status, 400);
      assert.equal((await route.POST(request())).status, 400);
      assert.equal(currentClient.calls.length, 3);
      assert.deepEqual(currentClient.tables, Array(3).fill('password_reset_tokens'));
      assert.equal(currentClient.userWrites, 0);
      assert.equal(currentClient.invalidations, 0);
    }
  });
});

test('invalid request is rejected before any persistence call', async () => {
  currentClient = client();
  for (const overrides of [{ email: '' }, { token: '' }, { password: 'short' }]) {
    assert.equal((await route.POST(request(overrides))).status, 400);
  }
  assert.equal(currentClient.calls.length, 0);
  assert.deepEqual(currentClient.tables, []);
});

test('invalid or expired token and preflight database failures avoid bcrypt and all writes', async () => {
  await withEnv({ ADMIN_USERS_MODE: 'disabled' }, async () => {
    for (const scenario of [
      { options: { legacyToken: false }, status: 400 },
      { options: { preflightError: { code: 'PGRST000' } }, status: 500 },
    ]) {
      currentClient = client(scenario.options);
      const previousHashes = hashes;
      assert.equal((await route.POST(request())).status, scenario.status);
      assert.equal(hashes, previousHashes);
      assert.equal(currentClient.calls.length, 0);
      assert.equal(currentClient.userWrites, 0);
      assert.equal(currentClient.invalidations, 0);
    }
  });
});
