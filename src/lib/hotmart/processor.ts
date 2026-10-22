import { createHash, randomBytes } from 'node:crypto';
import { getHotmartGraceDays, HotmartError } from './config';
import type { HotmartRepository } from './repository';
import { planHotmartEvent, type HotmartPlan } from './rules';

type Environment = Record<string, string | undefined>;
export type FirstAccessSender = (mail: { to: string; url: string; expiresAt: string }) => Promise<void>;

export interface ProcessDeps {
  repo: HotmartRepository;
  env?: Environment;
  now?: () => Date;
  /** bcrypt(12) de um segredo aleatório que ninguém conhece. */
  hashPassword: (secret: string) => Promise<string>;
  /** Convite de primeiro acesso; ausente = não enviar (documentado). */
  invite?: { origin: () => string; send: FirstAccessSender } | null;
  allowReview?: boolean;
}

export interface ProcessResult { status: string; plan?: HotmartPlan; invite?: 'sent' | 'failed' | 'skipped' }

/** Processa um evento já registrado. Idempotente: só um processador o reserva. */
export async function processHotmartEvent(eventRow: string, deps: ProcessDeps): Promise<ProcessResult> {
  const { repo } = deps;
  const claim = await repo.claim(eventRow, deps.allowReview === true);
  if (!claim.claimed) return { status: `skipped:${claim.reason ?? 'unknown'}` };
  let committed: Awaited<ReturnType<HotmartRepository['commit']>> | null = null;
  let plan: HotmartPlan | undefined;
  try {
    for (let attempt = 0; attempt < 3 && !committed; attempt++) {
      const context = await repo.context(eventRow);
      plan = planHotmartEvent(context, { graceDays: getHotmartGraceDays(deps.env) });
      if (plan.createUser) plan.createUser.passwordHash = await deps.hashPassword(randomBytes(48).toString('base64url'));
      const snapshot = context.emailUser ?? context.purchaseUser;
      try {
        committed = await repo.commit(eventRow, snapshot?.revision ?? null, plan);
      } catch (error) {
        if (error instanceof HotmartError && error.code === 'revision_conflict' && attempt < 2) continue;
        throw error;
      }
    }
  } catch (error) {
    const code = error instanceof HotmartError ? error.code : 'processing_error';
    await repo.fail(eventRow, code).catch(() => undefined);
    return { status: 'failed', plan };
  }
  if (!committed) { await repo.fail(eventRow, 'revision_conflict').catch(() => undefined); return { status: 'failed', plan }; }
  if (plan?.createUser) delete plan.createUser.passwordHash;
  if (!committed.invite || !committed.userId) return { status: committed.status, plan };
  if (!deps.invite) return { status: committed.status, plan, invite: 'skipped' };

  // Convite: token aleatório; somente o hash vai ao banco. Link nunca é logado.
  const now = (deps.now ?? (() => new Date()))();
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  let issued: { id: string; email: string };
  let url: string;
  try {
    url = `${deps.invite.origin()}/auth/first-access#token=${token}`;
    issued = await repo.issueInvite(committed.userId, createHash('sha256').update(token).digest('hex'), expiresAt, eventRow);
  } catch {
    return { status: committed.status, plan, invite: 'failed' };
  }
  try {
    await deps.invite.send({ to: issued.email, url, expiresAt });
  } catch {
    await repo.inviteDelivery(issued.id, 'failed', eventRow).catch(() => undefined);
    return { status: committed.status, plan, invite: 'failed' };
  }
  await repo.inviteDelivery(issued.id, 'sent', eventRow).catch(() => undefined);
  return { status: committed.status, plan, invite: 'sent' };
}
