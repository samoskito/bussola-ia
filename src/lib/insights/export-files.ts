// Isomorphic helpers shared by the export endpoints and the admin dashboard.
import type { InsightAgentFilter, InsightPeriod } from './types';

export type ExportFormat = 'csv' | 'json';
export type ExportKind = 'insights' | 'perguntas';

/** One file name for both the Content-Disposition header and the client link, so the
 * browser never has to reconcile two different names. ASCII only. */
export function exportFileName(input: { kind: ExportKind; mode: 'demo' | 'live'; days: InsightPeriod; agentType: InsightAgentFilter; topicId?: string; format: ExportFormat }): string {
  const period = input.days === 'all' ? 'todo-historico' : `${input.days}dias`;
  const agent = input.agentType === 'all' ? '' : `-${asciiSlug(input.agentType)}`;
  const topic = input.topicId ? asciiSlug(input.topicId) : '';
  return `${input.kind}-${input.mode === 'demo' ? 'demonstracao-' : ''}${period}${agent}${topic ? `-tema-${topic}` : ''}.${input.format}`;
}

/** Accents folded, anything outside [a-z0-9_-] collapsed to '-', bounded length. */
function asciiSlug(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export function attachmentHeader(fileName: string): string {
  return `attachment; filename="${fileName.replace(/[^A-Za-z0-9._-]/g, '_')}"`;
}

export const EXPORT_CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  json: 'application/json; charset=utf-8',
};
