import { NextRequest } from 'next/server';
import { AdminUsersError } from '@/lib/admin-users/config';
import { createHotmartAdminService } from '@/lib/hotmart/admin';
import { requireHotmartAdmin } from '@/lib/hotmart/admin-access';
import { getHotmartApiEnvironment, getHotmartMode } from '@/lib/hotmart/config';
import { getHotmartRepository, hotmartAdminResponse } from '@/lib/hotmart/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return hotmartAdminResponse(async () => {
    const actor = await requireHotmartAdmin();
    const params = request.nextUrl.searchParams;
    if ([...params.keys()].some(key => !['resource', 'status'].includes(key) || params.getAll(key).length > 1)) throw new AdminUsersError(400, 'invalid_filters', 'Filtros inválidos.');
    const service = createHotmartAdminService(getHotmartRepository(), actor);
    const resource = params.get('resource') ?? 'summary';
    const status = params.get('status') ?? '';
    if (resource === 'summary') {
      const env = process.env;
      // Somente presença booleana das credenciais; valores nunca saem do servidor.
      return { mode: getHotmartMode(), environment: getHotmartApiEnvironment(), credentials: Boolean(env.HOTMART_CLIENT_ID && env.HOTMART_CLIENT_SECRET && env.HOTMART_BASIC), hottok: Boolean(env.HOTMART_HOTTOK), summary: await service.summary() };
    }
    if (resource === 'offers') return { offers: await service.offers() };
    if (resource === 'events') return { events: await service.events(status) };
    if (resource === 'reviews') return { reviews: await service.reviews(status) };
    throw new AdminUsersError(400, 'invalid_filters', 'Recurso inválido.');
  });
}
