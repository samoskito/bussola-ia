const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, USER, OFFER, offer, snapshot, context } = require('./helpers.cjs');

const rules = load('rules');
const plan = (ctx, graceDays = 3) => rules.planHotmartEvent(ctx, { graceDays });
const access = (p, agent) => p.access?.find(a => a.agentType === agent);
const ownedGrant = (agentType, expiresAt, manual = { manualEnabled: false, manualExpiresAt: null }) => ({
  grant: { agentType, enabled: true, expiresAt },
  state: { agentType, materializedEnabled: true, materializedExpiresAt: expiresAt, ...manual },
});
function ownedUser(entries, purchases, extra = {}) {
  return snapshot({ grants: entries.map(e => e.grant), state: entries.map(e => e.state), purchases, ...extra });
}
const purchase = (overrides = {}) => ({
  purchaseKey: 'tx:HP0', userId: USER, productUcode: 'uc-prod', offerCode: 'off1', offerId: OFFER, kind: 'single',
  agentTypes: ['comunicacao', 'apresentacao'], status: 'active', accessUntil: '2027-01-10', nextCharge: null,
  grantedTransactions: ['HP0'], lastEventAt: '2026-01-10T12:00:00+00:00', lastEventType: 'PURCHASE_APPROVED', lastRecurrence: null, ...overrides,
});

test('aprovação nova: cria usuário, libera IAs da oferta pelo prazo e pede convite', () => {
  const p = plan(context());
  assert.equal(p.outcome, 'applied');
  assert.deepEqual(p.createUser, { email: 'comprador@example.invalid', nome: 'Comprador Teste', telefone: '+55 11 90000-0000' });
  assert.equal(p.invite, true);
  // Exatamente 365 dias inclusivos: 22/10/2026 a 21/10/2027.
  assert.equal(p.purchase.accessUntil, '2027-10-21');
  assert.deepEqual(p.purchase.grantedTransactions, ['HP1']);
  assert.deepEqual(p.access.map(a => [a.agentType, a.enabled, a.expiresAt]), [['comunicacao', true, '2027-10-21'], ['apresentacao', true, '2027-10-21']]);
  assert.equal(plan(context({ offer: offer({ durationDays: 1 }) })).purchase.accessUntil, '2026-10-22', '1 dia = só hoje');
  assert.equal(plan(context({ offer: offer({ durationDays: 30 }) })).purchase.accessUntil, '2026-11-20');
  assert.deepEqual(access(p, 'comunicacao').state, { manualEnabled: false, manualExpiresAt: null });
  assert.equal(p.convertToPersonal, undefined);
});

test('renovação: estende a partir do maior entre hoje e a validade atual', () => {
  const user = ownedUser([ownedGrant('comunicacao', '2027-01-10'), ownedGrant('apresentacao', '2027-01-10')], [purchase()]);
  const p = plan(context({ emailUser: user }));
  assert.equal(p.createUser, undefined);
  assert.equal(p.invite, undefined);
  assert.equal(p.purchase.purchaseKey, 'tx:HP1');
  assert.equal(p.purchase.accessUntil, '2028-01-10');
  assert.equal(access(p, 'comunicacao').expiresAt, '2028-01-10');
  // Validade vencida não é base: conta a partir de hoje.
  const expired = ownedUser([ownedGrant('comunicacao', '2026-01-01')], [purchase({ accessUntil: '2026-01-01', status: 'active' })]);
  assert.equal(plan(context({ emailUser: expired })).purchase.accessUntil, '2027-10-21');
});

test('duplicado da mesma transação (APPROVED → COMPLETE) não estende de novo', () => {
  const user = ownedUser([ownedGrant('comunicacao', '2027-10-22'), ownedGrant('apresentacao', '2027-10-22')],
    [purchase({ purchaseKey: 'tx:HP1', grantedTransactions: ['HP1'], accessUntil: '2027-10-22', lastEventAt: '2026-10-22T12:00:00+00:00' })]);
  const p = plan(context({ emailUser: user, event: { eventType: 'PURCHASE_COMPLETE', eventId: 'evt-2', eventCreatedAt: '2026-10-29T12:00:00.000Z' } }));
  assert.equal(p.purchase.accessUntil, '2027-10-22');
  assert.equal(p.purchase.lastEventType, 'PURCHASE_COMPLETE');
  assert.equal(p.access, undefined, 'nada a materializar');
});

