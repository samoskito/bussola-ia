import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../supabase/server';
import { verifyInsightsAdmin } from '../insights/auth';
import { InsightsError } from '../insights/config';
import { AdminUsersError, requireAdminUsersDemo } from './config';
import { createDemoAdminUsersStore, type DemoAdminUsersStore } from './domain';

/** The only database operation in this feature is the current actor's admin lookup. */
export async function requireAdminUsersAccess(): Promise<string> {
  requireAdminUsersDemo();
  const cookieStore = await cookies();
  let actor = '';
  try {
    await verifyInsightsAdmin(cookieStore.get('auth_token')?.value, async userId => {
      const { data, error } = await createServerSupabaseClient().from('users').select('id,nivel').eq('id', userId).single();
      if (error) throw new Error('Admin authorization lookup failed');
      actor = userId;
      return data;
    });
  } catch (error) {
    if (error instanceof InsightsError) throw new AdminUsersError(error.status, error.code, error.status === 403 ? 'Administração de usuários disponível apenas para administradores.' : error.message);
    throw error;
  }
  return actor;
}

const globalStore = globalThis as typeof globalThis & { __adminUsersDemoStore?: DemoAdminUsersStore };
export function getAdminUsersStore(): DemoAdminUsersStore {
  requireAdminUsersDemo();
  return globalStore.__adminUsersDemoStore ??= createDemoAdminUsersStore();
}

export function requireSameOrigin(request: NextRequest): void {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new AdminUsersError(403, 'invalid_origin', 'A origem desta operação não é permitida.');
  }
}

export async function readAdminUsersBody(request: NextRequest): Promise<Record<string, unknown>> {
  if (!(request.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) throw new AdminUsersError(415, 'invalid_content_type', 'Envie os dados como JSON.');
  const raw = await request.text();
  if (raw.length > 16384) throw new AdminUsersError(413, 'body_too_large', 'Dados excedem o limite permitido.');
  try {
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
    return body;
  } catch { throw new AdminUsersError(400, 'invalid_json', 'Dados JSON inválidos.'); }
}

export async function adminUsersResponse(operation: () => unknown | Promise<unknown>): Promise<NextResponse> {
  try {
    return NextResponse.json(await operation(), { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch (error) {
    const known = error instanceof AdminUsersError;
    return NextResponse.json({ error: known ? error.message : 'Não foi possível concluir a operação simulada.', code: known ? error.code : 'internal_error' }, { status: known ? error.status : 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
