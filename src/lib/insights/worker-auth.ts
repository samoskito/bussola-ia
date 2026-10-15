import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { InsightsError } from './config';

/** Separate machine credential; an admin browser session cannot start paid jobs. */
export function verifyInsightsWorker(request: Request, env: Record<string, string | undefined> = process.env) {
  if (env.INSIGHTS_MODE !== 'live' || env.INSIGHTS_PROCESSING_ENABLED !== 'true' || env.INSIGHTS_OPENAI_ENABLED !== 'true') {
    throw new InsightsError(503, 'processing_disabled', 'Processamento de insights desativado.');
  }
  const secret = env.INSIGHTS_CRON_SECRET;
  if (!secret || secret.length < 32) throw new InsightsError(503, 'worker_configuration', 'Executor não configurado.');
  const authorization = request.headers.get('authorization') || '';
  const expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(authorization);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new InsightsError(401, 'unauthenticated', 'Credencial do executor inválida.');
  }
}
