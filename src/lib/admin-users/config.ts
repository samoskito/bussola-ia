export class AdminUsersError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function getAdminUsersMode(env: Record<string, string | undefined> = process.env): 'demo' | 'live' | 'disabled' {
  if (env.ADMIN_USERS_MODE === 'demo' && env.NODE_ENV !== 'production') return 'demo';
  if (env.ADMIN_USERS_MODE === 'live' && env.ADMIN_USERS_LIVE_ENABLED === 'true') return 'live';
  return 'disabled';
}

export function requireAdminUsersEnabled(env: Record<string, string | undefined> = process.env): void {
  if (getAdminUsersMode(env) === 'disabled') throw new AdminUsersError(503, 'admin_users_disabled', 'Administração indisponível neste ambiente.');
}

export function requireAdminUsersWrites(env: Record<string, string | undefined> = process.env): void {
  requireAdminUsersEnabled(env);
  if (getAdminUsersMode(env) === 'live' && env.ADMIN_USERS_WRITES_ENABLED !== 'true') throw new AdminUsersError(503, 'admin_users_writes_disabled', 'Alterações reais ainda não foram ativadas.');
}

export function requireAdminUsersEmail(env: Record<string, string | undefined> = process.env): void {
  requireAdminUsersWrites(env);
  if (getAdminUsersMode(env) !== 'live' || env.ADMIN_USERS_EMAIL_ENABLED !== 'true') throw new AdminUsersError(503, 'admin_users_email_disabled', 'Envio real de convites ainda não foi ativado.');
}

export function requireAdminUsersDemo(env: Record<string, string | undefined> = process.env): void {
  if (getAdminUsersMode(env) !== 'demo') {
    throw new AdminUsersError(503, 'admin_users_disabled', 'Administração simulada desativada neste ambiente.');
  }
}
