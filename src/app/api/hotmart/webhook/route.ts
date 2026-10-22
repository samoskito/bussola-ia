import { NextRequest, NextResponse } from 'next/server';
// src/types/next-server.d.ts (legado) restringe os tipos de 'next/server';
// `after` é o mesmo export público do Next 15, importado do módulo de origem.
import { after } from 'next/dist/server/after';
import { handleHotmartWebhook } from '@/lib/hotmart/webhook';
import { getHotmartRepository, processHotmartEventLive } from '@/lib/hotmart/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Webhook Hotmart 2.0. O contrato n8n dos chats não é afetado por esta rota. */
export async function POST(request: NextRequest) {
  const result = await handleHotmartWebhook(request, {
    repo: getHotmartRepository,
    schedule: task => after(task),
    process: eventRow => processHotmartEventLive(eventRow),
  });
  return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store' } });
}
