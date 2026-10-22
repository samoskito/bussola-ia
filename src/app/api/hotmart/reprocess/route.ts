import { NextRequest, NextResponse } from 'next/server';
import { handleHotmartRecovery } from '@/lib/hotmart/recovery';
import { getHotmartRepository, processHotmartEventLive } from '@/lib/hotmart/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** Vercel Cron (GET + Authorization: Bearer CRON_SECRET) ou executor com HOTMART_REPROCESS_SECRET. */
export async function GET(request: NextRequest) {
  const result = await handleHotmartRecovery(request.headers.get('authorization'), {
    repo: getHotmartRepository,
    process: eventRow => processHotmartEventLive(eventRow),
  });
  return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store' } });
}
