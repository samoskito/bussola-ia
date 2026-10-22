import type { AgentType } from '../agents';

export type MessageKind = 'initial_request' | 'question' | 'context' | 'refinement' | 'confirmation' | 'unclassifiable';
export type InsightAgentFilter = AgentType | 'all';
export type InsightPeriod = number | 'all';
export interface InsightFilters { days: InsightPeriod; agentType: InsightAgentFilter; topicId?: string; }
export interface InsightWindow { start: string; end: string; timezone: 'America/Sao_Paulo'; }
export interface SourceMessage {
  id: number; userId: string; chatId: string; agentType: AgentType;
  input: string; createdAt: string; userLevel: 'user' | 'admin' | null;
}
export interface TopicDefinition { id: string; label: string; description: string; }
export interface Classification {
  kind: MessageKind; topicIds: string[]; normalizedDemand: string;
  confidence: number; needsReview: boolean;
}
export interface ClassifiedMessage extends SourceMessage {
  classification: Classification; sourceHash: string; taxonomyVersion: string; classifierVersion: string;
}
export interface InsightSummary {
  eligibleMessages: number; classifiedMessages: number; pendingMessages: number;
  failedMessages: number; excludedAdminMessages: number; distinctUsers: number;
  distinctChats: number; coveragePercent: number;
}
export interface InsightTopic extends TopicDefinition {
  messages: number; distinctUsers: number; distinctChats: number; sharePercent: number; trendPercent: number | null;
}
export interface InsightExample {
  /** questionId is the source script id, readable in full via get_student_question (admins only). */
  id: string; questionId: number; topicId: string; agentType: AgentType; demand: string;
  kind: MessageKind; confidence: number; needsReview: boolean; createdAt: string;
}
export interface InsightReport {
  mode: 'demo' | 'live'; generatedAt: string; window: InsightWindow; filters: InsightFilters;
  summary: InsightSummary; topics: InsightTopic[];
  trend: Array<{ date: string; messages: number; classifiedMessages: number }>;
  agents: Array<{ agentType: AgentType; messages: number; distinctUsers: number; distinctChats: number }>;
  examples: InsightExample[];
  processing: { provider: 'mock' | 'openai'; state: 'demo' | 'disabled' | 'ready'; scheduleLabel: string; lastProcessedAt: string | null; };
}
