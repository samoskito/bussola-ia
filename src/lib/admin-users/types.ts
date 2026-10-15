import type { AgentType } from '../agents';

export type AdminUserStatus = 'active' | 'expired' | 'none';
export interface AdminUserAccess {
  agentType: AgentType;
  enabled: boolean;
  expiresAt: string | null;
  effective: boolean;
  source: 'admin' | 'global' | 'individual' | 'none';
}
export interface AdminUser {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  nivel: 'user' | 'admin';
  plano: string | null;
  data_expiracao: string | null;
  revision: number | string;
  status: AdminUserStatus;
  access: AdminUserAccess[];
  createdAt: string;
  invite: { status: 'none' | 'generated' | 'simulated_sent' | 'sent' | 'send_failed' | 'consumed' | 'expired'; expiresAt: string | null };
}
export interface AdminUserAudit {
  id: string;
  userId: string;
  actor: string;
  action: 'created' | 'profile_updated' | 'access_updated' | 'invite_generated' | 'invite_simulated_sent' | 'invite_sent' | 'invite_send_failed' | 'password_defined' | 'demo_password_confirmed';
  reason: string;
  createdAt: string;
  changes: Record<string, unknown>;
}
export interface AdminUserList {
  mode: 'demo' | 'live';
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
export interface CreateAdminUserInput {
  nome: string;
  email: string;
  telefone?: string | null;
  agentTypes?: AgentType[];
  expiresAt?: string | null;
  reason?: string;
}
export interface UpdateAdminUserInput {
  revision: number | string;
  nome?: string;
  email?: string;
  telefone?: string | null;
  reason?: string;
}
export interface UpdateAdminAccessInput {
  revision: number | string;
  access: { agentType: AgentType; enabled: boolean; expiresAt: string | null }[];
  reason: string;
}
export interface AdminInviteResult {
  user: AdminUser;
  invite: { url: string; expiresAt: string; simulated: boolean; action: 'generate' | 'send' };
}
