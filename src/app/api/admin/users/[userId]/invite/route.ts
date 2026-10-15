import { NextRequest } from 'next/server';
import { adminUsersResponse, getAdminUsersStore, readAdminUsersBody, requireAdminUsersAccess, requireSameOrigin } from '@/lib/admin-users/server';
type Context = { params: Promise<{ userId: string }> };
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function POST(request: NextRequest, context: Context) {
  return adminUsersResponse(async () => {
    const actor = await requireAdminUsersAccess(); requireSameOrigin(request);
    const body = await readAdminUsersBody(request);
    return getAdminUsersStore().issueInvite((await context.params).userId, body as unknown as { revision: number; action: 'generate' | 'send' }, actor, request.nextUrl.origin);
  });
}
