import { handleQuestionsExport } from '@/lib/insights/questions-export';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  return handleQuestionsExport(request);
}
