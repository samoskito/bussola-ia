// Harness TypeScript local. Testes Hotmart são offline: sem rede, banco ou e-mail.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '../..');
const stubs = new Map();
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'server-only') return {};
  if (stubs.has(request)) return stubs.get(request);
  for (const [key, value] of stubs) if (key.startsWith('*') && request.endsWith(key.slice(1))) return value;
  if (request.startsWith('@/')) request = path.join(root, 'src', request.slice(2));
  if (/nodemailer|smtp/i.test(request)) throw new Error(`Hotmart tests must not load mail transports: ${request}`);
  return originalLoad.call(this, request, parent, isMain);
};
require.extensions['.ts'] = function (module, filename) {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  });
  module._compile(result.outputText, filename);
};
global.fetch = async () => { throw new Error('Network is prohibited in Hotmart tests'); };

const load = name => require(path.join(root, 'src/lib/hotmart', `${name}.ts`));
const stub = (request, value) => stubs.set(request, value);

const USER = '20000000-0000-4000-8000-000000000002';
const ADMIN = '20000000-0000-4000-8000-000000000001';
const OFFER = '30000000-0000-4000-8000-000000000001';

/** Evento de contexto sintético (formato devolvido por hotmart_event_context). */
function event(overrides = {}) {
  return {
    id: '40000000-0000-4000-8000-000000000001', eventId: 'evt-1', eventType: 'PURCHASE_APPROVED', eventCreatedAt: '2026-10-22T12:00:00.000Z',
    purchaseKey: 'tx:HP1', transaction: 'HP1', subscriberCode: null, productId: '111', productUcode: 'uc-prod', productName: 'Bússola',
    offerCode: 'off1', planId: null, planName: null, purchaseStatus: 'APPROVED', subscriptionStatus: null, recurrenceNumber: null,
    approvedAt: '2026-10-22T12:00:00.000Z', nextChargeAt: null, buyerEmail: 'comprador@example.invalid', buyerName: 'Comprador Teste',
    buyerPhone: '+55 11 90000-0000', mode: 'live', ...overrides,
  };
}
function offer(overrides = {}) {
  return { id: OFFER, productUcode: 'uc-prod', offerCode: 'off1', agentTypes: ['comunicacao', 'apresentacao'], accessKind: 'single', durationDays: 365, graceDays: null, ...overrides };
}
function snapshot(overrides = {}) {
  const { user = {}, ...rest } = overrides;
  return {
    user: { id: USER, email: 'comprador@example.invalid', nome: 'Comprador Teste', telefone: '+55 11 90000-0000', nivel: 'user', plano: 'Personalizado', data_expiracao: null, ...user },
    grants: [], state: [], purchases: [], revision: 'rev-1', ...rest,
  };
}
function context(overrides = {}) {
  return { event: event(overrides.event), offer: overrides.offer === undefined ? offer() : overrides.offer, emailUser: overrides.emailUser === undefined ? null : overrides.emailUser, purchaseUser: overrides.purchaseUser ?? null, today: overrides.today ?? '2026-10-22' };
}

module.exports = { fs, path, root, load, stub, USER, ADMIN, OFFER, event, offer, snapshot, context };
