import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../supabase/server';
import { verifyInsightsAdmin } from '../insights/auth';
import { InsightsError } from '../insights/config';
import { AdminUsersError, getAdminUsersMode, requireAdminUsersDemo, requireAdminUsersEnabled, requireAdminUsersWrites } from './config';
import { createDemoAdminUsersStore, type DemoAdminUsersStore } from './domain';
import type { AdminUsersListInput } from './domain';
import type { CreateAdminUserInput, UpdateAdminUserInput, UpdateAdminAccessInput } from './types';

/** Verify the current actor before selecting demo or guarded live persistence. */
export async function requireAdminUsersAccess(): Promise<string> {
  requireAdminUsersEnabled();
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

/** Lazy live adapter: importing demo routes never constructs a live repository. */
export function getAdminUsersService(actor: string) {
  const live = async () => (await import('./repository')).createLiveAdminUsersRepository();
  return {
    list: async (input: AdminUsersListInput) => getAdminUsersMode() === 'live' ? (await live()).list(input, actor) : getAdminUsersStore().list(input),
    get: async (id: string) => getAdminUsersMode() === 'live' ? (await live()).get(id, actor) : getAdminUsersStore().get(id),
    audit: async (id: string) => getAdminUsersMode() === 'live' ? (await live()).audit(id, actor) : getAdminUsersStore().audit(id),
    create: async (input: CreateAdminUserInput) => { requireAdminUsersWrites(); return getAdminUsersMode() === 'live' ? (await live()).create(input, actor) : getAdminUsersStore().create(input, actor); },
    update: async (id: string, input: UpdateAdminUserInput) => { requireAdminUsersWrites(); return getAdminUsersMode() === 'live' ? (await live()).update(id, input, actor) : getAdminUsersStore().update(id, input, actor); },
    setAccess: async (id: string, input: UpdateAdminAccessInput) => { requireAdminUsersWrites(); return getAdminUsersMode() === 'live' ? (await live()).setAccess(id, input, actor) : getAdminUsersStore().setAccess(id, input, actor); },
  };
}

export function requireSameOrigin(request: NextRequest): void {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new AdminUsersError(403, 'invalid_origin', 'A origem desta operação não é permitida.');
  }
}

export async function readAdminUsersBody(request: NextRequest): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '')) throw new AdminUsersError(415, 'invalid_content_type', 'Envie os dados como JSON.');
  const tooLarge = () => new AdminUsersError(413, 'body_too_large', 'Dados excedem o limite permitido.');
  let raw: string;
  if (request.body) {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 16384) { await reader.cancel(); throw tooLarge(); }
        chunks.push(chunk.value);
      }
    } finally { reader.releaseLock(); }
    raw = Buffer.concat(chunks).toString('utf8');
  } else raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > 16384) throw tooLarge();
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
    return NextResponse.json({ error: known ? error.message : 'Não foi possível concluir a operação.', code: known ? error.code : 'internal_error' }, { status: known ? error.status : 500, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  }
}