test('reembolso e chargeback cortam na hora o acesso concedido pela Hotmart', () => {
  for (const eventType of ['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK']) {
    const user = ownedUser([ownedGrant('comunicacao', '2027-10-22'), ownedGrant('apresentacao', '2027-10-22')],
      [purchase({ purchaseKey: 'tx:HP1', grantedTransactions: ['HP1'], accessUntil: '2027-10-22' })]);
    const p = plan(context({ emailUser: user, event: { eventType, eventCreatedAt: '2026-10-23T12:00:00.000Z' } }));
    assert.equal(p.purchase.status, 'revoked');
    assert.equal(p.outcome, 'applied');
    assert.deepEqual(p.access.map(a => [a.agentType, a.enabled, a.expiresAt]), [['comunicacao', false, null], ['apresentacao', false, null]]);
  }
});

test('PROTEST corta como chargeback, mas aprovação posterior da mesma transação restaura', () => {
  const owned = [ownedGrant('comunicacao', '2027-10-22'), ownedGrant('apresentacao', '2027-10-22')];
  const user = ownedUser(owned, [purchase({ purchaseKey: 'tx:HP1', grantedTransactions: ['HP1'], accessUntil: '2027-10-22' })]);
  const disputed = plan(context({ emailUser: user, event: { eventType: 'PURCHASE_PROTEST', eventCreatedAt: '2026-10-23T12:00:00.000Z' } }));
  assert.equal(disputed.purchase.status, 'disputed');
  assert.equal(access(disputed, 'comunicacao').enabled, false);
  const after = snapshot({ grants: [{ agentType: 'comunicacao', enabled: false, expiresAt: null }, { agentType: 'apresentacao', enabled: false, expiresAt: null }],
    state: [{ agentType: 'comunicacao', materializedEnabled: false, materializedExpiresAt: null, manualEnabled: false, manualExpiresAt: null }, { agentType: 'apresentacao', materializedEnabled: false, materializedExpiresAt: null, manualEnabled: false, manualExpiresAt: null }],
    purchases: [disputed.purchase] });
  const restored = plan(context({ emailUser: after, event: { eventType: 'PURCHASE_COMPLETE', eventCreatedAt: '2026-10-30T12:00:00.000Z' } }));
  assert.equal(restored.purchase.status, 'active');
  assert.equal(access(restored, 'comunicacao').expiresAt, '2027-10-22');
  // Reembolso definitivo não volta automaticamente.
  const revoked = snapshot({ purchases: [{ ...disputed.purchase, status: 'revoked' }] });
  const again = plan(context({ emailUser: revoked, event: { eventType: 'PURCHASE_APPROVED', eventCreatedAt: '2026-10-30T12:00:00.000Z' } }));
  assert.equal(again.outcome, 'review');
  assert.equal(again.reviews[0].kind, 'grant_after_revocation');
});

test('assinatura: vale até a próxima cobrança + tolerância; cancelamento mantém até o fim do período sem estender', () => {
  const sub = { offer: offer({ accessKind: 'subscription', durationDays: null }), event: { purchaseKey: 'sub:S1', subscriberCode: 'S1', transaction: 'HP10', nextChargeAt: '2026-11-22T12:00:00.000Z', recurrenceNumber: 1 } };
  const approved = plan(context({ ...sub, emailUser: snapshot() }));
  assert.equal(approved.purchase.kind, 'subscription');
  assert.equal(approved.purchase.accessUntil, '2026-11-25');
  assert.equal(approved.purchase.nextCharge, '2026-11-22');
  const owned = snapshot({ grants: approved.access.map(a => ({ agentType: a.agentType, enabled: a.enabled, expiresAt: a.expiresAt })),
    state: approved.access.map(a => ({ agentType: a.agentType, materializedEnabled: a.enabled, materializedExpiresAt: a.expiresAt, manualEnabled: false, manualExpiresAt: null })), purchases: [approved.purchase] });
  const cancel = plan(context({ offer: null, emailUser: owned, event: { eventType: 'SUBSCRIPTION_CANCELLATION', purchaseKey: 'sub:S1', subscriberCode: 'S1', transaction: null, offerCode: null, nextChargeAt: '2026-11-22T12:00:00.000Z', eventCreatedAt: '2026-10-25T12:00:00.000Z' } }));
  assert.equal(cancel.purchase.status, 'canceled');
  assert.equal(cancel.purchase.accessUntil, '2026-11-22');
  assert.equal(access(cancel, 'comunicacao').expiresAt, '2026-11-22');
  const later = plan(context({ offer: null, emailUser: owned, event: { eventType: 'SUBSCRIPTION_CANCELLATION', purchaseKey: 'sub:S1', subscriberCode: 'S1', transaction: null, nextChargeAt: '2027-03-01T12:00:00.000Z', eventCreatedAt: '2026-10-25T12:00:00.000Z' } }));
  assert.equal(later.purchase.accessUntil, '2026-11-25', 'cancelamento nunca estende');
  // Recorrência paga: renova pela nova próxima cobrança.
  const renewal = plan(context({ ...sub, emailUser: owned, event: { ...sub.event, transaction: 'HP11', recurrenceNumber: 2, nextChargeAt: '2026-12-22T12:00:00.000Z', eventCreatedAt: '2026-11-22T12:00:00.000Z' } }));
  assert.equal(renewal.purchase.accessUntil, '2026-12-25');
  assert.deepEqual(renewal.purchase.grantedTransactions, ['HP10', 'HP11']);
});

