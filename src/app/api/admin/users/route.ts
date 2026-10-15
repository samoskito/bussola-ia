import { NextRequest } from 'next/server';
import { AdminUsersError } from '@/lib/admin-users/config';
import { adminUsersResponse, getAdminUsersStore, readAdminUsersBody, requireAdminUsersAccess, requireSameOrigin } from '@/lib/admin-users/server';
import type { CreateAdminUserInput } from '@/lib/admin-users/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  return adminUsersResponse(async () => {
    await requireAdminUsersAccess();
    const params = request.nextUrl.searchParams;
    if ([...params.keys()].some(key => !['q', 'agentType', 'status', 'page', 'pageSize'].includes(key)) || [...params.keys()].some(key => params.getAll(key).length > 1)) throw new AdminUsersError(400, 'invalid_filters', 'Filtros de busca inválidos.');
    const integer = (name: string, fallback: number) => {
      const raw = params.get(name);
      if (raw !== null && !/^[1-9]\d{0,6}$/.test(raw)) throw new AdminUsersError(400, 'invalid_filters', 'Paginação inválida.');
      return raw === null ? fallback : Number(raw);
    };
    return getAdminUsersStore().list({ q: params.get('q') ?? '', agentType: params.get('agentType') ?? '', status: params.get('status') ?? '', page: integer('page', 1), pageSize: integer('pageSize', 10) });
  });
}
export async function POST(request: NextRequest) {
  return adminUsersResponse(async () => {
    const actor = await requireAdminUsersAccess(); requireSameOrigin(request);
    const body = await readAdminUsersBody(request);
    return { user: getAdminUsersStore().create(body as unknown as CreateAdminUserInput, actor) };
  });
}
