const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { path, root, stub, ADMIN } = require('./helpers.cjs');

const secret = 'synthetic-hotmart-jwt-secret';
const state = { token: undefined, role: 'admin', rpc: [], rpcResult: () => ({ data: {}, error: null }) };
stub('next/headers', { cookies: async () => ({ get: () => state.token ? { value: state.token } : undefined }) });
stub('*supabase/server', { createServerSupabaseClient: () => ({
  from(table) {
    assert.equal(table, 'users');
    return { select: () => ({ eq: (field, value) => ({ async single() { return { data: state.role ? { id: value, nivel: state.role } : null, error: null }; } }) }) };
  },
  async rpc(name, args) { state.rpc.push({ name, args }); return state.rpcResult(name, args); },
}) });

const route = file => require(path.join(root, 'src/app/api', file));
const adminRoute = route('admin/hotmart/route.ts');
const syncRoute = route('admin/hotmart/sync/route.ts');
const offerRoute = route('admin/hotmart/offers/[offerId]/route.ts');
const reviewRoute = route('admin/hotmart/reviews/[reviewId]/route.ts');
const webhookRoute = route('hotmart/webhook/route.ts');

const { NextRequest } = require('next/server');
const req = (pathname, { method = 'GET', origin, body, headers = {} } = {}) => new NextRequest(`http://localhost:3000${pathname}`, {
  method, headers: { ...(origin ? { origin } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});
const params = value => ({ params: Promise.resolve(value) });

beforeEach(() => {
  Object.assign(process.env, { JWT_SECRET: secret, ADMIN_USERS_MODE: 'live', ADMIN_USERS_LIVE_ENABLED: 'true', ADMIN_USERS_WRITES_ENABLED: 'true', NODE_ENV: 'test', NEXT_PUBLIC_SUPABASE_URL: 'http://supabase.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic' });
  delete process.env.HOTMART_WEBHOOK_MODE; delete process.env.HOTMART_CLIENT_ID;
  state.token = jwt.sign({ userId: ADMIN }, secret, { expiresIn: '1h' });
  state.role = 'admin'; state.rpc = []; state.rpcResult = () => ({ data: { offers: 0 }, error: null });
});

test('APIs admin Hotmart: sessão ausente 401, usuário comum 403, painel não-live 503', async () => {
  state.token = undefined;
  assert.equal((await adminRoute.GET(req('/api/admin/hotmart'))).status, 401);
  state.token = jwt.sign({ userId: ADMIN }, secret); state.role = 'user';
  assert.equal((await adminRoute.GET(req('/api/admin/hotmart'))).status, 403);
  state.role = 'admin'; process.env.ADMIN_USERS_MODE = 'disabled';
  assert.equal((await adminRoute.GET(req('/api/admin/hotmart'))).status, 503);
  process.env.ADMIN_USERS_MODE = 'demo';
  const demo = await adminRoute.GET(req('/api/admin/hotmart'));
  assert.equal(demo.status, 503);
  assert.equal((await demo.json()).code, 'hotmart_admin_requires_live');
  assert.equal(state.rpc.length, 0, 'nenhuma RPC sem autorização completa');
});

test('admin atual lê resumo sem expor credenciais; RPC recebe o ator verificado', async () => {
  process.env.HOTMART_CLIENT_ID = 'nao-deve-aparecer';
  const response = await adminRoute.GET(req('/api/admin/hotmart?resource=summary'));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual([body.mode, body.credentials, body.hottok], ['off', false, false]);
  assert.ok(!JSON.stringify(body).includes('nao-deve-aparecer'));
  assert.deepEqual(state.rpc[0], { name: 'hotmart_admin_read', args: { p_actor: ADMIN, p_resource: 'summary', p_filters: {} } });
  assert.equal((await adminRoute.GET(req('/api/admin/hotmart?resource=x'))).status, 400);
  assert.equal((await adminRoute.GET(req('/api/admin/hotmart?resource=events&status=bogus'))).status, 400);
});

test('escritas exigem gate de escrita e mesma origem; configuração é validada', async () => {
  process.env.ADMIN_USERS_WRITES_ENABLED = 'false';
  assert.equal((await syncRoute.POST(req('/api/admin/hotmart/sync', { method: 'POST', origin: 'http://localhost:3000', body: {} }))).status, 503);
  process.env.ADMIN_USERS_WRITES_ENABLED = 'true';
  assert.equal((await syncRoute.POST(req('/api/admin/hotmart/sync', { method: 'POST', origin: 'https://evil.invalid', body: {} }))).status, 403);
  const noCreds = await syncRoute.POST(req('/api/admin/hotmart/sync', { method: 'POST', origin: 'http://localhost:3000', body: {} }));
  assert.equal((await noCreds.json()).code, 'hotmart_credentials_missing');
  const offerId = '30000000-0000-4000-8000-000000000001';
  const bad = await offerRoute.PUT(req(`/api/admin/hotmart/offers/${offerId}`, { method: 'PUT', origin: 'http://localhost:3000', body: { agentTypes: ['inexistente'], accessKind: 'single', durationDays: 365 } }), params({ offerId }));
  assert.equal(bad.status, 400);
  const single = await offerRoute.PUT(req(`/api/admin/hotmart/offers/${offerId}`, { method: 'PUT', origin: 'http://localhost:3000', body: { agentTypes: ['comunicacao'], accessKind: 'single' } }), params({ offerId }));
  assert.equal(single.status, 400, 'compra única exige dias');
  const ok = await offerRoute.PUT(req(`/api/admin/hotmart/offers/${offerId}`, { method: 'PUT', origin: 'http://localhost:3000', body: { agentTypes: ['comunicacao', 'postagem'], accessKind: 'single', durationDays: 365, graceDays: null } }), params({ offerId }));
  assert.equal(ok.status, 200);
  assert.deepEqual(state.rpc.at(-1), { name: 'hotmart_admin_configure_offer', args: { p_actor: ADMIN, p_offer_id: offerId, p_config: { agentTypes: ['comunicacao', 'postagem'], accessKind: 'single', durationDays: 365, graceDays: null } } });
  state.role = 'user';
  assert.equal((await reviewRoute.POST(req('/api/admin/hotmart/reviews/x', { method: 'POST', origin: 'http://localhost:3000', body: { decision: 'keep', note: 'ok' } }), params({ reviewId: 'x' }))).status, 403);
});

test('aceite de revisão recalcula a proposta e envia revisão otimista', async () => {
  const reviewId = '50000000-0000-4000-8000-000000000001';
  const user = { user: { id: '20000000-0000-4000-8000-000000000002', email: 'p@example.invalid', nome: 'P', telefone: null, nivel: 'user', plano: 'Todas', data_expiracao: '2027-06-30' }, grants: [], state: [], purchases: [], revision: 'rev-x' };
  state.rpcResult = (name) => name === 'hotmart_admin_read'
    ? { data: { id: reviewId, userId: user.user.id, kind: 'revocation_without_ledger', status: 'open', details: {}, proposal: { agents: ['comunicacao'], baselineCaps: { comunicacao: { enabled: false, expiresAt: null } } }, user }, error: null }
    : { data: { status: 'accepted' }, error: null };
  const response = await reviewRoute.POST(req(`/api/admin/hotmart/reviews/${reviewId}`, { method: 'POST', origin: 'http://localhost:3000', body: { decision: 'accept', note: 'Reembolso confirmado' } }), params({ reviewId }));
  assert.equal(response.status, 200);
  const call = state.rpc.find(c => c.name === 'hotmart_admin_resolve_review');
  assert.equal(call.args.p_expected_revision, 'rev-x');
  assert.equal(call.args.p_plan.convertToPersonal, true);
  assert.deepEqual(call.args.p_plan.access.map(a => [a.agentType, a.enabled]), [['comunicacao', false], ['apresentacao', true], ['conversas_dificeis', true], ['postagem', true]]);
});

test('rota do webhook: desligada por padrão e exige hottok', async () => {
  const off = await webhookRoute.POST(req('/api/hotmart/webhook', { method: 'POST', body: { id: 'x' } }));
  assert.equal(off.status, 503);
  process.env.HOTMART_WEBHOOK_MODE = 'shadow'; process.env.HOTMART_HOTTOK = 'hottok-sintetico-0123456789';
  const wrong = await webhookRoute.POST(req('/api/hotmart/webhook', { method: 'POST', body: { id: 'x' }, headers: { 'x-hotmart-hottok': 'errado' } }));
  assert.equal(wrong.status, 401);
  assert.equal(state.rpc.length, 0);
  delete process.env.HOTMART_WEBHOOK_MODE; delete process.env.HOTMART_HOTTOK;
});