test('atraso: tolerância configurável a partir do evento, depois corta (sem estender)', () => {
  const p0 = purchase({ purchaseKey: 'sub:S1', kind: 'subscription', accessUntil: '2026-12-25', grantedTransactions: ['HP10'] });
  const user = ownedUser([ownedGrant('comunicacao', '2026-12-25'), ownedGrant('apresentacao', '2026-12-25')], [p0]);
  const ev = { eventType: 'PURCHASE_DELAYED', purchaseKey: 'sub:S1', subscriberCode: 'S1', transaction: 'HP12', eventCreatedAt: '2026-11-23T12:00:00.000Z' };
  const p = plan(context({ emailUser: user, event: ev }));
  assert.equal(p.purchase.status, 'delayed');
  assert.equal(p.purchase.accessUntil, '2026-11-26');
  assert.equal(access(p, 'comunicacao').expiresAt, '2026-11-26');
  assert.equal(plan(context({ emailUser: user, event: ev, offer: offer({ graceDays: 7 }) })).purchase.accessUntil, '2026-11-30', 'tolerância por oferta');
  assert.equal(plan(context({ emailUser: user, event: ev }), 0).purchase.accessUntil, '2026-11-23', 'tolerância do servidor');
  // Status de assinatura OVERDUE em outro evento também conta como atraso.
  assert.equal(rules.classifyEvent({ eventType: 'PURCHASE_BILLET_PRINTED', subscriptionStatus: 'OVERDUE' }), 'delay');
});

test('acesso manual nunca é reduzido automaticamente: gera revisão e aceite aplica', () => {
  // Bônus manual até 31/12/2026 existia antes da compra; a Hotmart assumiu a linha.
  const user = ownedUser([ownedGrant('comunicacao', '2027-10-22', { manualEnabled: true, manualExpiresAt: '2026-12-31' }), ownedGrant('apresentacao', '2027-10-22')],
    [purchase({ purchaseKey: 'tx:HP1', grantedTransactions: ['HP1'], accessUntil: '2027-10-22' })]);
  const p = plan(context({ emailUser: user, event: { eventType: 'PURCHASE_REFUNDED', eventCreatedAt: '2026-10-23T12:00:00.000Z' } }));
  assert.equal(access(p, 'comunicacao').expiresAt, '2026-12-31', 'volta para o bônus manual');
  assert.equal(access(p, 'apresentacao').enabled, false);
  assert.equal(p.outcome, 'review');
  const review = p.reviews.find(r => r.kind === 'manual_access_kept');
  assert.deepEqual(review.proposal.agents, ['comunicacao']);
  // Aceite: corta também a parte manual.
  const now = snapshot({ grants: [{ agentType: 'comunicacao', enabled: true, expiresAt: '2026-12-31' }, { agentType: 'apresentacao', enabled: false, expiresAt: null }],
    state: [{ agentType: 'comunicacao', materializedEnabled: true, materializedExpiresAt: '2026-12-31', manualEnabled: true, manualExpiresAt: '2026-12-31' }, { agentType: 'apresentacao', materializedEnabled: false, materializedExpiresAt: null, manualEnabled: false, manualExpiresAt: null }],
    purchases: [p.purchase] });
  const accepted = rules.planReviewAcceptance(review.proposal, now);
  assert.deepEqual(accepted.access, [{ agentType: 'comunicacao', enabled: false, expiresAt: null, state: { manualEnabled: false, manualExpiresAt: null } }]);
});

