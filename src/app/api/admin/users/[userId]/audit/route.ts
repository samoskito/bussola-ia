import { NextRequest } from 'next/server';
import { adminUsersResponse, getAdminUsersService, requireAdminUsersAccess } from '@/lib/admin-users/server';
type Context = { params: Promise<{ userId: string }> };
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(_request: NextRequest, context: Context) {
  return adminUsersResponse(async () => { const actor = await requireAdminUsersAccess(); return { events: await getAdminUsersService(actor).audit((await context.params).userId) }; });
}
