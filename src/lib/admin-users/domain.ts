import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AGENTS, isAgentAvailableForUser, type AgentType } from '../agents';
import { AdminUsersError } from './config';
import type { AdminUser, AdminUserAudit, AdminUserList, AdminUserStatus, AdminInviteResult, CreateAdminUserInput, UpdateAdminUserInput, UpdateAdminAccessInput } from './types';

type StoredUser = Omit<AdminUser, 'access' | 'status' | 'invite' | 'revision'> & {
  revision: number;
  grants: { agentType: AgentType; enabled: boolean; expiresAt: string | null }[];
  invitation?: { hash: string; expiresAt: string; status: 'generated' | 'simulated_sent' | 'consumed' };
};
export interface AdminUsersListInput { q?: string; agentType?: string; status?: string; page?: number; pageSize?: number }
const fail = (message: string, code = 'invalid_input', status = 400): never => { throw new AdminUsersError(status, code, message); };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const types = AGENTS.map(agent => agent.type);
const only = (input: object, allowed: string[]) => {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key))) fail('Campos inválidos para esta operação.');
};
const text = (value: unknown, name: string, max: number) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u001f\u007f]/.test(value)) fail(`${name} inválido.`);
  return (value as string).trim();
};
const email = (value: unknown) => {
  const result = text(value, 'E-mail', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail('E-mail inválido.');
  return result;
};
const phone = (value: unknown): string | null => {
  if (value === null || value === '') return null;
  const result = text(value, 'Telefone', 30);
  if (!/^[+\d\s().-]{5,30}$/.test(result)) fail('Telefone inválido.');
  return result;
};
const reason = (value: unknown, required = false) => value === undefined && !required ? 'Operação administrativa simulada.' : text(value, 'Motivo', 500);
const date = (value: unknown): string | null => {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('Informe uma data válida no formato AAAA-MM-DD.');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail('Data de validade inválida.');
  return value as string;
};
const selectedAgents = (value: unknown): AgentType[] => {
  if (!Array.isArray(value) || value.length > types.length || new Set(value).size !== value.length || value.some(item => !types.includes(item))) fail('Selecione IAs válidas, sem duplicações.');
  return value as AgentType[];
};

const individualAccess = (value: unknown): UpdateAdminAccessInput['access'] => {
  if (!Array.isArray(value) || value.length !== types.length) fail('Informe as quatro IAs e suas validades.');
  const entries = (value as unknown[]).map(item => {
    only(item as object, ['agentType', 'enabled', 'expiresAt']);
    const entry = item as UpdateAdminAccessInput['access'][number];
    if (!types.includes(entry.agentType) || typeof entry.enabled !== 'boolean') fail('Acesso por IA inválido.');
    return { agentType: entry.agentType, enabled: entry.enabled, expiresAt: date(entry.expiresAt) };
  });
  if (new Set(entries.map(item => item.agentType)).size !== types.length) fail('Informe cada IA uma única vez.');
  return entries;
};
const earliestExpiry = (global: string | null, individual: string | null) => global === null ? individual : individual === null ? global : global < individual ? global : individual;

// Expiration is an inclusive calendar date in the product's Brazilian timezone,
// not a UTC instant parsed with new Date('YYYY-MM-DD').
const calendarDate = (value: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  return ['year', 'month', 'day'].map(name => parts.find(part => part.type === name)!.value).join('-');
};

/** No database, credentials, password implementation, mailer or external IO in this domain. */
export function createDemoAdminUsersStore(now: () => Date = () => new Date()) {
  const users = new Map<string, StoredUser>();
  const events: AdminUserAudit[] = [];
  const today = () => calendarDate(now());
  const timestamp = () => now().toISOString();
  const expired = (value: string | null) => value !== null && (date(value) as string) < today();
  const read = (id: string) => users.get(id) || fail('Usuário simulado não encontrado.', 'not_found', 404);
  const view = (user: StoredUser): AdminUser => {
    const { grants, invitation, ...publicFields } = user;
    const global = user.plano === 'Todas' || user.plano === 'Ambas';
    const access = types.map(agentType => {
      const grant = grants.find(item => item.agentType === agentType);
      const source = user.nivel === 'admin' ? 'admin' as const : global ? 'global' as const : grant?.enabled ? 'individual' as const : 'none' as const;
      const effective = isAgentAvailableForUser(agentType, user.nivel) && (user.nivel === 'admin' || (!expired(user.data_expiracao) && (global || Boolean(grant?.enabled && !expired(grant.expiresAt)))));
      return { agentType, enabled: user.nivel === 'admin' || global || Boolean(grant?.enabled), expiresAt: user.nivel === 'admin' ? null : global ? user.data_expiracao : earliestExpiry(user.data_expiracao, grant?.expiresAt ?? null), effective, source };
    });
    const status: AdminUserStatus = access.some(item => item.effective) ? 'active' : access.some(item => item.enabled) ? 'expired' : 'none';
    const inviteStatus = !invitation ? 'none' : invitation.status === 'consumed' ? 'consumed' : invitation.expiresAt <= timestamp() ? 'expired' : invitation.status;
    return clone({ ...publicFields, status, access, invite: { status: inviteStatus, expiresAt: invitation?.expiresAt ?? null } });
  };
  const revision = (user: StoredUser, value: unknown) => {
    if (!Number.isInteger(value) || (value as number) < 1) fail('Revisão inválida.');
    if (user.revision !== value) fail('Este usuário mudou. Atualize a ficha antes de salvar.', 'revision_conflict', 409);
  };
  const uniqueEmail = (value: string, id?: string) => {
    if (Array.from(users.values()).some(user => user.email === value && user.id !== id)) fail('Já existe um usuário simulado com este e-mail.', 'duplicate_email', 409);
  };
  const audit = (user: StoredUser, actor: string, action: AdminUserAudit['action'], note: string, changes: Record<string, unknown>) => {
    events.push({ id: randomUUID(), userId: user.id, actor, action, reason: note, changes: clone(changes), createdAt: timestamp() });
  };
  const seed = (index: number, nome: string, plano: string | null, expiresAt: string | null, selected: AgentType[], nivel: 'user' | 'admin' = 'user') => {
    const id = `demo-user-${index}`;
    users.set(id, { id, nome, email: `pessoa${index}@usuarios.example`, telefone: `+55 11 90000-${String(index).padStart(4, '0')}`, nivel, plano, data_expiracao: expiresAt, revision: 1, createdAt: timestamp(), grants: types.map(agentType => ({ agentType, enabled: selected.includes(agentType), expiresAt })) });
  };
  const shifted = (days: number) => calendarDate(new Date(now().getTime() + days * 86400000));
  seed(1, 'Ana Exemplo', 'Todas', shifted(30), types);
  seed(2, 'Bruno Demonstração', 'Personalizado', null, ['comunicacao', 'apresentacao']);
  seed(3, 'Carla Simulada', 'Todas', shifted(-5), types);
  seed(4, 'Diego Sem Acesso', null, null, []);
  seed(5, 'Elisa Administradora Demo', 'Todas', shifted(-30), [], 'admin');
  seed(6, 'Fernanda Legado', 'Ambas', null, types);
  seed(7, 'Gabriel Individual Expirado', 'Personalizado', shifted(-1), ['postagem']);
  seed(8, 'Helena Validade Hoje', 'Personalizado', today(), ['conversas_dificeis']);
  seed(9, 'Igor Bônus', 'Personalizado', shifted(90), ['comunicacao']);
  seed(10, 'Joana Exemplo', 'Personalizado', null, ['postagem']);
  seed(11, 'Lucas Demonstração', 'Todas', null, types);
  seed(12, 'Marina Simulada', null, null, []);

  return {
    list(input: AdminUsersListInput = {}): AdminUserList {
      only(input, ['q', 'agentType', 'status', 'page', 'pageSize']);
      const { q = '', agentType = '', status = '', page = 1, pageSize = 10 } = input;
      if (typeof q !== 'string' || q.length > 200 || !Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 || (agentType && !types.includes(agentType as AgentType)) || (status && !['active', 'expired', 'none'].includes(status))) fail('Filtros de busca inválidos.');
      const term = q.trim().toLocaleLowerCase('pt-BR');
      const filtered = Array.from(users.values()).map(view).filter(user => (!term || [user.nome, user.email, user.telefone ?? '', (user.telefone ?? '').replace(/\D/g, '')].some(value => value.toLocaleLowerCase('pt-BR').includes(term))) && (!status || user.status === status) && (!agentType || user.access.some(item => item.agentType === agentType && item.effective)));
      return { mode: 'demo', users: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pageSize, totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)) };
    },
    get(id: string) { return view(read(id)); },
    create(input: CreateAdminUserInput, actor: string) {
      only(input, ['nome', 'email', 'telefone', 'agentTypes', 'expiresAt', 'reason']);
      const nome = text(input.nome, 'Nome', 150), normalizedEmail = email(input.email), telefone = input.telefone === undefined ? null : phone(input.telefone);
      const agents = selectedAgents(input.agentTypes ?? []), expiresAt = date(input.expiresAt ?? null), note = reason(input.reason);
      if (agents.length && expiresAt && expired(expiresAt)) fail('A validade do novo acesso deve ser hoje ou uma data futura.');
      uniqueEmail(normalizedEmail);
      const user: StoredUser = { id: `demo-${randomUUID()}`, nome, email: normalizedEmail, telefone, nivel: 'user', plano: agents.length ? 'Personalizado' : null, data_expiracao: null, revision: 1, createdAt: timestamp(), grants: types.map(agentType => ({ agentType, enabled: agents.includes(agentType), expiresAt: agents.includes(agentType) ? expiresAt : null })) };
      users.set(user.id, user);
      audit(user, actor, 'created', note, { nome, email: normalizedEmail, telefone, agentTypes: agents, expiresAt });
      return view(user);
    },
    update(id: string, input: UpdateAdminUserInput, actor: string) {
      only(input, ['revision', 'nome', 'email', 'telefone', 'reason']);
      const user = read(id); revision(user, input.revision);
      const patch: Partial<Pick<StoredUser, 'nome' | 'email' | 'telefone'>> = {};
      if (input.nome !== undefined) patch.nome = text(input.nome, 'Nome', 150);
      if (input.email !== undefined) patch.email = email(input.email);
      if (input.telefone !== undefined) patch.telefone = phone(input.telefone);
      if (!Object.keys(patch).length) fail('Informe ao menos um campo cadastral.');
      const note = reason(input.reason);
      if (patch.email) uniqueEmail(patch.email, id);
      const before = Object.fromEntries(Object.keys(patch).map(key => [key, user[key as keyof typeof patch]]));
      const emailChanged = patch.email !== undefined && patch.email !== user.email;
      Object.assign(user, patch); user.revision++;
      // A link issued for the previous identity must never survive an email edit.
      if (emailChanged) delete user.invitation;
      audit(user, actor, 'profile_updated', note, { before, after: patch, invitationInvalidated: emailChanged });
      return view(user);
    },
    setAccess(id: string, input: UpdateAdminAccessInput, actor: string) {
      only(input, ['revision', 'access', 'reason']);
      const user = read(id); revision(user, input.revision);
      if (user.nivel === 'admin') fail('O acesso vitalício de administradores não pode ser editado.', 'admin_access_locked', 403);
      const access = individualAccess(input.access), note = reason(input.reason, true);
      const before = view(user);
      for (const entry of access) {
        const previous = before.access.find(item => item.agentType === entry.agentType)!;
        if (entry.enabled && entry.expiresAt && expired(entry.expiresAt) && (!previous.enabled || entry.expiresAt !== previous.expiresAt)) fail('Uma nova validade deve ser hoje ou uma data futura.');
      }
      // The displayed dates include any global cap. Materialize the requested
      // per-agent state before removing that cap, preserving unchanged grants.
      user.plano = 'Personalizado'; user.data_expiracao = null;
      user.grants = types.map(agentType => {
        const desired = access.find(item => item.agentType === agentType)!;
        const previous = user.grants.find(item => item.agentType === agentType);
        return previous && previous.enabled === desired.enabled && previous.expiresAt === desired.expiresAt ? previous : { ...desired };
      });
      user.revision++;
      audit(user, actor, 'access_updated', note, { before: { plano: before.plano, data_expiracao: before.data_expiracao, access: before.access }, after: { plano: user.plano, data_expiracao: null, access } });
      return view(user);
    },
    issueInvite(id: string, input: { revision: number; action: 'generate' | 'send'; reason?: string }, actor: string, origin = 'http://localhost:3000'): AdminInviteResult {
      only(input, ['revision', 'action', 'reason']);
      const user = read(id); revision(user, input.revision);
      if (!['generate', 'send'].includes(input.action)) fail('Ação de convite inválida.');
      if (input.reason !== undefined) reason(input.reason, true);
      let base: URL;
      try { base = new URL(origin); } catch { return fail('Origem local inválida.'); }
      if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) || !['http:', 'https:'].includes(base.protocol)) fail('Convites de demonstração exigem uma origem local.');
      const token = randomBytes(32).toString('base64url'), expiresAt = new Date(now().getTime() + 3600000).toISOString();
      user.invitation = { hash: hash(token), expiresAt, status: input.action === 'send' ? 'simulated_sent' : 'generated' }; user.revision++;
      audit(user, actor, input.action === 'send' ? 'invite_simulated_sent' : 'invite_generated', input.action === 'send' ? 'Simulação explícita de envio; nenhum e-mail enviado.' : 'Link de primeiro acesso simulado gerado.', { expiresAt, simulated: true });
      return { user: view(user), invite: { url: `${base.origin}/auth/update-password/demo?token=${token}`, expiresAt, simulated: true, action: input.action } };
    },
    audit(id: string) { read(id); return clone(events.filter(event => event.userId === id).slice().reverse()); },
    consumeInvite(token: unknown) {
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) fail('Link de demonstração inválido ou expirado.', 'invalid_demo_token');
      const digest = hash(token as string);
      const user = Array.from(users.values()).find(item => item.invitation?.hash === digest);
      if (!user?.invitation || user.invitation.status === 'consumed' || user.invitation.expiresAt <= timestamp()) fail('Link de demonstração inválido ou expirado.', 'invalid_demo_token');
      user.invitation!.status = 'consumed'; user.revision++;
      audit(user, 'demo-link-holder', 'demo_password_confirmed', 'Primeiro acesso confirmado somente na simulação; nenhuma senha ou sessão real criada.', { simulated: true });
      return { simulated: true as const, message: 'Demonstração concluída. Nenhuma senha, conta ou sessão real foi alterada.' };
    },
  };
}

export type DemoAdminUsersStore = ReturnType<typeof createDemoAdminUsersStore>;
