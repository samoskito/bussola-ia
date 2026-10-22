import { NextRequest } from 'next/server';
import { requireSameOrigin } from '@/lib/admin-users/server';
import { createHotmartApiClient } from '@/lib/hotmart/api';
import { createHotmartAdminService } from '@/lib/hotmart/admin';
import { requireHotmartAdmin } from '@/lib/hotmart/admin-access';
import { getHotmartRepository, hotmartAdminResponse } from '@/lib/hotmart/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** Busca produtos/ofertas/planos na API Hotmart; preserva mapeamentos existentes. */
export async function POST(request: NextRequest) {
  return hotmartAdminResponse(async () => {
    const actor = await requireHotmartAdmin({ write: true }); requireSameOrigin(request);
    return createHotmartAdminService(getHotmartRepository(), actor).sync(createHotmartApiClient());
  });
}
