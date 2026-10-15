import { NextRequest } from 'next/server';
import { AdminUsersError, getAdminUsersMode, requireAdminUsersWrites } from '@/lib/admin-users/config';
import { adminUsersResponse, readAdminUsersBody, requireSameOrigin } from '@/lib/admin-users/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return adminUsersResponse(async () => {
    requireAdminUsersWrites();
    if (getAdminUsersMode() !== 'live') throw new AdminUsersError(503, 'live_disabled', 'Primeiro acesso real desativado.');
    requireSameOrigin(request);
    const body = await readAdminUsersBody(request);
    if (Object.keys(body).some(key => !['token', 'password'].includes(key))) throw new AdminUsersError(400, 'invalid_input', 'Campos inválidos.');
    const { consumeLiveInvite } = await import('@/lib/admin-users/invitations');
    return consumeLiveInvite({ client: createServerSupabaseClient(), token: body.token as string, password: body.password as string });
  });
}
