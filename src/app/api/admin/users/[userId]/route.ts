import { NextRequest } from 'next/server';
import { adminUsersResponse, getAdminUsersService, readAdminUsersBody, requireAdminUsersAccess, requireSameOrigin } from '@/lib/admin-users/server';
import type { UpdateAdminUserInput } from '@/lib/admin-users/types';
type Context = { params: Promise<{ userId: string }> };
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(_request: NextRequest, context: Context) {
  return adminUsersResponse(async () => { const actor = await requireAdminUsersAccess(); return { user: await getAdminUsersService(actor).get((await context.params).userId) }; });
}
export async function PATCH(request: NextRequest, context: Context) {
  return adminUsersResponse(async () => {
    const actor = await requireAdminUsersAccess(); requireSameOrigin(request);
    const body = await readAdminUsersBody(request);
    return { user: await getAdminUsersService(actor).update((await context.params).userId, body as unknown as UpdateAdminUserInput) };
  });
}
