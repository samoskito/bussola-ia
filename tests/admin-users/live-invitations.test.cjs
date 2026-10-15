const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { load } = require('./helpers.cjs');

// Fail if a test accidentally reaches the prepared real SMTP transport.
let transportFactory = () => { throw new Error('Real SMTP is prohibited in tests'); };
const previousLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'nodemailer') return { createTransport(...args) { return transportFactory(...args); } };
  return previousLoad.call(this, request, parent, isMain);
};
const { issueLiveInvite, consumeLiveInvite, sendFirstAccessEmail } = load('invitations');
Module._load = previousLoad;

const actor = '10000000-0000-4000-8000-000000000001';
const userId = '20000000-0000-4000-8000-000000000002';
const revision = '0123456789abcdef0123456789abcdef';
const live = {
  NODE_ENV: 'production', ADMIN_USERS_MODE: 'live', ADMIN_USERS_LIVE_ENABLED: 'true',
  ADMIN_USERS_WRITES_ENABLED: 'true', ADMIN_USERS_APP_URL: 'https://app.example.invalid',
};
const reason = 'Venda manual aprovada';
const fakeUser = { id: userId, revision };

function client() {
  const calls = [];
  return {
    calls,
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === 'admin_users_issue_invite') return { data: { id: 'invite-id', email: 'pessoa@example.invalid', user: fakeUser }, error: null };
      if (name === 'admin_users_invite_delivery') return { data: { user: fakeUser, deliveryStatus: args.p_status }, error: null };
      if (name === 'admin_users_validate_invite') return { data: { valid: true }, error: null };
      if (name === 'admin_users_consume_invite') return { data: { success: true }, error: null };
      throw new Error(`Unexpected RPC: ${name}`);
    },
  };
}
const issue = (rpcClient, overrides = {}) => issueLiveInvite({
  client: rpcClient, actor, userId, revision, action: 'generate', reason, env: live,
  now: () => new Date('2026-10-15T12:00:00.000Z'), ...overrides,
});

test('live first access is gated before token issuance or RPC', async () => {
  const rpcClient = client();
  await assert.rejects(issue(rpcClient, { env: { ...live, ADMIN_USERS_LIVE_ENABLED: 'false' } }), error => error.status === 503);
  await assert.rejects(issue(rpcClient, { env: { ...live, ADMIN_USERS_WRITES_ENABLED: 'false' } }), error => error.status === 503);
  await assert.rejects(issue(rpcClient, { env: { ...live, ADMIN_USERS_MODE: 'demo' } }), error => error.status === 503);
  await assert.rejects(issue(rpcClient, { env: { ...live, ADMIN_USERS_APP_URL: 'http://app.example.invalid' } }), error => error.status === 503);
  await assert.rejects(issue(rpcClient, { env: { ...live, ADMIN_USERS_APP_URL: 'https://user@app.example.invalid' } }), error => error.status === 503);
  await assert.rejects(issue(rpcClient, { action: 'send' }), error => error.status === 503);
  assert.equal(rpcClient.calls.length, 0);
});

