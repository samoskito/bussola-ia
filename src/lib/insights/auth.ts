import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import { createServerSupabaseClient } from '../supabase/server';
import { InsightsError } from './config';

export type AdminLookup = (userId: string) => Promise<{ id: string; nivel: string | null } | null>;

/** Verify the current database level, never a level copied into the JWT. */
export async function verifyInsightsAdmin(token: string | undefined, lookup: AdminLookup, secret = process.env.JWT_SECRET): Promise<void> {
  if (!secret) throw new InsightsError(503, 'auth_configuration', 'Autenticação indisponível.');
  if (!token) throw new InsightsError(401, 'unauthenticated', 'Autenticação necessária.');
  let userId: string;
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (typeof decoded === 'string' || typeof decoded.userId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded.userId)) throw new Error('Invalid subject');
    userId = decoded.userId;
  } catch {
    throw new InsightsError(401, 'unauthenticated', 'Sessão inválida ou expirada.');
  }
  let user: Awaited<ReturnType<AdminLookup>>;
  try { user = await lookup(userId); } catch {
    throw new InsightsError(503, 'authorization_unavailable', 'Não foi possível verificar a permissão.');
  }
  if (!user || user.id !== userId || user.nivel !== 'admin') {
    throw new InsightsError(403, 'forbidden', 'Insights disponíveis apenas para administradores.');
  }
}

export async function requireInsightsAdmin(): Promise<void> {
  const cookieStore = await cookies();
  await verifyInsightsAdmin(cookieStore.get('auth_token')?.value, async userId => {
    const { data, error } = await createServerSupabaseClient().from('users').select('id,nivel').eq('id', userId).single();
    if (error) throw new Error('Authorization lookup failed');
    return data;
  });
}
