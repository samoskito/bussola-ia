import { HOTMART_AGENT_TYPES, HotmartError, type HotmartAgentType } from './config';

/**
 * Motor de regras puro (sem IO). Recebe o contexto lido do banco e devolve o
 * plano de ação que o SQL aplica atomicamente (live) ou apenas registra (shadow).
 */
export type AgentValue = { enabled: boolean; expiresAt: string | null };
export const NONE: AgentValue = { enabled: false, expiresAt: null };

export interface SnapshotUser { id: string; email: string; nome: string | null; telefone: string | null; nivel: string | null; plano: string | null; data_expiracao: string | null }
export interface SnapshotGrant { agentType: string; enabled: boolean; expiresAt: string | null }
export interface SnapshotState { agentType: string; materializedEnabled: boolean; materializedExpiresAt: string | null; manualEnabled: boolean; manualExpiresAt: string | null }
export type PurchaseStatus = 'active' | 'canceled' | 'delayed' | 'disputed' | 'revoked';
export interface PurchaseRow {
  purchaseKey: string; userId?: string; productUcode: string | null; offerCode: string | null; offerId: string | null;
  kind: 'single' | 'subscription'; agentTypes: HotmartAgentType[]; status: PurchaseStatus;
  accessUntil: string | null; nextCharge: string | null; grantedTransactions: string[];
  lastEventAt: string; lastEventType: string; lastRecurrence: number | null;
}
export interface UserSnapshot { user: SnapshotUser; grants: SnapshotGrant[]; state: SnapshotState[]; purchases: PurchaseRow[]; revision: string }
export interface OfferConfig {
  id: string; productUcode: string; offerCode: string; productName?: string | null; offerName?: string | null;
  agentTypes: HotmartAgentType[]; accessKind: 'single' | 'subscription' | null; durationDays: number | null; graceDays: number | null;
}
export interface ContextEvent {
  id: string; eventId: string; eventType: string; eventCreatedAt: string; purchaseKey: string | null; transaction: string | null;
  subscriberCode: string | null; productId: string | null; productUcode: string | null; productName: string | null; offerCode: string | null;
  planId: string | null; planName: string | null; purchaseStatus: string | null; subscriptionStatus: string | null;
  recurrenceNumber: number | null; approvedAt: string | null; nextChargeAt: string | null;
  buyerEmail: string | null; buyerName: string | null; buyerPhone: string | null; mode: 'shadow' | 'live';
}
export interface RevocationEvent { eventType: string; eventCreatedAt: string; transaction: string | null; purchaseKey: string | null }
export interface EventContext {
  event: ContextEvent; offer: OfferConfig | null; emailUser: UserSnapshot | null; purchaseUser: UserSnapshot | null; today: string;
  /** Reembolsos/chargebacks/protestos já registrados da mesma transação ou compra. */
  revocations?: RevocationEvent[];
}

export interface AccessEntry { agentType: HotmartAgentType; enabled: boolean; expiresAt: string | null; state?: { manualEnabled: boolean; manualExpiresAt: string | null } }
export type ReviewKind = 'unmapped_offer' | 'manual_access_kept' | 'profile_divergence' | 'revocation_without_ledger' | 'stale_event'
  | 'grant_after_revocation' | 'switch_plan' | 'single_canceled' | 'identity_mismatch' | 'admin_buyer' | 'invalid_buyer' | 'invite_failed';
/** Mudança mínima na compra; aplicada sobre o estado ATUAL e só se a compra não mudou. */
export interface PurchaseChange { purchaseKey: string; expectedLastEventAt: string; status?: PurchaseStatus; accessUntilCap?: string | null }
export interface ReviewProposal {
  purchaseChange?: PurchaseChange;
  /** IAs cuja base manual é substituída por `baselineCaps` ao aceitar. */
  agents?: HotmartAgentType[];
  baselineCaps?: Partial<Record<HotmartAgentType, AgentValue>>;
  profileSet?: { nome?: string; telefone?: string };
}
export interface PlannedReview { kind: ReviewKind; details: Record<string, unknown>; proposal?: ReviewProposal; userId?: string }
export interface HotmartPlan {
  outcome: 'applied' | 'review' | 'ignored';
  action: string;
  summary: string;
  userId?: string;
  createUser?: { email: string; nome: string | null; telefone: string | null; passwordHash?: string };
  profileFill?: { nome?: string; telefone?: string };
  convertToPersonal?: boolean;
  access?: AccessEntry[];
  purchase?: PurchaseRow;
  reviews: PlannedReview[];
  invite?: boolean;
  offerStub?: { productId: string | null; productUcode: string; productName: string | null; offerCode: string; planId: string | null; planName: string | null; isSubscription: boolean };
}
export interface PlanOptions { graceDays: number }

