import { NextRequest } from 'next/server';
import { AdminUsersError, requireAdminUsersDemo } from '@/lib/admin-users/config';
import { adminUsersResponse, getAdminUsersStore, readAdminUsersBody, requireSameOrigin } from '@/lib/admin-users/server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  return adminUsersResponse(async () => {
    requireAdminUsersDemo(); requireSameOrigin(request);
    const body = await readAdminUsersBody(request);
    if (Object.keys(body).some(key => key !== 'token')) throw new AdminUsersError(400, 'invalid_input', 'Envie somente o token da demonstração.');
    return getAdminUsersStore().consumeInvite(body.token);
  });
}