test('linha alterada manualmente pelo admin depois da Hotmart vira manual e não é cortada', () => {
  const user = snapshot({ grants: [{ agentType: 'comunicacao', enabled: true, expiresAt: '2028-06-30' }],
    state: [{ agentType: 'comunicacao', materializedEnabled: true, materializedExpiresAt: '2027-10-22', manualEnabled: false, manualExpiresAt: null }],
    purchases: [purchase({ purchaseKey: 'tx:HP1', agentTypes: ['comunicacao'], grantedTransactions: ['HP1'], accessUntil: '2027-10-22' })] });
  assert.equal(rules.isHotmartOwned(user, 'comunicacao'), false);
  const p = plan(context({ emailUser: user, offer: offer({ agentTypes: ['comunicacao'] }), event: { eventType: 'PURCHASE_REFUNDED', eventCreatedAt: '2026-10-23T12:00:00.000Z' } }));
  assert.equal(access(p, 'comunicacao').expiresAt, '2028-06-30');
  assert.equal(p.reviews[0].kind, 'manual_access_kept');
});

test('plano global legado (n8n): converte só quando precisa estender, preservando as demais IAs', () => {
  // Base = validade atual (30/06/2027) + 365 dias.
  const global = snapshot({ user: { plano: 'Todas', data_expiracao: '2027-06-30' } });
  const p = plan(context({ emailUser: global }));
  assert.equal(p.convertToPersonal, true);
  assert.deepEqual(p.access.map(a => [a.agentType, a.expiresAt, !!a.state]), [
    ['comunicacao', '2028-06-29', true], ['apresentacao', '2028-06-29', true], ['conversas_dificeis', '2027-06-30', false], ['postagem', '2027-06-30', false]]);
  assert.deepEqual(access(p, 'comunicacao').state, { manualEnabled: true, manualExpiresAt: '2027-06-30' });
  // Global sem prazo já cobre a compra: só ledger, sem conversão.
  const unlimited = plan(context({ emailUser: snapshot({ user: { plano: 'Todas', data_expiracao: null } }) }));
  assert.equal(unlimited.convertToPersonal, undefined);
  assert.equal(unlimited.access, undefined);
  assert.ok(unlimited.purchase);
});

test('reembolso de compra anterior à integração (sem ledger) vai para revisão com proposta', () => {
  const global = snapshot({ user: { plano: 'Todas', data_expiracao: '2027-06-30' } });
  const p = plan(context({ emailUser: global, event: { eventType: 'PURCHASE_REFUNDED' } }));
  assert.equal(p.outcome, 'review');
  assert.equal(p.reviews[0].kind, 'revocation_without_ledger');
  assert.deepEqual(p.reviews[0].proposal.agents, ['comunicacao', 'apresentacao']);
  assert.equal(p.access, undefined);
  const accepted = rules.planReviewAcceptance(p.reviews[0].proposal, global);
  assert.equal(accepted.convertToPersonal, true);
  assert.deepEqual(accepted.access.map(a => [a.agentType, a.enabled]), [['comunicacao', false], ['apresentacao', false], ['conversas_dificeis', true], ['postagem', true]]);
  // Sem usuário: nada a revogar.
  assert.equal(plan(context({ event: { eventType: 'PURCHASE_REFUNDED' } })).outcome, 'ignored');
});

test('oferta não mapeada vai para revisão sem criar usuário nem acesso', () => {
  for (const o of [null, offer({ accessKind: null, agentTypes: [], durationDays: null })]) {
    const p = plan(context({ offer: o }));
    assert.equal(p.outcome, 'review');
    assert.equal(p.reviews[0].kind, 'unmapped_offer');
    assert.equal(p.createUser, undefined);
    assert.equal(p.access, undefined);
    assert.equal(p.purchase, undefined);
  }
  assert.equal(plan(context({ offer: null })).offerStub.offerCode, 'off1');
});

