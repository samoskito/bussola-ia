import { NextRequest } from 'next/server';
import { readAdminUsersBody, requireSameOrigin } from '@/lib/admin-users/server';
import { createHotmartAdminService } from '@/lib/hotmart/admin';
import { requireHotmartAdmin } from '@/lib/hotmart/admin-access';
import { getHotmartRepository, hotmartAdminResponse } from '@/lib/hotmart/server';

type Context = { params: Promise<{ reviewId: string }> };
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** accept aplica a proposta recalculada; keep/dismiss mantêm o acesso atual. */
export async function POST(request: NextRequest, context: Context) {
  return hotmartAdminResponse(async () => {
    const actor = await requireHotmartAdmin({ write: true }); requireSameOrigin(request);
    const body = await readAdminUsersBody(request);
    return createHotmartAdminService(getHotmartRepository(), actor).resolveReview((await context.params).reviewId, body);
  });
}
