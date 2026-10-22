import { HotmartError } from './config';
import type { NormalizedHotmartEvent } from './normalize';
import type { EventContext, HotmartPlan, UserSnapshot } from './rules';
import type { HotmartCatalogItem } from './api';

export interface HotmartRpcClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
}

export function mapHotmartRpcError(error: { code?: string; message?: string }): HotmartError {
  const code = error.message?.match(/(?:hotmart|admin_users):([a-z_]+)/)?.[1];
  if (code === 'revision_conflict' || error.code === '40001') return new HotmartError(409, 'revision_conflict', 'O cadastro mudou durante o processamento. Atualize e tente novamente.');
  if (code === 'forbidden' || error.code === '42501') return new HotmartError(403, 'forbidden', 'Operação Hotmart disponível apenas para administradores.');
  if (code === 'not_found' || error.code === 'P0002') return new HotmartError(404, 'not_found', 'Registro Hotmart não encontrado.');
  if (code === 'review_closed') return new HotmartError(409, 'review_closed', 'Esta revisão já foi resolvida.');
  if (code === 'identity_mismatch') return new HotmartError(409, 'identity_mismatch', 'A compra pertence a outro usuário.');
  if (code === 'invalid_input' || code === 'invalid_plan' || code === 'invalid_event' || error.code === '22023') return new HotmartError(400, code ?? 'invalid_input', 'Dados inválidos para a operação Hotmart.');
  if (code === 'admin_migrations_required') return new HotmartError(503, code, 'Migrations administrativas ausentes.');
  return new HotmartError(503, 'hotmart_storage_unavailable', 'Persistência Hotmart indisponível. Confira a migration.');
}

/** Adaptador RPC service-role. Nenhum SQL dinâmico no app. */
export function createHotmartRepository(client: HotmartRpcClient) {
  const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
    let result: Awaited<ReturnType<HotmartRpcClient['rpc']>>;
    try { result = await client.rpc(name, args); }
    catch { throw new HotmartError(503, 'hotmart_storage_unavailable', 'Persistência Hotmart indisponível.'); }
    if (result.error) throw mapHotmartRpcError(result.error);
    return result.data as T;
  };
  return {
    ingest: (event: NormalizedHotmartEvent, mode: 'shadow' | 'live') => rpc<{ id: string; duplicate: boolean; status: string }>('hotmart_ingest_event', { p_event: event, p_mode: mode }),
    claim: (eventRow: string, allowReview = false) => rpc<{ claimed: boolean; reason?: string }>('hotmart_claim_event', { p_event_row: eventRow, p_allow_review: allowReview }),
    fail: (eventRow: string, code: string) => rpc<void>('hotmart_fail_event', { p_event_row: eventRow, p_error_code: code }),
    context: (eventRow: string) => rpc<EventContext>('hotmart_event_context', { p_event_row: eventRow }),
    commit: (eventRow: string, expectedRevision: string | null, plan: HotmartPlan) => rpc<{ status: string; userId: string | null; userCreated?: boolean; invite: boolean }>('hotmart_commit_event', { p_event_row: eventRow, p_expected_revision: expectedRevision, p_plan: plan }),
    issueInvite: (userId: string, tokenHash: string, expiresAt: string, eventRow: string) => rpc<{ id: string; email: string; expiresAt: string }>('hotmart_issue_invite', { p_user_id: userId, p_token_hash: tokenHash, p_expires_at: expiresAt, p_event_row: eventRow }),
    inviteDelivery: (inviteId: string, status: 'sent' | 'failed', eventRow: string) => rpc<{ deliveryStatus: string }>('hotmart_invite_delivery', { p_invite_id: inviteId, p_status: status, p_event_row: eventRow }),
    adminRead: <T>(actor: string, resource: 'offers' | 'events' | 'reviews' | 'summary' | 'review', filters: Record<string, unknown> = {}) => rpc<T>('hotmart_admin_read', { p_actor: actor, p_resource: resource, p_filters: filters }),
    syncOffers: (actor: string, items: HotmartCatalogItem[]) => rpc<{ synced: number }>('hotmart_admin_sync_offers', { p_actor: actor, p_items: items }),
    configureOffer: (actor: string, offerId: string, config: Record<string, unknown>) => rpc<unknown>('hotmart_admin_configure_offer', { p_actor: actor, p_offer_id: offerId, p_config: config }),
    resolveReview: (actor: string, reviewId: string, decision: 'accept' | 'keep' | 'dismiss', note: string, expectedRevision: string | null, plan: Record<string, unknown> | null) =>
      rpc<{ status: string }>('hotmart_admin_resolve_review', { p_actor: actor, p_review_id: reviewId, p_decision: decision, p_note: note, p_expected_revision: expectedRevision, p_plan: plan }),
  };
}
export type HotmartRepository = ReturnType<typeof createHotmartRepository>;
export type ReviewDetail = { id: string; userId: string | null; kind: string; status: string; details: Record<string, unknown>; proposal: Record<string, unknown> | null; user: UserSnapshot | null };
