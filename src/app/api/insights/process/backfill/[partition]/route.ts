import { NextResponse } from 'next/server';
import { runDailyInsights } from '@/lib/insights/daily';
import { verifyInsightsWorker } from '@/lib/insights/worker-auth';
import { InsightsError } from '@/lib/insights/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

/** Eight disjoint subsets of the server-authorized historical window only. */
export async function POST(request: Request, context: { params: Promise<{ partition: string }> }) {
  try {
    verifyInsightsWorker(request);
    const { partition } = await context.params;
    if (!/^[0-7]$/.test(partition)) throw new InsightsError(400, 'invalid_partition', 'Partição inválida.');
    const result = await runDailyInsights({ partition: Number(partition) });
    return NextResponse.json({ mode: 'live', ...result }, { headers });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof InsightsError ? error.message : 'Executor indisponível; conferir configuração e migrations.',
      code: error instanceof InsightsError ? error.code : 'worker_unavailable',
    }, { status: error instanceof InsightsError ? error.status : 503, headers });
  }
}
