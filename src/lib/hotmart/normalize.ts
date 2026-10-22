import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Campos mínimos persistidos de um webhook Hotmart 2.0. CPF/documento,
 * endereço, valores de pagamento e o payload completo NUNCA são lidos para cá.
 */
export interface NormalizedHotmartEvent {
  eventId: string;
  eventType: string;
  eventVersion: string | null;
  eventCreatedAt: string;
  bodySha256: string;
  purchaseKey: string | null;
  transaction: string | null;
  subscriberCode: string | null;
  productId: string | null;
  productUcode: string | null;
  productName: string | null;
  offerCode: string | null;
  planId: string | null;
  planName: string | null;
  purchaseStatus: string | null;
  subscriptionStatus: string | null;
  recurrenceNumber: number | null;
  approvedAt: string | null;
  nextChargeAt: string | null;
  buyerEmail: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
}

/** Comparação em tempo constante (hash fixo dos dois lados). */
export function verifyHottok(received: string | null | undefined, expected: string | undefined): boolean {
  if (!expected || expected.trim().length < 8 || typeof received !== 'string' || !received) return false;
  const a = createHash('sha256').update(received, 'utf8').digest();
  const b = createHash('sha256').update(expected.trim(), 'utf8').digest();
  return timingSafeEqual(a, b);
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const clean = (value: unknown, max: number): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) value = String(value);
  if (typeof value !== 'string') return null;
  const result = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return result && result.length <= max ? result : null;
};
const first = (...values: (string | null)[]) => values.find(value => value !== null) ?? null;

/** Datas Hotmart chegam como epoch em milissegundos; ISO também é aceito. */
export function hotmartDate(value: unknown): string | null {
  let date: Date | null = null;
  if (typeof value === 'number' && Number.isFinite(value)) date = new Date(value < 1e11 ? value * 1000 : value);
  else if (typeof value === 'string' && /^\d{10,13}$/.test(value)) date = new Date(Number(value) < 1e11 ? Number(value) * 1000 : Number(value));
  else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) date = new Date(value);
  if (!date || !Number.isFinite(date.getTime())) return null;
  const year = date.getUTCFullYear();
  return year >= 2000 && year <= 2200 ? date.toISOString() : null;
}

export function normalizeEmail(value: unknown): string | null {
  const email = clean(value, 254)?.toLowerCase() ?? null;
  return email && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : null;
}

function phone(value: unknown): string | null {
  const record = obj(value);
  if (record) {
    // Formatos observados: {ddi, ddd, number} / {country_code, local_code, number}.
    const parts = ['ddi', 'country_code', 'ddd', 'local_code', 'number', 'phone']
      .map(key => clean(record[key], 20)).filter((part): part is string => part !== null);
    value = parts.join(' ');
  }
  const result = clean(value, 30);
  return result && /^[+\d\s().-]{5,30}$/.test(result) && /\d{5,}/.test(result.replace(/\D/g, '')) ? result : null;
}

function personName(record: Obj | null): string | null {
  if (!record) return null;
  const direct = clean(record.name, 150);
  if (direct) return direct;
  const joined = [clean(record.first_name, 80), clean(record.last_name, 80)].filter(Boolean).join(' ');
  return clean(joined, 150);
}

/** Retorna null quando a raiz não tem id/evento/data válidos. */
export function normalizeHotmartEvent(body: unknown, rawBody: string): NormalizedHotmartEvent | null {
  const root = obj(body);
  if (!root) return null;
  const eventId = clean(root.id, 200);
  const eventType = clean(root.event, 80)?.toUpperCase() ?? null;
  const eventCreatedAt = hotmartDate(root.creation_date);
  if (!eventId || !eventType || !/^[A-Z0-9_]{1,80}$/.test(eventType) || !eventCreatedAt) return null;
  const data = obj(root.data) ?? {};
  const product = obj(data.product);
  const purchase = obj(data.purchase);
  const subscription = obj(data.subscription);
  const subscriptionPlan = obj(subscription?.plan) ?? obj(data.plan);
  // SUBSCRIPTION_CANCELLATION traz subscriber na raiz de data; SWITCH_PLAN usa
  // subscription.subscriber_code/user; demais usam subscription.subscriber.
  const subscriber = obj(subscription?.subscriber) ?? obj(data.subscriber);
  const switchUser = obj(subscription?.user) ?? obj(data.user);
  const buyer = obj(data.buyer) ?? subscriber ?? switchUser;
  const plans = Array.isArray(data.plans) ? data.plans.map(obj).filter((item): item is Obj => item !== null) : [];
  const currentPlan = plans.find(plan => plan.current === true) ?? null;
  const subscriberCode = first(clean(subscriber?.code, 200), clean(subscription?.subscriber_code, 200));
  const transaction = clean(purchase?.transaction, 200);
  const dates = obj(data.dates);
  const switchProduct = obj(subscription?.product);
  return {
    eventId,
    eventType,
    eventVersion: clean(root.version, 20),
    eventCreatedAt,
    bodySha256: sha256Hex(rawBody),
    purchaseKey: subscriberCode ? `sub:${subscriberCode}` : transaction ? `tx:${transaction}` : null,
    transaction,
    subscriberCode,
    productId: first(clean(product?.id, 100), clean(switchProduct?.id, 100)),
    productUcode: first(clean(product?.ucode, 100), clean(switchProduct?.ucode, 100)),
    productName: first(clean(product?.name, 300), clean(switchProduct?.name, 300)),
    offerCode: first(clean(obj(purchase?.offer)?.code, 100), clean(obj(currentPlan?.offer)?.key, 100), clean(obj(currentPlan?.offer)?.code, 100)),
    planId: first(clean(subscriptionPlan?.id, 100), clean(currentPlan?.plan_id, 100), clean(currentPlan?.id, 100)),
    planName: first(clean(subscriptionPlan?.name, 300), clean(currentPlan?.name, 300)),
    purchaseStatus: clean(purchase?.status, 60)?.toUpperCase() ?? null,
    subscriptionStatus: clean(subscription?.status, 60)?.toUpperCase() ?? null,
    recurrenceNumber: Number.isInteger(purchase?.recurrence_number) ? purchase!.recurrence_number as number : null,
    approvedAt: hotmartDate(purchase?.approved_date),
    nextChargeAt: first(hotmartDate(purchase?.date_next_charge), hotmartDate(data.date_next_charge),
      hotmartDate(subscription?.date_next_charge), hotmartDate(dates?.next_charge)),
    buyerEmail: normalizeEmail(buyer?.email),
    buyerName: personName(buyer),
    buyerPhone: phone(buyer?.checkout_phone) ?? phone(buyer?.phone) ?? phone(buyer?.cellphone),
  };
}
