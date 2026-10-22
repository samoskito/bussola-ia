import { NextRequest } from 'next/server';
import { requireSameOrigin } from '@/lib/admin-users/server';
import { requireHotmartAdmin } from '@/lib/hotmart/admin-access';
import { reprocessStuckHotmartEvents } from '@/lib/hotmart/recovery';
import { getHotmartRepository, hotmartAdminResponse, processHotmartEventLive } from '@/lib/hotmart/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** Botão "Reprocessar parados" da tela admin (mesma rotina do cron). */
export async function POST(request: NextRequest) {
  return hotmartAdminResponse(async () => {
    await requireHotmartAdmin({ write: true }); requireSameOrigin(request);
    const result = await reprocessStuckHotmartEvents({ repo: getHotmartRepository(), process: eventRow => processHotmartEventLive(eventRow) });
    return { pending: result.pending, processed: result.processed };
  });
}
