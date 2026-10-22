const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');

const { handleHotmartWebhook, HOTMART_WEBHOOK_MAX_BYTES } = load('webhook');
const { normalizeHotmartEvent, verifyHottok } = load('normalize');
const HOTTOK = 'hottok-sintetico-0123456789';

// Payload sintético no formato Webhook 2.0 com dados sensíveis que NÃO podem ser guardados.
const payload = (overrides = {}) => ({
  id: 'evt-abc', creation_date: 1792670400000, event: 'PURCHASE_APPROVED', version: '2.0.0',
  data: {
    product: { id: 111, ucode: 'uc-prod', name: 'Bússola' },
    buyer: { email: '  Comprador@Example.INVALID ', name: 'Comprador Teste', checkout_phone: '11900000000', document: '12345678909',
      address: { address: 'Rua Sigilosa', number: '99', zipcode: '01000000', city: 'São Paulo' } },
    purchase: { transaction: 'HP123', status: 'APPROVED', approved_date: 1792670400000, recurrence_number: 1, date_next_charge: 1795348800000,
      offer: { code: 'off1' }, price: { value: 297 }, payment: { type: 'CREDIT_CARD' } },
    subscription: { status: 'ACTIVE', plan: { id: 9, name: 'Mensal' }, subscriber: { code: 'SUB1' } },
    ...overrides.data,
  },
  ...overrides.root,
});

function request(body, headers = {}) {
  const h = new Headers({ 'content-type': 'application/json', ...headers });
  return { headers: h, body: null, text: async () => typeof body === 'string' ? body : JSON.stringify(body) };
}
function deps(overrides = {}) {
  const calls = { ingest: [], scheduled: [], processed: [] };
  const repo = { async ingest(event, mode) { calls.ingest.push({ event, mode }); return overrides.ingestResult ?? { id: 'row-1', duplicate: false, status: 'received' }; } };
  if (overrides.ingestError) repo.ingest = async () => { throw new Error('db down'); };
  return {
    calls,
    deps: { env: { HOTMART_WEBHOOK_MODE: 'shadow', HOTMART_HOTTOK: HOTTOK, ...overrides.env }, repo: () => repo, schedule: task => calls.scheduled.push(task), process: async id => calls.processed.push(id) },
  };
}

test('hottok: ausente, errado e certo (comparação em tempo constante)', async () => {
  assert.equal(verifyHottok(undefined, HOTTOK), false);
  assert.equal(verifyHottok('', HOTTOK), false);
  assert.equal(verifyHottok('errado', HOTTOK), false);
  assert.equal(verifyHottok(HOTTOK, HOTTOK), true);
  assert.equal(verifyHottok(HOTTOK, ''), false, 'sem hottok configurado nunca aceita');
  for (const header of [{}, { 'x-hotmart-hottok': 'errado' }]) {
    const { calls, deps: d } = deps();
    const result = await handleHotmartWebhook(request(payload(), header), d);
    assert.equal(result.status, 401);
    assert.equal(calls.ingest.length, 0, 'nada é registrado sem hottok válido');
  }
  const { calls, deps: d } = deps();
  const ok = await handleHotmartWebhook(request(payload(), { 'x-hotmart-hottok': HOTTOK }), d);
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body, { received: true, duplicate: false });
  assert.equal(calls.ingest[0].mode, 'shadow');
  assert.equal(calls.scheduled.length, 1, 'processamento agendado após responder');
  await calls.scheduled[0]();
  assert.deepEqual(calls.processed, ['row-1']);
});

test('modo off (padrão) e hottok não configurado recusam sem registrar', async () => {
  for (const env of [{ HOTMART_WEBHOOK_MODE: undefined }, { HOTMART_WEBHOOK_MODE: 'qualquer' }, { HOTMART_HOTTOK: '' }]) {
    const { calls, deps: d } = deps({ env });
    const result = await handleHotmartWebhook(request(payload(), { 'x-hotmart-hottok': HOTTOK }), d);
    assert.equal(result.status, 503);
    assert.equal(calls.ingest.length, 0);
  }
});

