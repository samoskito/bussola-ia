import { getHotmartMode, HotmartError } from './config';
import { normalizeHotmartEvent, verifyHottok } from './normalize';
import type { HotmartRepository } from './repository';

type Environment = Record<string, string | undefined>;
export const HOTMART_WEBHOOK_MAX_BYTES = 65536;

export interface WebhookRequestLike { headers: Headers; body?: ReadableStream<Uint8Array> | null; text?: () => Promise<string> }
export interface WebhookDeps {
  env?: Environment;
  repo: () => HotmartRepository;
  /** Agenda o processamento após a resposta (next/server `after`). */
  schedule: (task: () => Promise<unknown>) => void;
  process: (eventRow: string) => Promise<unknown>;
}

async function readBody(request: WebhookRequestLike): Promise<string> {
  const tooLarge = () => new HotmartError(413, 'body_too_large', 'Payload excede o limite.');
  if (!request.body) {
    const text = await (request.text?.() ?? Promise.resolve(''));
    if (Buffer.byteLength(text, 'utf8') > HOTMART_WEBHOOK_MAX_BYTES) throw tooLarge();
    return text;
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > HOTMART_WEBHOOK_MAX_BYTES) { await reader.cancel(); throw tooLarge(); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Valida o hottok antes de ler/registrar qualquer dado; registra o evento de
 * forma durável e idempotente e responde rápido. Processamento fica para depois.
 * Nunca registra hottok, corpo completo, CPF ou endereço.
 */
export async function handleHotmartWebhook(request: WebhookRequestLike, deps: WebhookDeps): Promise<{ status: number; body: Record<string, unknown> }> {
  const env = deps.env ?? process.env;
  const mode = getHotmartMode(env);
  if (mode === 'off') return { status: 503, body: { error: 'hotmart_webhook_disabled' } };
  if (!env.HOTMART_HOTTOK || env.HOTMART_HOTTOK.trim().length < 8) return { status: 503, body: { error: 'hotmart_webhook_not_configured' } };
  if (!verifyHottok(request.headers.get('x-hotmart-hottok'), env.HOTMART_HOTTOK)) return { status: 401, body: { error: 'invalid_hottok' } };
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '')) return { status: 415, body: { error: 'invalid_content_type' } };
  let raw: string;
  try { raw = await readBody(request); }
  catch (error) { return { status: error instanceof HotmartError ? error.status : 400, body: { error: error instanceof HotmartError ? error.code : 'invalid_body' } }; }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { status: 400, body: { error: 'invalid_json' } }; }
  const event = normalizeHotmartEvent(parsed, raw);
  if (!event) return { status: 400, body: { error: 'invalid_event' } };
  let ingested: { id: string; duplicate: boolean; status: string };
  try { ingested = await deps.repo().ingest(event, mode); }
  // 5xx faz a Hotmart reenviar; a idempotência absorve o reenvio.
  catch { return { status: 503, body: { error: 'storage_unavailable' } }; }
  if (!ingested.duplicate || ingested.status === 'received') {
    deps.schedule(() => deps.process(ingested.id).catch(() => undefined));
  }
  return { status: 200, body: { received: true, duplicate: ingested.duplicate } };
}