test('generated link uses fixed configured HTTPS origin and fragment; RPC sees digest only', async () => {
  const rpcClient = client();
  const result = await issue(rpcClient);
  const parsed = new URL(result.invite.url);
  assert.equal(parsed.origin, live.ADMIN_USERS_APP_URL);
  assert.equal(parsed.pathname, '/auth/first-access');
  assert.equal(parsed.search, '');
  assert.match(parsed.hash, /^#token=[A-Za-z0-9_-]{43}$/);
  assert.equal(result.invite.simulated, false);
  assert.equal(result.invite.expiresAt, '2026-10-15T13:00:00.000Z');
  assert.equal(rpcClient.calls.length, 1);
  assert.equal(rpcClient.calls[0].name, 'admin_users_issue_invite');
  assert.match(rpcClient.calls[0].args.p_token_hash, /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(rpcClient.calls).includes(parsed.hash.slice(7)), false);
  assert.equal(rpcClient.calls[0].args.p_reason, reason);
});

test('send records sent only after injected mailer succeeds', async () => {
  const rpcClient = client();
  let delivered;
  const result = await issue(rpcClient, {
    action: 'send', env: { ...live, ADMIN_USERS_EMAIL_ENABLED: 'true' },
    mailer: async mail => { delivered = mail; },
  });
  assert.equal(delivered.to, 'pessoa@example.invalid');
  assert.equal(delivered.url, result.invite.url);
  assert.deepEqual(rpcClient.calls.map(call => call.name), ['admin_users_issue_invite', 'admin_users_invite_delivery']);
  assert.equal(rpcClient.calls[1].args.p_status, 'sent');
});

test('failed transport records failed and never reports delivery success', async () => {
  const rpcClient = client();
  await assert.rejects(issue(rpcClient, {
    action: 'send', env: { ...live, ADMIN_USERS_EMAIL_ENABLED: 'true' },
    mailer: async () => { throw new Error('Synthetic mail failure'); },
  }), error => error.status === 502 && error.code === 'invite_send_failed');
  assert.deepEqual(rpcClient.calls.map(call => call.name), ['admin_users_issue_invite', 'admin_users_invite_delivery']);
  assert.equal(rpcClient.calls[1].args.p_status, 'failed');
});

test('recipient submits only a digest and bcrypt hash; invalid input never reaches RPC', async () => {
  const rpcClient = client();
  const token = 'A'.repeat(43);
  const bcryptHash = '$2b$12$' + 'a'.repeat(53);
  let receivedPassword;
  const result = await consumeLiveInvite({
    client: rpcClient, token, password: 'synthetic-password-123', env: live,
    hashPassword: async password => { receivedPassword = password; return bcryptHash; },
  });
  assert.deepEqual(result, { success: true });
  assert.equal(receivedPassword, 'synthetic-password-123');
  assert.deepEqual(rpcClient.calls.map(call => call.name), ['admin_users_validate_invite', 'admin_users_consume_invite']);
  assert.match(rpcClient.calls[0].args.p_token_hash, /^[0-9a-f]{64}$/);
  assert.equal(rpcClient.calls[1].args.p_password_hash, bcryptHash);
  assert.equal(JSON.stringify(rpcClient.calls).includes(token), false);
  assert.equal(JSON.stringify(rpcClient.calls).includes(receivedPassword), false);
  const count = rpcClient.calls.length;
  await assert.rejects(consumeLiveInvite({ client: rpcClient, token: 'bad', password: 'synthetic-password-123', env: live }), error => error.status === 400);
  await assert.rejects(consumeLiveInvite({ client: rpcClient, token, password: 'short', env: live }), error => error.status === 400);
  await assert.rejects(consumeLiveInvite({ client: rpcClient, token, password: 'é'.repeat(40), env: live }), error => error.status === 400);
  await assert.rejects(consumeLiveInvite({ client: rpcClient, token, password: 'synthetic-password-123', env: { ...live, ADMIN_USERS_WRITES_ENABLED: 'false' } }), error => error.status === 503);
  assert.equal(rpcClient.calls.length, count);
});

test('unknown or stale token is rejected before costly password hashing', async () => {
  const calls = [];
  const rpcClient = { async rpc(name, args) { calls.push({ name, args }); return { data: { valid: false }, error: null }; } };
  let hashed = false;
  await assert.rejects(consumeLiveInvite({
    client: rpcClient, token: 'B'.repeat(43), password: 'synthetic-password-123', env: live,
    hashPassword: async () => { hashed = true; throw new Error('Must not hash'); },
  }), error => error.status === 400);
  assert.equal(hashed, false);
  assert.deepEqual(calls.map(call => call.name), ['admin_users_validate_invite']);
});

test('prepared mail transport uses timeouts and parses formatted sender for Brevo', async () => {
  let smtpOptions;
  transportFactory = options => {
    smtpOptions = options;
    return { async sendMail() { return { accepted: ['pessoa@example.invalid'] }; } };
  };
  const mail = { to: 'pessoa@example.invalid', url: 'https://app.example.invalid/auth/first-access#token=synthetic', expiresAt: '2026-10-15T13:00:00.000Z' };
  const mailEnv = { ...live, ADMIN_USERS_EMAIL_ENABLED: 'true', SMTP_FROM: 'Equipe Bússola <convites@example.invalid>', SMTP_HOST: 'smtp.example.invalid', SMTP_USER: 'test-user', SMTP_PASS: 'synthetic' };
  try {
    await sendFirstAccessEmail(mail, mailEnv);
    assert.equal(smtpOptions.connectionTimeout, 10000);
    assert.equal(smtpOptions.greetingTimeout, 10000);
    assert.equal(smtpOptions.socketTimeout, 15000);
    const originalFetch = global.fetch;
    let request;
    try {
      global.fetch = async (url, options) => { request = { url, options }; return { ok: true }; };
      await sendFirstAccessEmail(mail, { ...mailEnv, SMTP_HOST: undefined, BREVO_API_KEY: 'synthetic-key' });
      assert.equal(request.url, 'https://api.brevo.com/v3/smtp/email');
      assert.deepEqual(JSON.parse(request.options.body).sender, { email: 'convites@example.invalid', name: 'Equipe Bússola' });
    } finally { global.fetch = originalFetch; }
  } finally { transportFactory = () => { throw new Error('Real SMTP is prohibited in tests'); }; }
});