// ---------------------------------------------------------------- datas
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
/** Data de calendário em America/Sao_Paulo de um instante ISO. */
export function saoPauloDate(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  return ['year', 'month', 'day'].map(name => parts.find(part => part.type === name)!.value).join('-');
}
/** Instantes chegam do SQL (+00:00) e do JS (Z): comparar sempre numericamente. */
const instant = (value: string) => Date.parse(value);
const maxDate = (...values: (string | null | undefined)[]) => values.filter((v): v is string => !!v).sort().pop() ?? null;
/** null = sem prazo; mínimo respeita essa semântica. */
const minExpiry = (a: string | null, b: string | null) => a === null ? b : b === null ? a : a < b ? a : b;

// ---------------------------------------------------------------- valores de acesso
/** Ordem: sem acesso < data (cronológica) < sem prazo. */
export function compareAccess(a: AgentValue, b: AgentValue): number {
  if (!a.enabled || !b.enabled) return Number(a.enabled) - Number(b.enabled);
  if (a.expiresAt === b.expiresAt) return 0;
  if (a.expiresAt === null) return 1;
  if (b.expiresAt === null) return -1;
  return a.expiresAt < b.expiresAt ? -1 : 1;
}
const normalizeValue = (value: AgentValue): AgentValue => value.enabled ? { enabled: true, expiresAt: value.expiresAt } : NONE;
const maxAccess = (a: AgentValue, b: AgentValue) => compareAccess(a, b) >= 0 ? normalizeValue(a) : normalizeValue(b);
const minAccess = (a: AgentValue, b: AgentValue) => compareAccess(a, b) <= 0 ? normalizeValue(a) : normalizeValue(b);
const sameRaw = (a: { enabled: boolean; expiresAt: string | null }, b: { enabled: boolean; expiresAt: string | null }) => a.enabled === b.enabled && (a.expiresAt ?? null) === (b.expiresAt ?? null);

const isGlobal = (user: SnapshotUser) => user.plano === 'Todas' || user.plano === 'Ambas';

/** Acesso que userHasAgentAccess concede hoje (ignorando a data atual). */
export function currentEffective(snapshot: UserSnapshot, agent: HotmartAgentType): AgentValue {
  const { user } = snapshot;
  if (user.nivel === 'admin') return { enabled: true, expiresAt: null };
  const cap = user.data_expiracao ?? null;
  if (isGlobal(user)) return { enabled: true, expiresAt: cap };
  const grant = snapshot.grants.find(item => item.agentType === agent);
  return grant?.enabled ? { enabled: true, expiresAt: minExpiry(cap, grant.expiresAt ?? null) } : NONE;
}

function rawGrant(snapshot: UserSnapshot, agent: HotmartAgentType) {
  const grant = snapshot.grants.find(item => item.agentType === agent);
  return grant ? { enabled: grant.enabled, expiresAt: grant.expiresAt ?? null } : { enabled: false, expiresAt: null };
}

/** A linha atual é exatamente o que a Hotmart gravou por último? */
export function isHotmartOwned(snapshot: UserSnapshot, agent: HotmartAgentType): boolean {
  if (isGlobal(snapshot.user) || snapshot.user.data_expiracao) return false;
  const state = snapshot.state.find(item => item.agentType === agent);
  return !!state && sameRaw(rawGrant(snapshot, agent), { enabled: state.materializedEnabled, expiresAt: state.materializedExpiresAt });
}

/** Base manual preservada: estado guardado (se a Hotmart é dona) ou o acesso atual. */
export function manualBaseline(snapshot: UserSnapshot, agent: HotmartAgentType): AgentValue {
  if (isHotmartOwned(snapshot, agent)) {
    const state = snapshot.state.find(item => item.agentType === agent)!;
    return normalizeValue({ enabled: state.manualEnabled, expiresAt: state.manualExpiresAt });
  }
  return currentEffective(snapshot, agent);
}

