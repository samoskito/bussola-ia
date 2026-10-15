export class AdminUsersError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function getAdminUsersMode(env: Record<string, string | undefined> = process.env): 'demo' | 'disabled' {
  return env.ADMIN_USERS_MODE === 'demo' && env.NODE_ENV !== 'production' ? 'demo' : 'disabled';
}

export function requireAdminUsersDemo(env: Record<string, string | undefined> = process.env): void {
  if (getAdminUsersMode(env) !== 'demo') {
    throw new AdminUsersError(503, 'admin_users_disabled', 'Administração simulada desativada neste ambiente.');
  }
}