test('cadastro: preenche só campos vazios e sinaliza divergências', () => {
  const empty = plan(context({ emailUser: snapshot({ user: { nome: '  ', telefone: null } }) }));
  assert.deepEqual(empty.profileFill, { nome: 'Comprador Teste', telefone: '+55 11 90000-0000' });
  assert.equal(empty.reviews.length, 0);
  const divergent = plan(context({ emailUser: snapshot({ user: { nome: 'Outro Nome', telefone: '(11) 90000-0000' } }) }));
  assert.equal(divergent.profileFill, undefined, 'nunca sobrescreve');
  assert.deepEqual(divergent.reviews.map(r => r.details.field), ['nome'], 'telefone igual após normalização');
  assert.equal(divergent.outcome, 'applied', 'divergência cadastral não deixa o evento em revisão');
  assert.ok(divergent.purchase, 'acesso segue liberado mesmo com divergência cadastral');
});

test('eventos fora de ordem não regridem', () => {
  const user = ownedUser([ownedGrant('comunicacao', '2027-10-22')], [purchase({ purchaseKey: 'tx:HP1', grantedTransactions: ['HP1'], accessUntil: '2027-10-22', lastEventAt: '2026-10-25T12:00:00+00:00', status: 'revoked', lastEventType: 'PURCHASE_REFUNDED' })]);
  const lateApproval = plan(context({ emailUser: user, event: { eventCreatedAt: '2026-10-22T12:00:00.000Z' } }));
  assert.equal(lateApproval.outcome, 'ignored');
  assert.equal(lateApproval.purchase, undefined);
  const active = ownedUser([ownedGrant('comunicacao', '2027-10-22')], [purchase({ purchaseKey: 'tx:HP1', grantedTransactions: ['HP1'], accessUntil: '2027-10-22', lastEventAt: '2026-10-25T12:00:00+00:00' })]);
  const lateRefund = plan(context({ emailUser: active, event: { eventType: 'PURCHASE_REFUNDED', eventCreatedAt: '2026-10-20T12:00:00.000Z' } }));
  assert.equal(lateRefund.outcome, 'review');
  assert.equal(lateRefund.reviews[0].kind, 'stale_event');
  assert.equal(lateRefund.access, undefined);
  // Recorrência antiga chegando depois da nova também é ignorada.
  const sub = ownedUser([], [purchase({ purchaseKey: 'sub:S1', kind: 'subscription', lastRecurrence: 3, lastEventAt: '2026-10-01T00:00:00+00:00' })]);
  assert.equal(plan(context({ emailUser: sub, offer: offer({ accessKind: 'subscription' }), event: { purchaseKey: 'sub:S1', subscriberCode: 'S1', transaction: 'HPX', recurrenceNumber: 2 } })).outcome, 'ignored');
});

test('várias compras: acesso efetivo por IA é o maior entre as concessões ativas', () => {
  const a = purchase({ purchaseKey: 'tx:A', agentTypes: ['comunicacao'], accessUntil: '2027-03-01' });
  const b = purchase({ purchaseKey: 'tx:B', agentTypes: ['comunicacao', 'postagem'], accessUntil: '2027-09-01' });
  assert.deepEqual(rules.hotmartValue([a, b], 'comunicacao'), { enabled: true, expiresAt: '2027-09-01' });
  assert.deepEqual(rules.hotmartValue([a, { ...b, status: 'revoked' }], 'comunicacao'), { enabled: true, expiresAt: '2027-03-01' });
  assert.deepEqual(rules.hotmartValue([a], 'postagem'), rules.NONE);
  // Reembolso de B mantém A.
  const user = ownedUser([ownedGrant('comunicacao', '2027-09-01'), ownedGrant('postagem', '2027-09-01')], [a, b]);
  const p = plan(context({ emailUser: user, event: { eventType: 'PURCHASE_REFUNDED', purchaseKey: 'tx:B', transaction: 'B', eventCreatedAt: '2026-10-23T12:00:00.000Z' } }));
  assert.equal(access(p, 'comunicacao').expiresAt, '2027-03-01');
  assert.equal(access(p, 'postagem').enabled, false);
});