const counts = (status: PurchaseStatus) => status === 'active' || status === 'canceled' || status === 'delayed';
/** Maior concessão Hotmart ativa para a IA. */
export function hotmartValue(purchases: PurchaseRow[], agent: HotmartAgentType): AgentValue {
  return purchases.filter(p => counts(p.status) && p.agentTypes.includes(agent))
    .reduce<AgentValue>((acc, p) => maxAccess(acc, { enabled: true, expiresAt: p.accessUntil }), NONE);
}

/**
 * Materializa o acesso desejado = max(base manual, Hotmart). Conversão de
 * plano global/teto para Personalizado só quando necessária, preservando o
 * acesso efetivo atual das demais IAs (mesma regra do painel admin).
 */
export function materialize(snapshot: UserSnapshot, purchasesAfter: PurchaseRow[], baselineOverrides: Partial<Record<HotmartAgentType, AgentValue>> = {}) {
  const rows = HOTMART_AGENT_TYPES.map(agent => {
    const current = currentEffective(snapshot, agent);
    const override = baselineOverrides[agent];
    const baseline = override ? normalizeValue(override) : manualBaseline(snapshot, agent);
    const hotmart = hotmartValue(purchasesAfter, agent);
    const desired = maxAccess(baseline, hotmart);
    const state = snapshot.state.find(item => item.agentType === agent);
    const involved = hotmart.enabled || !!state || !!override;
    return { agent, current, baseline, hotmart, desired, involved, state };
  });
  if (snapshot.user.nivel === 'admin') return { rows, access: [] as AccessEntry[], convertToPersonal: false };
  const capped = isGlobal(snapshot.user) || !!snapshot.user.data_expiracao;
  const access: AccessEntry[] = [];
  let convertToPersonal = false;
  if (capped) {
    if (rows.some(row => row.involved && compareAccess(row.desired, row.current) !== 0)) {
      convertToPersonal = true;
      for (const row of rows) {
        const value = row.involved ? row.desired : row.current;
        access.push({ agentType: row.agent, ...value, ...(row.involved ? { state: { manualEnabled: row.baseline.enabled, manualExpiresAt: row.baseline.expiresAt } } : {}) });
      }
    }
  } else {
    for (const row of rows) {
      if (!row.involved) continue;
      const stateMatches = row.state && sameRaw({ enabled: row.state.materializedEnabled, expiresAt: row.state.materializedExpiresAt }, row.desired)
        && sameRaw({ enabled: row.state.manualEnabled, expiresAt: row.state.manualExpiresAt }, row.baseline);
      // Sem estado e sem mudança: a linha continua manual (base = atual), o que
      // é semanticamente igual a registrar estado; evita escrita desnecessária.
      if (sameRaw(rawGrant(snapshot, row.agent), row.desired) && !baselineOverrides[row.agent] && (!row.state || stateMatches)) continue;
      access.push({ agentType: row.agent, ...row.desired, state: { manualEnabled: row.baseline.enabled, manualExpiresAt: row.baseline.expiresAt } });
    }
  }
  return { rows, access, convertToPersonal };
}

// ---------------------------------------------------------------- classificação
const GRANT = new Set(['PURCHASE_APPROVED', 'PURCHASE_COMPLETE']);
const REVOKE = new Set(['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK', 'PURCHASE_PROTEST']);
const CANCEL = new Set(['SUBSCRIPTION_CANCELLATION', 'PURCHASE_CANCELED']);
export type EventClass = 'grant' | 'revoke' | 'cancel' | 'delay' | 'charge_date' | 'switch_plan' | 'ignored';
export function classifyEvent(event: Pick<ContextEvent, 'eventType' | 'subscriptionStatus'>): EventClass {
  if (GRANT.has(event.eventType)) return 'grant';
  if (REVOKE.has(event.eventType)) return 'revoke';
  if (CANCEL.has(event.eventType)) return 'cancel';
  if (event.eventType === 'PURCHASE_DELAYED') return 'delay';
  if (event.eventType === 'UPDATE_SUBSCRIPTION_CHARGE_DATE') return 'charge_date';
  if (event.eventType === 'SWITCH_PLAN') return 'switch_plan';
  // Outros eventos com assinatura em atraso também contam como atraso.
  if (event.subscriptionStatus === 'OVERDUE' || event.subscriptionStatus === 'DELAYED') return 'delay';
  return 'ignored';
}

