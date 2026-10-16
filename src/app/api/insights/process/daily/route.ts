import { NextResponse } from 'next/server';
import { runRollingDailyInsights } from '@/lib/insights/daily';
import { verifyInsightsWorker } from '@/lib/insights/worker-auth';
import { InsightsError } from '@/lib/insights/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

/** Fixed incremental window; request bodies/queries never configure processing. */
export async function POST(request: Request) {
  try {
    verifyInsightsWorker(request);
    const result = await runRollingDailyInsights();
    return NextResponse.json({ mode: 'live', ...result }, { headers });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof InsightsError ? error.message : 'Executor indisponível; conferir configuração e migrations.',
      code: error instanceof InsightsError ? error.code : 'worker_unavailable',
    }, { status: error instanceof InsightsError ? error.status : 503, headers });
  }
}