test('administrador comprador: registra ledger sem tocar acesso vitalício; identidade divergente vai para revisão', () => {
  const admin = plan(context({ emailUser: snapshot({ user: { nivel: 'admin' } }) }));
  assert.equal(admin.access, undefined);
  assert.ok(admin.purchase);
  const other = snapshot({ user: { id: '20000000-0000-4000-8000-000000000009' } });
  const mismatch = plan(context({ emailUser: snapshot(), purchaseUser: other }));
  assert.equal(mismatch.reviews[0].kind, 'identity_mismatch');
  assert.equal(mismatch.purchase, undefined);
});

test('eventos sem efeito comercial e troca de plano', () => {
  assert.equal(plan(context({ event: { eventType: 'PURCHASE_BILLET_PRINTED' } })).outcome, 'ignored');
  assert.equal(plan(context({ event: { eventType: 'PURCHASE_EXPIRED' } })).outcome, 'ignored');
  const sw = plan(context({ emailUser: snapshot(), event: { eventType: 'SWITCH_PLAN', subscriberCode: 'S1', purchaseKey: 'sub:S1' } }));
  assert.equal(sw.reviews[0].kind, 'switch_plan');
});

test('reembolso/chargeback/protesto recebido ANTES da aprovação bloqueia a liberação (novo e existente)', () => {
  const refund = [{ eventType: 'PURCHASE_REFUNDED', eventCreatedAt: '2026-10-25T12:00:00+00:00', transaction: 'HP1', purchaseKey: 'tx:HP1' }];
  const fresh = plan({ ...context(), revocations: refund });
  assert.equal(fresh.outcome, 'review');
  assert.equal(fresh.reviews[0].kind, 'grant_after_revocation');
  assert.equal(fresh.createUser, undefined, 'comprador novo não é criado');
  assert.equal(fresh.purchase, undefined);
  const existing = plan({ ...context({ emailUser: snapshot() }), revocations: refund });
  assert.deepEqual([existing.outcome, existing.access, existing.purchase], ['review', undefined, undefined]);
  // Reembolso da mesma transação bloqueia mesmo com data anterior; chargeback idem.
  assert.equal(plan({ ...context(), revocations: [{ ...refund[0], eventType: 'PURCHASE_CHARGEBACK', eventCreatedAt: '2026-10-01T00:00:00+00:00' }] }).outcome, 'review');
  // Protesto posterior bloqueia; protesto anterior (disputa resolvida) não.
  const protest = { eventType: 'PURCHASE_PROTEST', transaction: 'HP1', purchaseKey: 'tx:HP1' };
  assert.equal(plan({ ...context(), revocations: [{ ...protest, eventCreatedAt: '2026-10-23T00:00:00+00:00' }] }).outcome, 'review');
  assert.equal(plan({ ...context(), revocations: [{ ...protest, eventCreatedAt: '2026-10-20T00:00:00+00:00' }] }).outcome, 'applied');
  // Assinatura: reembolso posterior na mesma chave de compra (outra transação) também bloqueia.
  const sub = context({ offer: offer({ accessKind: 'subscription' }), event: { purchaseKey: 'sub:S1', subscriberCode: 'S1', transaction: 'HP10' } });
  assert.equal(plan({ ...sub, revocations: [{ eventType: 'PURCHASE_REFUNDED', eventCreatedAt: '2026-10-24T00:00:00+00:00', transaction: 'HP09', purchaseKey: 'sub:S1' }] }).outcome, 'review');
});

