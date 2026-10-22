import { createHash, timingSafeEqual } from 'node:crypto';
import { getHotmartMode } from './config';
import type { HotmartRepository } from './repository';

type Environment = Record<string, string | undefined>;

/**
 * Recuperação de eventos parados (função encerrada depois do 200; a Hotmart
 * não reenvia). Seleciona received/failed com mais de N minutos e processing
 * com lease vencido (5 min), até `maxAttempts` tentativas. O claim de cada
 * evento continua sendo o lease: dois executores nunca processam o mesmo.
 */
export const HOTMART_RECOVERY = { olderThanMinutes: 10, maxAttempts: 5, limit: 20, budgetMs: 45000 } as const;

export async function reprocessStuckHotmartEvents(deps: {
  repo: HotmartRepository;
  process: (eventRow: string) => Promise<{ status: string }>;
  now?: () => number;
}) {
  const now = deps.now ?? (() => Date.now());
  const started = now();
  const ids = await deps.repo.pendingEvents(HOTMART_RECOVERY.olderThanMinutes, HOTMART_RECOVERY.maxAttempts, HOTMART_RECOVERY.limit);
  const results: { id: string; status: string }[] = [];
  for (const id of ids) {
    if (now() - started > HOTMART_RECOVERY.budgetMs) break;
    try { results.push({ id, status: (await deps.process(id)).status }); }
    catch { results.push({ id, status: 'error' }); }
  }
  return { pending: ids.length, processed: results.length, results };
}

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();

/** Bearer CRON_SECRET (padrão Vercel Cron) ou HOTMART_REPROCESS_SECRET, em tempo constante. */
export function verifyRecoveryAuthorization(header: string | null, env: Environment = process.env): 'ok' | 'unconfigured' | 'denied' {
  const secrets = [env.CRON_SECRET, env.HOTMART_REPROCESS_SECRET].map(value => value?.trim()).filter((value): value is string => !!value && value.length >= 16);
  if (!secrets.length) return 'unconfigured';
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return 'denied';
  let match = false;
  for (const secret of secrets) match = timingSafeEqual(digest(token), digest(secret)) || match;
  return match ? 'ok' : 'denied';
}

export async function handleHotmartRecovery(authorization: string | null, deps: {
  env?: Environment;
  repo: () => HotmartRepository;
  process: (eventRow: string) => Promise<{ status: string }>;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const env = deps.env ?? process.env;
  // Inofensivo com a integração desligada: nem autentica nem toca o banco.
  if (getHotmartMode(env) === 'off') return { status: 200, body: { skipped: 'hotmart_off' } };
  const auth = verifyRecoveryAuthorization(authorization, env);
  if (auth === 'unconfigured') return { status: 503, body: { error: 'recovery_secret_missing' } };
  if (auth === 'denied') return { status: 401, body: { error: 'unauthorized' } };
  try {
    const result = await reprocessStuckHotmartEvents({ repo: deps.repo(), process: deps.process });
    return { status: 200, body: { pending: result.pending, processed: result.processed, statuses: result.results.map(item => item.status) } };
  } catch {
    return { status: 503, body: { error: 'storage_unavailable' } };
  }
}