const NAME_MAX = 150;
const normName = (value: string | null | undefined) => (value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
const normPhone = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');

function profilePlan(snapshot: UserSnapshot, event: ContextEvent, reviews: PlannedReview[]) {
  const fill: { nome?: string; telefone?: string } = {};
  const { user } = snapshot;
  const name = event.buyerName && event.buyerName.length <= NAME_MAX ? event.buyerName : null;
  if (name) {
    if (!user.nome?.trim()) fill.nome = name;
    else if (normName(user.nome) !== normName(name)) reviews.push({ kind: 'profile_divergence', details: { field: 'nome', hotmart: name, current: user.nome }, proposal: { profileSet: { nome: name } } });
  }
  if (event.buyerPhone) {
    if (!user.telefone?.trim()) fill.telefone = event.buyerPhone;
    else if (normPhone(user.telefone) !== normPhone(event.buyerPhone)) reviews.push({ kind: 'profile_divergence', details: { field: 'telefone', hotmart: event.buyerPhone, current: user.telefone }, proposal: { profileSet: { telefone: event.buyerPhone } } });
  }
  return Object.keys(fill).length ? fill : undefined;
}

const emptySnapshot = (email: string): UserSnapshot => ({ user: { id: '', email, nome: null, telefone: null, nivel: 'user', plano: 'Personalizado', data_expiracao: null }, grants: [], state: [], purchases: [], revision: '' });
const reducing = new Set<EventClass>(['revoke', 'cancel', 'delay', 'charge_date']);

function finish(plan: HotmartPlan): HotmartPlan {
  const writes = !!(plan.createUser || plan.profileFill || plan.purchase || plan.access?.length);
  // Divergência cadastral é informativa: não deixa um evento aplicado "em revisão".
  const blocking = plan.reviews.some(review => review.kind !== 'profile_divergence');
  plan.outcome = blocking ? 'review' : writes ? 'applied' : plan.reviews.length ? 'review' : 'ignored';
  return plan;
}

/** Plano de ação de um evento. Determinístico para o mesmo contexto. */
export function planHotmartEvent(context: EventContext, options: PlanOptions): HotmartPlan {
  const { event, offer, today } = context;
  const kind = classifyEvent(event);
  const plan: HotmartPlan = { outcome: 'ignored', action: kind, summary: '', reviews: [] };
  if (event.productUcode && event.offerCode && !offer) {
    plan.offerStub = { productId: event.productId, productUcode: event.productUcode, productName: event.productName, offerCode: event.offerCode, planId: event.planId, planName: event.planName, isSubscription: !!event.subscriberCode };
  }
  if (kind === 'ignored') { plan.summary = `Evento ${event.eventType} não altera acesso.`; return finish(plan); }

  // Identidade: e-mail normalizado; o ledger prevalece quando o e-mail mudou no app.
  if (context.emailUser && context.purchaseUser) {
    plan.reviews.push({ kind: 'identity_mismatch', userId: context.emailUser.user.id, details: { purchaseKey: event.purchaseKey, emailUserId: context.emailUser.user.id, purchaseUserId: context.purchaseUser.user.id } });
    plan.summary = 'Compra vinculada a outro usuário; revisão necessária.';
    return finish(plan);
  }
  const snapshot = context.emailUser ?? context.purchaseUser;
  const purchase = snapshot?.purchases.find(p => p.purchaseKey === event.purchaseKey) ?? null;
  if (snapshot) plan.userId = snapshot.user.id;
  const grace = offer?.graceDays ?? options.graceDays;
  const eventDate = saoPauloDate(event.eventCreatedAt);
  const yesterday = addDays(today, -1);

  if (kind === 'switch_plan') {
    plan.reviews.push({ kind: 'switch_plan', userId: snapshot?.user.id, details: { subscriberCode: event.subscriberCode, planId: event.planId, planName: event.planName, offerCode: event.offerCode } });
    plan.summary = 'Troca de plano: o admin decide o novo mapeamento.';
    return finish(plan);
  }

  // Fora de ordem: nunca regredir a partir de um evento mais antigo.
  const stale = !!purchase && (instant(event.eventCreatedAt) < instant(purchase.lastEventAt)
    || (kind === 'grant' && event.recurrenceNumber !== null && purchase.lastRecurrence !== null && event.recurrenceNumber < purchase.lastRecurrence));

  const configured = offer && offer.accessKind && offer.agentTypes.length ? offer : null;
  const base = (p: PurchaseRow): PurchaseRow => ({ ...p, lastEventAt: instant(event.eventCreatedAt) > instant(p.lastEventAt) ? event.eventCreatedAt : p.lastEventAt, lastEventType: event.eventType });
  let next: PurchaseRow | null = null;

  if (kind === 'grant') {
    if (stale) { plan.summary = 'Evento de liberação mais antigo que o último aplicado; ignorado.'; return finish(plan); }
    if (!configured) {
      plan.reviews.push({ kind: 'unmapped_offer', userId: snapshot?.user.id, details: { productUcode: event.productUcode, productName: event.productName, offerCode: event.offerCode, planId: event.planId } });
      plan.summary = 'Oferta não configurada; nenhuma liberação.';
      return finish(plan);
    }
    // Reembolso/chargeback da mesma transação (a qualquer tempo) ou qualquer
    // redução terminal/protesto posterior a esta liberação: não liberar.
    const blockers = (context.revocations ?? []).filter(item =>
      (!!event.transaction && item.transaction === event.transaction && item.eventType !== 'PURCHASE_PROTEST')
      || instant(item.eventCreatedAt) > instant(event.eventCreatedAt));
    if (blockers.length) {
      plan.reviews.push({ kind: 'grant_after_revocation', userId: snapshot?.user.id, details: { purchaseKey: event.purchaseKey, transaction: event.transaction, revocations: blockers.map(item => ({ eventType: item.eventType, eventCreatedAt: item.eventCreatedAt })) } });
      plan.summary = 'Já existe reembolso/chargeback/protesto para esta compra; liberação exige decisão do admin.';
      return finish(plan);
    }
    if (purchase?.status === 'revoked') {
      plan.reviews.push({ kind: 'grant_after_revocation', userId: snapshot?.user.id, details: { purchaseKey: purchase.purchaseKey, transaction: event.transaction } });
      plan.summary = 'Compra já reembolsada/estornada; liberação exige decisão do admin.';
      return finish(plan);
    }
    if (!snapshot && !event.buyerEmail) {
      plan.reviews.push({ kind: 'invalid_buyer', details: { reason: 'missing_email' } });
      plan.summary = 'Comprador sem e-mail válido.';
      return finish(plan);
    }
    const agents = configured.agentTypes;
    const accessKind = purchase?.kind ?? configured.accessKind!;
    const already = !!event.transaction && !!purchase?.grantedTransactions.includes(event.transaction);
    if (already && purchase) {
      next = { ...base(purchase), status: purchase.status === 'disputed' ? 'active' : purchase.status };
    } else {
      const working = snapshot ?? emptySnapshot(event.buyerEmail!);
      const nextCharge = event.nextChargeAt ? saoPauloDate(event.nextChargeAt) : null;
      let accessUntil: string | null;
      if (accessKind === 'subscription') {
        accessUntil = nextCharge ? addDays(nextCharge, grace)
          : addDays(maxDate(yesterday, purchase?.accessUntil)!, configured.durationDays ?? 31);
        if (purchase?.status === 'active') accessUntil = maxDate(accessUntil, purchase.accessUntil);
      } else {
        // Exatamente N dias (datas inclusivas): começando hoje termina em hoje+N-1;
        // renovação soma N dias após a validade atual (o maior entre as duas).
        const currentDates = agents.map(agent => currentEffective(working, agent)).filter(v => v.enabled && v.expiresAt && v.expiresAt >= today).map(v => v.expiresAt);
        accessUntil = addDays(maxDate(yesterday, purchase?.status === 'active' ? purchase.accessUntil : null, ...currentDates)!, configured.durationDays!);
      }
      next = {
        purchaseKey: event.purchaseKey ?? `tx:${event.eventId}`, productUcode: configured.productUcode, offerCode: configured.offerCode, offerId: configured.id,
        kind: accessKind, agentTypes: agents, status: 'active', accessUntil, nextCharge: nextCharge ?? purchase?.nextCharge ?? null,
        grantedTransactions: [...(purchase?.grantedTransactions ?? []), ...(event.transaction ? [event.transaction] : [])],
        lastEventAt: event.eventCreatedAt, lastEventType: event.eventType, lastRecurrence: event.recurrenceNumber ?? purchase?.lastRecurrence ?? null,
      };
    }
    if (!snapshot) {
      plan.createUser = { email: event.buyerEmail!, nome: event.buyerName, telefone: event.buyerPhone };
      plan.invite = true;
    } else {
      plan.profileFill = profilePlan(snapshot, event, plan.reviews);
    }
  } else {
    // revoke | cancel | delay | charge_date
    const singleCancel = kind === 'cancel' && event.eventType === 'PURCHASE_CANCELED' && !event.subscriberCode && (purchase?.kind ?? configured?.accessKind) !== 'subscription';
    if (!purchase) {
      if (kind === 'charge_date' || !snapshot || singleCancel) { plan.summary = 'Sem compra registrada para alterar.'; return finish(plan); }
      // Compra anterior à integração (ex.: liberada pelo n8n): admin decide.
      const caps: Partial<Record<HotmartAgentType, AgentValue>> = {};
      const nextCharge = event.nextChargeAt ? saoPauloDate(event.nextChargeAt) : null;
      const cap: AgentValue | null = kind === 'revoke' ? NONE : kind === 'cancel' ? (nextCharge ? { enabled: true, expiresAt: nextCharge } : null) : { enabled: true, expiresAt: addDays(eventDate, grace) };
      const agents = configured?.agentTypes ?? [];
      if (cap) for (const agent of agents) if (compareAccess(currentEffective(snapshot, agent), cap) > 0) caps[agent] = cap;
      if (!configured || Object.keys(caps).length) {
        plan.reviews.push({ kind: configured ? 'revocation_without_ledger' : 'unmapped_offer', details: { eventType: event.eventType, productUcode: event.productUcode, offerCode: event.offerCode, planId: event.planId },
          ...(configured ? { proposal: { agents: Object.keys(caps) as HotmartAgentType[], baselineCaps: caps } } : {}) });
      }
      plan.summary = 'Evento sem compra no ledger da integração; revisão manual.';
      return finish(plan);
    }
    if (singleCancel) {
      if (purchase.status === 'active') plan.reviews.push({ kind: 'single_canceled', details: { purchaseKey: purchase.purchaseKey }, proposal: { purchaseChange: { purchaseKey: purchase.purchaseKey, expectedLastEventAt: purchase.lastEventAt, status: 'revoked' } } });
      plan.summary = 'Cancelamento de compra única: revisão.';
      return finish(plan);
    }
    if (kind === 'revoke') {
      next = { ...base(purchase), status: event.eventType === 'PURCHASE_PROTEST' && purchase.status !== 'revoked' ? 'disputed' : 'revoked' };
    } else if (kind === 'cancel') {
      const end = event.nextChargeAt ? saoPauloDate(event.nextChargeAt) : purchase.nextCharge;
      next = { ...base(purchase), status: purchase.status === 'revoked' ? 'revoked' : 'canceled', accessUntil: end ? minExpiry(purchase.accessUntil, end) : purchase.accessUntil };
    } else if (kind === 'delay') {
      next = { ...base(purchase), status: purchase.status === 'active' ? 'delayed' : purchase.status, accessUntil: minExpiry(purchase.accessUntil, addDays(eventDate, grace)) };
    } else {
      const nextCharge = event.nextChargeAt ? saoPauloDate(event.nextChargeAt) : null;
      if (!nextCharge || purchase.status === 'revoked' || purchase.status === 'canceled') { plan.summary = 'Alteração de cobrança sem efeito.'; return finish(plan); }
      // Em atraso (sem pagamento) a troca de data nunca estende o acesso.
      const overdue = purchase.status === 'delayed' || event.subscriptionStatus === 'OVERDUE' || event.subscriptionStatus === 'DELAYED';
      next = { ...base(purchase), nextCharge, accessUntil: overdue ? minExpiry(purchase.accessUntil, addDays(nextCharge, grace)) : addDays(nextCharge, grace) };
    }
    if (stale) {
      // Guarda só a mudança; o aceite recalcula sobre o estado atual da compra.
      const change: PurchaseChange = { purchaseKey: purchase.purchaseKey, expectedLastEventAt: purchase.lastEventAt };
      if (next.status !== purchase.status) change.status = next.status;
      if (next.accessUntil !== purchase.accessUntil) change.accessUntilCap = next.accessUntil;
      plan.reviews.push({ kind: 'stale_event', details: { eventType: event.eventType, eventCreatedAt: event.eventCreatedAt, lastEventAt: purchase.lastEventAt },
        ...(kind !== 'charge_date' && (change.status || change.accessUntilCap !== undefined) ? { proposal: { purchaseChange: change } } : {}) });
      plan.summary = 'Evento de redução fora de ordem; revisão antes de aplicar.';
      return finish(plan);
    }
  }

  plan.purchase = next!;
  const working = snapshot ?? emptySnapshot(event.buyerEmail!);
  const before = working.purchases;
  const after = [...before.filter(p => p.purchaseKey !== next!.purchaseKey), next!];
  if (working.user.nivel === 'admin') {
    plan.summary = 'Comprador é administrador (acesso vitalício); somente ledger registrado.';
    return finish(plan);
  }
  const result = materialize(working, after);
  if (result.access.length) plan.access = result.access;
  if (result.convertToPersonal) plan.convertToPersonal = true;

  // Acesso manual nunca é reduzido automaticamente: gera revisão.
  if (reducing.has(kind)) {
    const kept = result.rows.filter(row => next!.agentTypes.includes(row.agent)
      && compareAccess(row.hotmart, hotmartValue(before, row.agent)) < 0 && compareAccess(row.desired, row.hotmart) > 0);
    if (kept.length) {
      plan.reviews.push({ kind: 'manual_access_kept', details: { eventType: event.eventType, kept: kept.map(row => ({ agentType: row.agent, current: row.desired, hotmartOnly: row.hotmart })) },
        proposal: { agents: kept.map(row => row.agent), baselineCaps: Object.fromEntries(kept.map(row => [row.agent, NONE])) } });
    }
  }
  plan.summary = `${event.eventType}: ${plan.access?.length ?? 0} IA(s) alteradas${plan.createUser ? ', usuário novo' : ''}.`;
  return finish(plan);
}

/** Plano de aceite de uma revisão, recalculado sobre o estado atual. */
export function planReviewAcceptance(proposal: ReviewProposal | null | undefined, snapshot: UserSnapshot) {
  if (!proposal) return null;
  const changes: { access?: AccessEntry[]; convertToPersonal?: boolean; profileSet?: { nome?: string; telefone?: string }; purchase?: PurchaseRow } = {};
  if (proposal.profileSet) changes.profileSet = proposal.profileSet;
  let purchases = snapshot.purchases;
  if (proposal.purchaseChange) {
    const change = proposal.purchaseChange;
    const current = snapshot.purchases.find(p => p.purchaseKey === change.purchaseKey);
    // Revisão antiga nunca sobrescreve uma compra que evoluiu depois dela.
    if (!current || instant(current.lastEventAt) !== instant(change.expectedLastEventAt)) {
      throw new HotmartError(409, 'review_outdated', 'A compra mudou desde que esta revisão foi criada. Reprocesse o evento ou descarte a revisão.');
    }
    const updated: PurchaseRow = {
      ...current,
      status: current.status === 'revoked' ? 'revoked' : change.status ?? current.status,
      accessUntil: change.accessUntilCap !== undefined ? minExpiry(current.accessUntil, change.accessUntilCap) : current.accessUntil,
    };
    purchases = [...snapshot.purchases.filter(p => p.purchaseKey !== current.purchaseKey), updated];
    changes.purchase = updated;
  }
  if ((proposal.agents?.length || proposal.purchaseChange) && snapshot.user.nivel !== 'admin') {
    const overrides: Partial<Record<HotmartAgentType, AgentValue>> = {};
    for (const agent of proposal.agents ?? []) overrides[agent] = proposal.baselineCaps?.[agent] ?? NONE;
    const result = materialize(snapshot, purchases, overrides);
    if (result.access.length) changes.access = result.access;
    if (result.convertToPersonal) changes.convertToPersonal = true;
  }
  return Object.keys(changes).length ? changes : null;
}
