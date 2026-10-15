import { NextRequest } from 'next/server';
import { adminUsersResponse, getAdminUsersStore, readAdminUsersBody, requireAdminUsersAccess, requireSameOrigin } from '@/lib/admin-users/server';
import { AdminUsersError, getAdminUsersMode, requireAdminUsersWrites } from '@/lib/admin-users/config';
import { createServerSupabaseClient } from '@/lib/supabase/server';
type Context = { params: Promise<{ userId: string }> };
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function POST(request: NextRequest, context: Context) {
  return adminUsersResponse(async () => {
    const actor = await requireAdminUsersAccess(); requireSameOrigin(request);
    const body = await readAdminUsersBody(request);
    if (Object.keys(body).some(key => !['revision', 'action', 'reason'].includes(key))) throw new AdminUsersError(400, 'invalid_input', 'Campos inválidos.');
    requireAdminUsersWrites();
    if (getAdminUsersMode() === 'live') {
      const { issueLiveInvite } = await import('@/lib/admin-users/invitations');
      return issueLiveInvite({ client: createServerSupabaseClient(), actor, userId: (await context.params).userId, revision: body.revision as string, action: body.action as 'generate' | 'send', reason: body.reason as string });
    }
    return getAdminUsersStore().issueInvite((await context.params).userId, body as unknown as { revision: number; action: 'generate' | 'send' }, actor, request.nextUrl.origin);
  });
}
