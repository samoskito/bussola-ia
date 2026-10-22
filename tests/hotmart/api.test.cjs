const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');

const { createHotmartApiClient, clearHotmartTokenCache, HOTMART_API } = load('api');
const env = { HOTMART_CLIENT_ID: 'cid', HOTMART_CLIENT_SECRET: 'csecret', HOTMART_BASIC: 'Basic YmFzaWM=', HOTMART_ENV: 'sandbox' };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
beforeEach(() => clearHotmartTokenCache());

function mockFetch(routes) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const u = new URL(url);
    for (const [match, handler] of routes) if (match(u, init)) return handler(u, init, calls);
    throw new Error(`unexpected ${url}`);
  };
  return { fn, calls };
}
const isToken = u => u.href.startsWith(HOTMART_API.tokenUrl);

test('token client_credentials com Basic, cache até expirar e sem vazar credenciais na URL da API', async () => {
  let tokens = 0; let now = 1_000_000;
  const { fn, calls } = mockFetch([
    [isToken, () => json(200, { access_token: `tok-${++tokens}`, expires_in: 3600 })],
    [u => u.pathname === HOTMART_API.products, () => json(200, { items: [], page_info: {} })],
  ]);
  const client = createHotmartApiClient({ env, fetch: fn, now: () => now });
  await client.listProducts(); await client.listProducts();
  assert.equal(tokens, 1, 'token reaproveitado');
  const tokenCall = calls.find(c => isToken(new URL(c.url)));
  const tokenUrl = new URL(tokenCall.url);
  assert.equal(tokenCall.init.method, 'POST');
  assert.equal(tokenCall.init.headers.Authorization, 'Basic YmFzaWM=');
  assert.deepEqual([tokenUrl.searchParams.get('grant_type'), tokenUrl.searchParams.get('client_id')], ['client_credentials', 'cid']);
  const apiCall = calls.find(c => !isToken(new URL(c.url)));
  assert.ok(apiCall.url.startsWith('https://sandbox.hotmart.com/'));
  assert.ok(!apiCall.url.includes('csecret'));
  assert.equal(apiCall.init.headers.Authorization, 'Bearer tok-1');
  now += 3600 * 1000;
  await client.listProducts();
  assert.equal(tokens, 2, 'renova perto do vencimento');
});

test('401 renova o token uma única vez', async () => {
  let tokens = 0; let unauthorized = 0;
  const { fn } = mockFetch([
    [isToken, () => json(200, { access_token: `tok-${++tokens}`, expires_in: 3600 })],
    [u => u.pathname === HOTMART_API.products, (u, init) => init.headers.Authorization === 'Bearer tok-1' ? (unauthorized++, json(401, {})) : json(200, { items: [{ ucode: 'a' }] })],
  ]);
  const client = createHotmartApiClient({ env, fetch: fn });
  assert.deepEqual(await client.listProducts(), [{ ucode: 'a' }]);
  assert.deepEqual([tokens, unauthorized], [2, 1]);
  const always = mockFetch([[isToken, () => json(200, { access_token: 'x', expires_in: 3600 })], [() => true, () => json(401, {})]]);
  clearHotmartTokenCache();
  await assert.rejects(createHotmartApiClient({ env, fetch: always.fn }).listProducts(), { code: 'hotmart_api_unauthorized' });
});

test('paginação por page_token/next_page_token e catálogo com planos opcionais', async () => {
  const { fn, calls } = mockFetch([
    [isToken, () => json(200, { access_token: 't', expires_in: 3600 })],
    [u => u.pathname === HOTMART_API.products, () => json(200, { items: [{ id: 1, ucode: 'uc-1', name: 'Produto', is_subscription: false }] })],
    [u => u.pathname === HOTMART_API.plans('uc-1'), () => json(404, {})],
    [u => u.pathname === HOTMART_API.offers('uc-1'), u => u.searchParams.get('page_token') === 'p2'
      ? json(200, { items: [{ code: 'off2', name: 'Oferta 2', payment_mode: 'UNIQUE_PAYMENT' }], page_info: {} })
      : json(200, { items: [{ code: 'off1', name: 'Oferta 1', price: { value: 297, currency_code: 'BRL' }, is_active: true }], page_info: { next_page_token: 'p2' } })],
  ]);
  const catalog = await createHotmartApiClient({ env, fetch: fn }).catalog();
  assert.deepEqual(catalog.map(i => [i.productUcode, i.offerCode, i.priceValue, i.isSubscription]), [['uc-1', 'off1', 297, false], ['uc-1', 'off2', null, false]]);
  const offerCalls = calls.filter(c => new URL(c.url).pathname === HOTMART_API.offers('uc-1'));
  assert.deepEqual(offerCalls.map(c => new URL(c.url).searchParams.get('page_token')), [null, 'p2']);
  assert.equal(new URL(offerCalls[0].url).searchParams.get('max_results'), '50');
});

test('sem credenciais, rate limit e produção', async () => {
  await assert.rejects(createHotmartApiClient({ env: {}, fetch: async () => { throw new Error('no'); } }).listProducts(), { code: 'hotmart_credentials_missing' });
  const limited = mockFetch([[isToken, () => json(200, { access_token: 't', expires_in: 3600 })], [() => true, () => json(429, {})]]);
  await assert.rejects(createHotmartApiClient({ env, fetch: limited.fn }).listProducts(), { code: 'hotmart_rate_limited' });
  assert.equal(createHotmartApiClient({ env: { ...env, HOTMART_ENV: 'production' } }).environment, 'production');
  assert.equal(createHotmartApiClient({ env: { ...env, HOTMART_ENV: undefined } }).environment, 'sandbox');
});
