import { NextRequest } from 'next/server';
import { readAdminUsersBody, requireSameOrigin } from '@/lib/admin-users/server';
import { createHotmartAdminService } from '@/lib/hotmart/admin';
import { requireHotmartAdmin } from '@/lib/hotmart/admin-access';
import { getHotmartRepository, hotmartAdminResponse } from '@/lib/hotmart/server';

type Context = { params: Promise<{ offerId: string }> };
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PUT(request: NextRequest, context: Context) {
  return hotmartAdminResponse(async () => {
    const actor = await requireHotmartAdmin({ write: true }); requireSameOrigin(request);
    const body = await readAdminUsersBody(request);
    return { offer: await createHotmartAdminService(getHotmartRepository(), actor).configureOffer((await context.params).offerId, body) };
  });
}
