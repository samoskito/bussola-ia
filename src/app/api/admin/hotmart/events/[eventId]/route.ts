import { NextRequest } from 'next/server';
import { requireSameOrigin } from '@/lib/admin-users/server';
import { requireUuid } from '@/lib/hotmart/admin';
import { requireHotmartAdmin } from '@/lib/hotmart/admin-access';
import { hotmartAdminResponse, processHotmartEventLive } from '@/lib/hotmart/server';

type Context = { params: Promise<{ eventId: string }> };
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Reprocessa evento recebido, com falha ou em revisão (ex.: após mapear a oferta). */
export async function POST(request: NextRequest, context: Context) {
  return hotmartAdminResponse(async () => {
    await requireHotmartAdmin({ write: true }); requireSameOrigin(request);
    const result = await processHotmartEventLive(requireUuid((await context.params).eventId, 'Evento'), true);
    return { status: result.status, invite: result.invite ?? null };
  });
}