test('revisões stale_event/single_canceled guardam só a mudança e recusam aceite sobre compra que mudou', () => {
  const p0 = purchase({ purchaseKey: 'tx:HP1', grantedTransactions: ['HP1'], accessUntil: '2027-10-21', lastEventAt: '2026-10-25T12:00:00+00:00' });
  const user = ownedUser([ownedGrant('comunicacao', '2027-10-21'), ownedGrant('apresentacao', '2027-10-21')], [p0]);
  const stale = plan(context({ emailUser: user, event: { eventType: 'PURCHASE_REFUNDED', eventCreatedAt: '2026-10-20T12:00:00.000Z' } }));
  const proposal = stale.reviews[0].proposal;
  assert.deepEqual(proposal, { purchaseChange: { purchaseKey: 'tx:HP1', expectedLastEventAt: '2026-10-25T12:00:00+00:00', status: 'revoked' } });
  // Aceite com a compra inalterada: aplica sobre o estado atual (preserva transações).
  const accepted = rules.planReviewAcceptance(proposal, user);
  assert.equal(accepted.purchase.status, 'revoked');
  assert.deepEqual(accepted.purchase.grantedTransactions, ['HP1']);
  assert.deepEqual(accepted.access.map(a => [a.agentType, a.enabled]), [['comunicacao', false], ['apresentacao', false]]);
  // Compra evoluiu depois da revisão: 409 claro, nada é sobrescrito.
  const evolved = ownedUser([ownedGrant('comunicacao', '2028-10-20')], [{ ...p0, grantedTransactions: ['HP1', 'HP2'], accessUntil: '2028-10-20', lastEventAt: '2026-11-01T12:00:00+00:00' }]);
  assert.throws(() => rules.planReviewAcceptance(proposal, evolved), { status: 409, code: 'review_outdated' });
  assert.throws(() => rules.planReviewAcceptance(proposal, snapshot()), { code: 'review_outdated' });
  // single_canceled também guarda só a mudança.
  const single = plan(context({ emailUser: ownedUser([], [p0]), event: { eventType: 'PURCHASE_CANCELED', eventCreatedAt: '2026-10-26T12:00:00.000Z' } }));
  assert.deepEqual(single.reviews[0].proposal, { purchaseChange: { purchaseKey: 'tx:HP1', expectedLastEventAt: '2026-10-25T12:00:00+00:00', status: 'revoked' } });
  // Cancelamento antigo de assinatura: só o teto de validade, aplicado como mínimo do atual.
  const s0 = purchase({ purchaseKey: 'sub:S1', kind: 'subscription', accessUntil: '2026-12-25', lastEventAt: '2026-11-22T12:00:00+00:00' });
  const sUser = ownedUser([ownedGrant('comunicacao', '2026-12-25'), ownedGrant('apresentacao', '2026-12-25')], [s0]);
  const oldCancel = plan(context({ emailUser: sUser, event: { eventType: 'SUBSCRIPTION_CANCELLATION', purchaseKey: 'sub:S1', subscriberCode: 'S1', transaction: null, nextChargeAt: '2026-12-22T12:00:00.000Z', eventCreatedAt: '2026-11-10T12:00:00.000Z' } }));
  assert.deepEqual(oldCancel.reviews[0].proposal.purchaseChange, { purchaseKey: 'sub:S1', expectedLastEventAt: '2026-11-22T12:00:00+00:00', status: 'canceled', accessUntilCap: '2026-12-22' });
  assert.equal(rules.planReviewAcceptance(oldCancel.reviews[0].proposal, sUser).purchase.accessUntil, '2026-12-22');
});

test('troca de data de cobrança não estende assinatura em atraso', () => {
  const delayed = purchase({ purchaseKey: 'sub:S1', kind: 'subscription', status: 'delayed', accessUntil: '2026-11-26', nextCharge: '2026-11-22', lastEventAt: '2026-11-23T12:00:00+00:00' });
  const user = ownedUser([ownedGrant('comunicacao', '2026-11-26'), ownedGrant('apresentacao', '2026-11-26')], [delayed]);
  const ev = { eventType: 'UPDATE_SUBSCRIPTION_CHARGE_DATE', purchaseKey: 'sub:S1', subscriberCode: 'S1', transaction: null, nextChargeAt: '2026-12-10T12:00:00.000Z', eventCreatedAt: '2026-11-24T12:00:00.000Z' };
  const p = plan(context({ emailUser: user, event: ev }));
  assert.equal(p.purchase.accessUntil, '2026-11-26');
  assert.equal(p.purchase.nextCharge, '2026-12-10');
  assert.equal(p.access, undefined);
  // Status OVERDUE no próprio evento também não estende.
  const active = ownedUser([ownedGrant('comunicacao', '2026-11-25'), ownedGrant('apresentacao', '2026-11-25')], [{ ...delayed, status: 'active', accessUntil: '2026-11-25' }]);
  assert.equal(plan(context({ emailUser: active, event: { ...ev, subscriptionStatus: 'OVERDUE' } })).purchase.accessUntil, '2026-11-25');
  // Ativa e em dia: nova data + tolerância.
  assert.equal(plan(context({ emailUser: active, event: ev })).purchase.accessUntil, '2026-12-13');
});
