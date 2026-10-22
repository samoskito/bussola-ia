import { HOTMART_AGENT_TYPES, HotmartError } from './config';
import type { HotmartApiClient } from './api';
import type { HotmartRepository, ReviewDetail } from './repository';
import { planReviewAcceptance, type ReviewProposal } from './rules';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = (message: string): never => { throw new HotmartError(400, 'invalid_input', message); };
export const requireUuid = (value: unknown, name = 'Identificador'): string => typeof value === 'string' && uuid.test(value) ? value : invalid(`${name} inválido.`);
const EVENT_STATUSES = ['', 'received', 'processing', 'shadow_planned', 'applied', 'review', 'ignored', 'failed'];
const REVIEW_STATUSES = ['', 'open', 'accepted', 'kept', 'dismissed'];

export function validateOfferConfig(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Configuração inválida.');
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some(key => !['agentTypes', 'accessKind', 'durationDays', 'graceDays'].includes(key))) invalid('Campos inválidos.');
  const agents = body.agentTypes;
  if (!Array.isArray(agents) || new Set(agents).size !== agents.length || agents.some(a => !(HOTMART_AGENT_TYPES as readonly string[]).includes(a))) invalid('Selecione IAs válidas.');
  const accessKind = body.accessKind ?? null;
  if (accessKind !== null && accessKind !== 'single' && accessKind !== 'subscription') invalid('Tipo de acesso inválido.');
  const int = (value: unknown, min: number, max: number, name: string) => {
    if (value === null || value === undefined || value === '') return null;
    if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) invalid(`${name} inválido.`);
    return value as number;
  };
  const durationDays = int(body.durationDays, 1, 3650, 'Prazo em dias');
  const graceDays = int(body.graceDays, 0, 60, 'Tolerância');
  if (accessKind === null && (agents as unknown[]).length) invalid('Escolha compra única ou assinatura.');
  if (accessKind !== null && !(agents as unknown[]).length) invalid('Selecione ao menos uma IA.');
  if (accessKind === 'single' && durationDays === null) invalid('Compra única exige prazo em dias.');
  return { agentTypes: agents as string[], accessKind, durationDays, graceDays };
}

export function createHotmartAdminService(repo: HotmartRepository, actor: string) {
  requireUuid(actor, 'Administrador');
  return {
    summary: () => repo.adminRead(actor, 'summary'),
    offers: () => repo.adminRead(actor, 'offers'),
    events: (status = '', limit = 50) => {
      if (!EVENT_STATUSES.includes(status) || !Number.isInteger(limit) || limit < 1 || limit > 200) invalid('Filtros inválidos.');
      return repo.adminRead(actor, 'events', { status, limit });
    },
    reviews: (status = '', limit = 50) => {
      if (!REVIEW_STATUSES.includes(status) || !Number.isInteger(limit) || limit < 1 || limit > 200) invalid('Filtros inválidos.');
      return repo.adminRead(actor, 'reviews', { status, limit });
    },
    async sync(api: HotmartApiClient) {
      const catalog = await api.catalog();
      const result = await repo.syncOffers(actor, catalog);
      return { ...result, environment: api.environment };
    },
    configureOffer: (offerId: string, input: unknown) => repo.configureOffer(actor, requireUuid(offerId, 'Oferta'), validateOfferConfig(input)),
    async resolveReview(reviewId: string, input: unknown) {
      requireUuid(reviewId, 'Revisão');
      if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Decisão inválida.');
      const { decision, note } = input as Record<string, unknown>;
      if (Object.keys(input as object).some(key => !['decision', 'note'].includes(key))) invalid('Campos inválidos.');
      if (decision !== 'accept' && decision !== 'keep' && decision !== 'dismiss') invalid('Decisão inválida.');
      if (typeof note !== 'string' || note.trim().length < 3 || note.length > 500 || /[\u0000-\u001f\u007f]/.test(note)) invalid('Informe o motivo da decisão.');
      for (let attempt = 0; attempt < 2; attempt++) {
        const review = await repo.adminRead<ReviewDetail>(actor, 'review', { id: reviewId });
        if (decision !== 'accept') return repo.resolveReview(actor, reviewId, decision as 'keep' | 'dismiss', note as string, null, null);
        if (!review.user) throw new HotmartError(400, 'review_without_user', 'Revisão sem usuário vinculado; use manter ou descartar.');
        const plan = planReviewAcceptance(review.proposal as ReviewProposal | null, review.user);
        if (!plan) throw new HotmartError(400, 'review_without_proposal', 'Esta revisão não tem proposta automática; ajuste pelo painel de usuários e use manter ou descartar.');
        try {
          return await repo.resolveReview(actor, reviewId, 'accept', note as string, review.user.revision, plan as Record<string, unknown>);
        } catch (error) {
          if (error instanceof HotmartError && error.code === 'revision_conflict' && attempt === 0) continue;
          throw error;
        }
      }
      throw new HotmartError(409, 'revision_conflict', 'O cadastro mudou. Atualize e tente novamente.');
    },
  };
}
