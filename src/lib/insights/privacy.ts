import { createHash } from 'node:crypto';
import type { SourceMessage } from './types';

export const MAX_MESSAGE_CHARS = 6000;
export const MAX_CONTEXT_MESSAGES = 3;
export const MAX_CONTEXT_CHARS = 2000;
export const MAX_CONTEXT_AGE_MS = 3 * 86_400_000;

/** Best-effort minimization, never a claim that the text is anonymous. */
export function maskDirectIdentifiers(value: string): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]')
    .replace(/\bhttps?:\/\/[^\s<>]+|\bwww\.[^\s<>]+/gi, '[URL]')
    .replace(/\b\d{3}[.\s-]?\d{3}[.\s-]?\d{3}[-\s]?\d{2}\b/g, '[CPF]')
    .replace(/(?:\+?55[\s()-]?)?(?:\(?\d{2}\)?[\s-]?)?9?\d{4}[\s-]?\d{4}\b/g, '[TELEFONE]')
    .replace(new RegExp('\\b(?:meu nome [ée]|me chamo|sou o|sou a)\\s+[\\p{L}]+(?:\\s+[\\p{L}]+){0,2}', 'giu'), '[NOME]');
}

export interface PreparedInput {
  source: SourceMessage;
  context: Array<{ id: number; text: string }>;
  text: string;
  sourceHash: string;
}

/** Caller must supply current user levels; stale role information is unsafe. */
export function prepareInsightInput(
  source: SourceMessage,
  candidates: readonly SourceMessage[],
  taxonomyVersion: string,
  classifierVersion: string,
): PreparedInput {
  if (source.userLevel !== 'user') throw new Error('source_not_eligible');
  if (!Number.isFinite(Date.parse(source.createdAt))) throw new Error('invalid_source_date');
  const sourceTime = Date.parse(source.createdAt);
  const text = source.input.trim();
  if (!text || text.length > MAX_MESSAGE_CHARS) throw new Error('source_length_out_of_range');
  const prior = candidates
    .filter(item => item.userLevel === 'user' && item.userId === source.userId && item.chatId === source.chatId && item.id !== source.id)
    .filter(item => {
      const time = Date.parse(item.createdAt);
      return Number.isFinite(time) && time >= sourceTime - MAX_CONTEXT_AGE_MS &&
        (time < sourceTime || (time === sourceTime && item.id < source.id));
    })
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id)
    .slice(-MAX_CONTEXT_MESSAGES);
  const context = prior.map(item => {
    const content = item.input.trim();
    if (!content || content.length > MAX_CONTEXT_CHARS) throw new Error('context_length_out_of_range');
    return { id: item.id, text: maskDirectIdentifiers(content) };
  });
  const minimized = maskDirectIdentifiers(text);
  const sourceHash = createHash('sha256').update(JSON.stringify({
    id: source.id, userId: source.userId, chatId: source.chatId,
    createdAt: new Date(sourceTime).toISOString(), agentType: source.agentType,
    text, context: prior.map(item => ({ id: item.id, text: item.input.trim() })),
    taxonomyVersion, classifierVersion,
  })).digest('hex');
  return { source, context, text: minimized, sourceHash };
}
