import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { AGENTS, type AgentType } from '../agents';
import { createServerSupabaseClient } from '../supabase/server';
import { AdminUsersError, requireAdminUsersEnabled, requireAdminUsersWrites } from './config';
import type { AdminUsersListInput } from './domain';
import type { AdminUser, AdminUserAudit, AdminUserList, CreateAdminUserInput, UpdateAdminUserInput, UpdateAdminAccessInput } from './types';

/** Prepared adapter. No constructor IO; each operation still requires explicit live gates. */
export interface AdminUsersRpcClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const agents = AGENTS.map(agent => agent.type);
const invalid = (message: string): never => { throw new AdminUsersError(400, 'invalid_input', message); };
const uuid = (value: unknown): string => typeof value === 'string' && uuidPattern.test(value) ? value : invalid('Identificação de usuário inválida.');
function allow(value: unknown, fields: string[]): void {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) invalid('Campos inválidos para esta operação.');
}
const text = (value: unknown, name: string, max: number): string => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u001f\u007f]/.test(value)) invalid(`${name} inválido.`);
  return (value as string).trim();
};
const email = (value: unknown) => {
  const result = text(value, 'E-mail', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) invalid('E-mail inválido.');
  return result;
};
const phone = (value: unknown): string | null => {
  if (value === null || value === '') return null;
  const result = text(value, 'Telefone', 30);
  if (!/^[+\d\s().-]{5,30}$/.test(result)) invalid('Telefone inválido.');
  return result;
};
const calendarDate = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  return ['year', 'month', 'day'].map(name => parts.find(part => part.type === name)!.value).join('-');
};
const expiry = (value: unknown): string | null => {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid('Data de validade inválida.');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) invalid('Data de validade inválida.');
  return value as string;
};
const agentTypes = (value: unknown): AgentType[] => {
  if (!Array.isArray(value) || value.length > agents.length || new Set(value).size !== value.length || value.some(item => !agents.includes(item))) invalid('Selecione IAs válidas, sem duplicações.');
  return value as AgentType[];
};
const revision = (value: unknown): string => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value) ? value : invalid('A revisão não corresponde a uma ficha real. Atualize o usuário.');
const reason = (value: unknown) => text(value, 'Motivo', 500);
const access = (input: { agentTypes?: unknown; expiresAt?: unknown }) => {
  const selected = agentTypes(input.agentTypes ?? []), expiresAt = expiry(input.expiresAt ?? null);
  if (selected.length && expiresAt && expiresAt < calendarDate()) invalid('A validade do acesso deve ser hoje ou uma data futura.');
  return { agentTypes: selected, expiresAt };
};

export function mapAdminUsersRpcError(error: { code?: string; message?: string }): AdminUsersError {
  const code = error.message?.match(/admin_users:([a-z_]+)/)?.[1];
  const messages: Record<string, [number, string]> = {
    forbidden: [403, 'Administração de usuários disponível apenas para administradores.'],
    not_found: [404, 'Usuário não encontrado.'],
    revision_conflict: [409, 'Este usuário mudou. Atualize a ficha antes de salvar.'],
    duplicate_email: [409, 'Já existe um usuário com este e-mail.'],
    admin_target_locked: [403, 'Contas administrativas não podem ser alteradas por este painel.'],
    invalid_input: [400, 'Dados inválidos para esta operação.'],
  };
  if (code && messages[code]) return new AdminUsersError(messages[code][0], code, messages[code][1]);
  if (error.code === '23505') return new AdminUsersError(409, 'record_conflict', 'Houve um conflito no cadastro. Atualize os dados antes de tentar novamente.');
  return new AdminUsersError(503, 'admin_users_storage_unavailable', 'Persistência administrativa indisponível. Confira a preparação do banco.');
}

