import 'server-only';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../supabase/server';
import { AdminUsersError, getAdminUsersMode } from '../admin-users/config';
import { HotmartError } from './config';
import { createHotmartRepository } from './repository';
import { processHotmartEvent, type ProcessDeps } from './processor';

export function getHotmartRepository() {
  return createHotmartRepository(createServerSupabaseClient());
}

/**
 * Convite automático reaproveita a origem fixa e o transporte SMTP/Brevo do
 * painel admin; exige os mesmos gates reais de e-mail (ADMIN_USERS_*).
 */
async function inviteDeps(env: Record<string, string | undefined>): Promise<ProcessDeps['invite']> {
  if (getAdminUsersMode(env) !== 'live' || env.ADMIN_USERS_WRITES_ENABLED !== 'true' || env.ADMIN_USERS_EMAIL_ENABLED !== 'true') return null;
  const { appOrigin, sendFirstAccessEmail } = await import('../admin-users/invitations');
  return { origin: () => appOrigin(env), send: mail => sendFirstAccessEmail(mail, env) };
}

export async function processHotmartEventLive(eventRow: string, allowReview = false) {
  const env = process.env;
  return processHotmartEvent(eventRow, {
    repo: getHotmartRepository(),
    env,
    allowReview,
    hashPassword: secret => bcrypt.hash(secret || randomBytes(48).toString('base64url'), 12),
    invite: await inviteDeps(env),
  });
}

export async function hotmartAdminResponse(operation: () => unknown | Promise<unknown>): Promise<NextResponse> {
  const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
  try {
    return NextResponse.json(await operation(), { headers });
  } catch (error) {
    const known = error instanceof HotmartError || error instanceof AdminUsersError;
    return NextResponse.json({ error: known ? error.message : 'Não foi possível concluir a operação.', code: known ? error.code : 'internal_error' }, { status: known ? error.status : 500, headers });
  }
}
