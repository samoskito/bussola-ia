import { AdminUsersError, getAdminUsersMode, requireAdminUsersWrites } from '../admin-users/config';
import { requireAdminUsersAccess } from '../admin-users/server';

/**
 * Tela Hotmart vive dentro do painel admin: exige sessão válida e papel admin
 * ATUAL no banco (revalidado a cada chamada) e o painel em modo live, pois
 * não existe demonstração em memória para a integração comercial.
 */
export async function requireHotmartAdmin(options: { write?: boolean } = {}): Promise<string> {
  const actor = await requireAdminUsersAccess();
  if (getAdminUsersMode() !== 'live') throw new AdminUsersError(503, 'hotmart_admin_requires_live', 'A tela Hotmart exige o painel administrativo em modo real.');
  if (options.write) requireAdminUsersWrites();
  return actor;
}