export function createLiveAdminUsersRepository(providedClient?: AdminUsersRpcClient) {
  const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
    let result: Awaited<ReturnType<AdminUsersRpcClient['rpc']>>;
    try { result = await (providedClient ?? createServerSupabaseClient()).rpc(name, args); }
    catch { throw new AdminUsersError(503, 'admin_users_storage_unavailable', 'Persistência administrativa indisponível.'); }
    if (result.error) throw mapAdminUsersRpcError(result.error);
    if (result.data === null || result.data === undefined) throw new AdminUsersError(503, 'admin_users_storage_unavailable', 'Resposta administrativa inválida.');
    return result.data as T;
  };
  const readGate = () => {
    requireAdminUsersEnabled();
    if (process.env.ADMIN_USERS_MODE !== 'live') throw new AdminUsersError(503, 'admin_users_storage_unavailable', 'Persistência real não foi selecionada.');
  };
  const writeGate = () => { readGate(); requireAdminUsersWrites(); };
  return {
    async list(input: AdminUsersListInput = {}, actor: string): Promise<AdminUserList> {
      readGate(); uuid(actor); allow(input, ['q', 'agentType', 'status', 'page', 'pageSize']);
      const { q = '', agentType = '', status = '', page = 1, pageSize = 10 } = input;
      if (typeof q !== 'string' || q.length > 200 || !Number.isInteger(page) || page < 1 || page > 1000000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 || (agentType && !agents.includes(agentType as AgentType)) || (status && !['active', 'expired', 'none'].includes(status))) invalid('Filtros de busca inválidos.');
      return rpc('admin_users_read', { p_actor: actor, p_user_id: null, p_filters: { q: q.trim(), agentType, status, page, pageSize } });
    },
    async get(id: string, actor: string): Promise<AdminUser> {
      readGate(); return rpc('admin_users_read', { p_actor: uuid(actor), p_user_id: uuid(id), p_filters: {} });
    },
    async create(input: CreateAdminUserInput, actor: string): Promise<AdminUser> {
      writeGate(); uuid(actor); allow(input, ['nome', 'email', 'telefone', 'agentTypes', 'expiresAt', 'reason']);
      const data = { nome: text(input.nome, 'Nome', 150), email: email(input.email), telefone: input.telefone === undefined ? null : phone(input.telefone), ...access(input), reason: reason(input.reason) };
      // Nobody knows this random bootstrap secret. Only a subsequent single-use
      // invitation may establish the recipient's chosen password.
      const passwordHash = await bcrypt.hash(randomBytes(48).toString('base64url'), 12);
      return rpc('admin_users_mutate', { p_actor: actor, p_operation: 'create', p_user_id: null, p_expected_revision: null, p_input: data, p_password_hash: passwordHash });
    },
    async update(id: string, input: UpdateAdminUserInput, actor: string): Promise<AdminUser> {
      writeGate(); uuid(actor); uuid(id); allow(input, ['revision', 'nome', 'email', 'telefone', 'reason']);
      const expectedRevision = revision(input.revision);
      const data: Record<string, unknown> = { reason: reason(input.reason) };
      if (input.nome !== undefined) data.nome = text(input.nome, 'Nome', 150);
      if (input.email !== undefined) data.email = email(input.email);
      if (input.telefone !== undefined) data.telefone = phone(input.telefone);
      if (Object.keys(data).length === 1) invalid('Informe ao menos um campo cadastral.');
      return rpc('admin_users_mutate', { p_actor: actor, p_operation: 'profile', p_user_id: id, p_expected_revision: expectedRevision, p_input: data, p_password_hash: null });
    },
    async setAccess(id: string, input: UpdateAdminAccessInput, actor: string): Promise<AdminUser> {
      writeGate(); uuid(actor); uuid(id); allow(input, ['revision', 'access', 'reason']);
      const expectedRevision = revision(input.revision);
      if (!Array.isArray(input.access) || input.access.length !== agents.length) invalid('Informe as quatro IAs e suas validades.');
      const entries = input.access.map(entry => {
        allow(entry, ['agentType', 'enabled', 'expiresAt']);
        if (!agents.includes(entry.agentType) || typeof entry.enabled !== 'boolean') invalid('Acesso por IA inválido.');
        return { agentType: entry.agentType, enabled: entry.enabled, expiresAt: expiry(entry.expiresAt) };
      });
      if (new Set(entries.map(entry => entry.agentType)).size !== agents.length) invalid('Informe cada IA uma única vez.');
      // Existing expired dates must survive unrelated edits. The transaction
      // checks whether an expired enabled grant is unchanged under its lock.
      const data = { access: entries, reason: reason(input.reason) };
      return rpc('admin_users_mutate', { p_actor: actor, p_operation: 'access', p_user_id: id, p_expected_revision: expectedRevision, p_input: data, p_password_hash: null });
    },
    async audit(id: string, actor: string): Promise<AdminUserAudit[]> {
      readGate();
      const args = { p_actor: uuid(actor), p_user_id: uuid(id) };
      // v2 (migration Hotmart) identifica o ator de sistema; sem ela, usa v1.
      try { return await rpc<AdminUserAudit[]>('admin_users_audit_read_v2', args); }
      catch (error) { if (!(error instanceof AdminUsersError) || error.code !== 'admin_users_storage_unavailable') throw error; }
      return rpc('admin_users_audit_read', args);
    },
  };
}

export type LiveAdminUsersRepository = ReturnType<typeof createLiveAdminUsersRepository>;
