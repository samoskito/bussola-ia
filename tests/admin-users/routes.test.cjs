const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const jwt = require('jsonwebtoken');
const { load, path, root } = require('./helpers.cjs');

const secret = 'synthetic-admin-demo-jwt-secret';
const id = '10000000-0000-4000-8000-000000000001';
const state = { token: undefined, role: 'admin', lookups: 0 };
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'next/headers') {
    return { cookies: async () => ({ get: () => state.token ? { value: state.token } : undefined }) };
  }
  if (request.endsWith('supabase/server')) {
    return { createServerSupabaseClient: () => ({
      from(table) {
        assert.equal(table, 'users');
        return {
          select(columns) {
            assert.equal(columns, 'id,nivel');
            return {
              eq(field, value) {
                assert.equal(field, 'id');
                assert.equal(value, id);
                return { async single() {
                  state.lookups++;
                  return { data: state.role ? { id, nivel: state.role } : null, error: null };
                } };
              },
            };
          },
        };
      },
    }) };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const server = load('server');
const usersRoute = require(path.join(root, 'src/app/api/admin/users/route.ts'));
const inviteRoute = require(path.join(root, 'src/app/api/admin/users/demo-password/route.ts'));
Module._load = originalLoad;

function request(pathname, { method = 'GET', origin, body, contentType = 'application/json' } = {}) {
  const url = `http://localhost:3000${pathname}`;
  const headers = new Headers();
  if (origin) headers.set('origin', origin);
  if (body !== undefined) headers.set('content-type', contentType);
  return { url, nextUrl: new URL(url), method, headers, text: async () => body ?? '' };
}

function withDemo(callback) {
  const previous = { mode: process.env.ADMIN_USERS_MODE, nodeEnv: process.env.NODE_ENV, secret: process.env.JWT_SECRET };
  process.env.ADMIN_USERS_MODE = 'demo';
  process.env.NODE_ENV = 'development';
  process.env.JWT_SECRET = secret;
  state.token = jwt.sign({ userId: id, nivel: 'admin' }, secret, { expiresIn: '1h' });
  state.role = 'admin';
  state.lookups = 0;
  return Promise.resolve().then(callback).finally(() => {
    for (const [key, value] of Object.entries({ ADMIN_USERS_MODE: previous.mode, NODE_ENV: previous.nodeEnv, JWT_SECRET: previous.secret })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
}

test('all admin user routes require a current administrator, not a role claim in the JWT', () => withDemo(async () => {
  state.token = undefined;
  let response = await usersRoute.GET(request('/api/admin/users'));
  assert.equal(response.status, 401);
  assert.equal(state.lookups, 0);
  state.token = jwt.sign({ userId: id, nivel: 'admin' }, secret, { expiresIn: '1h' });
  state.role = 'user';
  response = await usersRoute.GET(request('/api/admin/users'));
  assert.equal(response.status, 403);
  assert.equal(state.lookups, 1);
  state.role = 'admin';
  response = await usersRoute.GET(request('/api/admin/users'));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).mode, 'demo');
}));

test('disabled or production mode blocks route before the admin database lookup', () => withDemo(async () => {
  process.env.ADMIN_USERS_MODE = 'disabled';
  let response = await usersRoute.GET(request('/api/admin/users'));
  assert.equal(response.status, 503);
  assert.equal(state.lookups, 0);
  process.env.ADMIN_USERS_MODE = 'demo';
  process.env.NODE_ENV = 'production';
  response = await usersRoute.GET(request('/api/admin/users'));
  assert.equal(response.status, 503);
  assert.equal(state.lookups, 0);
}));

test('admin mutation accepts same origin and rejects missing or foreign origin', () => withDemo(async () => {
  const payload = JSON.stringify({ nome: 'Pessoa Teste', email: 'route-test@example.invalid', agentTypes: [] });
  let response = await usersRoute.POST(request('/api/admin/users', { method: 'POST', body: payload }));
  assert.equal(response.status, 403);
  response = await usersRoute.POST(request('/api/admin/users', { method: 'POST', origin: 'https://example.com', body: payload }));
  assert.equal(response.status, 403);
  const crossSite = request('/api/admin/users', { method: 'POST', origin: 'http://localhost:3000', body: payload });
  crossSite.headers.set('sec-fetch-site', 'cross-site');
  response = await usersRoute.POST(crossSite);
  assert.equal(response.status, 403);
  response = await usersRoute.POST(request('/api/admin/users', { method: 'POST', origin: 'http://localhost:3000', body: payload }));
  assert.equal(response.status, 200);
  const user = (await response.json()).user;
  assert.equal(user.email, 'route-test@example.invalid');
}));

test('mutation validates JSON content type, body size, and unknown fields', () => withDemo(async () => {
  const options = { method: 'POST', origin: 'http://localhost:3000' };
  let response = await usersRoute.POST(request('/api/admin/users', { ...options, body: '{}', contentType: 'text/plain' }));
  assert.equal(response.status, 415);
  response = await usersRoute.POST(request('/api/admin/users', { ...options, body: '{broken' }));
  assert.equal(response.status, 400);
  response = await usersRoute.POST(request('/api/admin/users', { ...options, body: ' '.repeat(16385) }));
  assert.equal(response.status, 413);
  response = await usersRoute.POST(request('/api/admin/users', { ...options, body: JSON.stringify({ nome: 'Pessoa', email: 'extra@example.invalid', nivel: 'admin' }) }));
  assert.equal(response.status, 400);
}));

test('demo token endpoint does not require a user session but remains local, flagged and token-only', () => withDemo(async () => {
  state.token = undefined;
  const options = { method: 'POST', origin: 'http://localhost:3000' };
  let response = await inviteRoute.POST(request('/api/admin/users/demo-password', { ...options, body: JSON.stringify({ token: 'invalid' }) }));
  assert.equal(response.status, 400);
  assert.equal(state.lookups, 0);
  response = await inviteRoute.POST(request('/api/admin/users/demo-password', { ...options, body: JSON.stringify({ token: 'invalid', senha: 'do-not-accept' }) }));
  assert.equal(response.status, 400);
  response = await inviteRoute.POST(request('/api/admin/users/demo-password', { method: 'POST', body: JSON.stringify({ token: 'invalid' }) }));
  assert.equal(response.status, 403);
  process.env.ADMIN_USERS_MODE = 'disabled';
  response = await inviteRoute.POST(request('/api/admin/users/demo-password', { ...options, body: JSON.stringify({ token: 'invalid' }) }));
  assert.equal(response.status, 503);
  assert.equal(state.lookups, 0);
}));