test('corpo inválido, grande demais ou sem JSON é recusado', async () => {
  const auth = { 'x-hotmart-hottok': HOTTOK };
  assert.equal((await handleHotmartWebhook(request('{', auth), deps().deps)).status, 400);
  assert.equal((await handleHotmartWebhook(request({ foo: 1 }, auth), deps().deps)).status, 400);
  assert.equal((await handleHotmartWebhook(request(payload(), { ...auth, 'content-type': 'text/plain' }), deps().deps)).status, 415);
  assert.equal((await handleHotmartWebhook(request('x'.repeat(HOTMART_WEBHOOK_MAX_BYTES + 1), auth), deps().deps)).status, 413);
});

test('duplicado é aceito com 200 sem reprocessar; falha do banco devolve 503 para a Hotmart reenviar', async () => {
  const auth = { 'x-hotmart-hottok': HOTTOK };
  const dup = deps({ ingestResult: { id: 'row-1', duplicate: true, status: 'applied' } });
  const result = await handleHotmartWebhook(request(payload(), auth), dup.deps);
  assert.deepEqual([result.status, result.body.duplicate, dup.calls.scheduled.length], [200, true, 0]);
  const pending = deps({ ingestResult: { id: 'row-1', duplicate: true, status: 'received' } });
  await handleHotmartWebhook(request(payload(), auth), pending.deps);
  assert.equal(pending.calls.scheduled.length, 1, 'duplicado ainda pendente é retomado');
  assert.equal((await handleHotmartWebhook(request(payload(), auth), deps({ ingestError: true }).deps)).status, 503);
});

test('normalização guarda só campos mínimos: sem CPF, endereço, preço ou payload completo', () => {
  const raw = JSON.stringify(payload());
  const event = normalizeHotmartEvent(JSON.parse(raw), raw);
  assert.equal(event.buyerEmail, 'comprador@example.invalid');
  assert.equal(event.purchaseKey, 'sub:SUB1');
  assert.equal(event.offerCode, 'off1');
  assert.equal(event.planId, '9');
  assert.equal(event.eventCreatedAt, new Date(1792670400000).toISOString());
  assert.match(event.bodySha256, /^[0-9a-f]{64}$/);
  const serialized = JSON.stringify(event);
  for (const secret of ['12345678909', 'Rua Sigilosa', '01000000', '297', 'CREDIT_CARD', HOTTOK]) assert.ok(!serialized.includes(secret), `não guarda ${secret}`);
  assert.deepEqual(Object.keys(event).sort(), ['approvedAt', 'bodySha256', 'buyerEmail', 'buyerName', 'buyerPhone', 'eventCreatedAt', 'eventId', 'eventType', 'eventVersion', 'nextChargeAt', 'offerCode', 'planId', 'planName', 'productId', 'productName', 'productUcode', 'purchaseKey', 'purchaseStatus', 'recurrenceNumber', 'subscriberCode', 'subscriptionStatus', 'transaction'].sort());
  // Compra única sem assinatura usa a transação como chave.
  const single = payload({ data: { subscription: undefined } });
  assert.equal(normalizeHotmartEvent(single, JSON.stringify(single)).purchaseKey, 'tx:HP123');
  // SUBSCRIPTION_CANCELLATION: formato próprio com subscriber na raiz de data.
  const cancel = { id: 'evt-c', creation_date: 1792670400000, event: 'SUBSCRIPTION_CANCELLATION', version: '2.0.0',
    data: { date_next_charge: 1795348800000, product: { id: 111, name: 'Bússola' }, subscriber: { code: 'SUB1', name: 'Comprador Teste', email: 'comprador@example.invalid' }, subscription: { id: 5, plan: { id: 9, name: 'Mensal' } } } };
  const c = normalizeHotmartEvent(cancel, JSON.stringify(cancel));
  assert.deepEqual([c.purchaseKey, c.buyerEmail, c.nextChargeAt !== null, c.transaction], ['sub:SUB1', 'comprador@example.invalid', true, null]);
});
