import { handleInsightGet } from '@/lib/insights/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  return handleInsightGet(request, 'topics');
}
