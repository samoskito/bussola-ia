import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAdminUsersMode } from '@/lib/admin-users/config';

export const runtime = 'nodejs';

// Compatibility before the invitations migration only. Match the top-level
// function and its exact signature; a missing function inside the RPC is a fault.
function isAtomicResetAbsent(error: { code?: string; message?: string }): boolean {
  if (error.code === 'PGRST202') {
    const match = /^Could not find the function public\.admin_users_consume_legacy_reset\(([^()]*)\) in the schema cache$/.exec(error.message || '');
    return !!match && match[1].split(',').map(name => name.trim()).sort().join(',') === 'p_email,p_password_hash,p_token_hash';
  }
  return error.code === '42883' && /^function public\.admin_users_consume_legacy_reset\(text,\s*text,\s*text\) does not exist$/.test(error.message || '');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email || '').trim().toLowerCase();
    const token = String(body?.token || '').trim();
    const password = String(body?.password || '');

    if (!email || !token || !password) {
      return NextResponse.json(
        { error: 'Email, token e senha são obrigatórios' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'A senha deve ter pelo menos 8 caracteres' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const nowIso = new Date().toISOString();

    // Cheap preflight avoids bcrypt work for arbitrary invalid bearer tokens.
    // It never authorizes a write: the RPC revalidates under the shared lock.
    const { data: tokenRow, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('id, email, expires_at, used_at')
      .eq('email', email)
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenError) {
      console.error('[RESET_PASSWORD] Erro ao validar token');
      return NextResponse.json({ error: 'Erro ao validar token' }, { status: 500 });
    }
    if (!tokenRow) {
      return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // Installation determines the safe consumer, independently of panel rollout
    // flags. Keep ATOMIC_REQUIRED enabled after migration, including rollback:
    // a stale PostgREST schema cache must never reopen nontransactional writes.
    const atomicRequired = process.env.PASSWORD_RESET_ATOMIC_REQUIRED === 'true' ||
      (getAdminUsersMode() === 'live' && process.env.ADMIN_USERS_WRITES_ENABLED === 'true');
    const result = await supabase.rpc('admin_users_consume_legacy_reset', {
      p_email: email, p_token_hash: tokenHash, p_password_hash: hashedPassword,
    });
    if (!result.error) {
      if (result.data?.success === true) return NextResponse.json({ success: true, message: 'Senha atualizada com sucesso' });
      // An unexpected RPC result is not evidence that the RPC is absent.
      return NextResponse.json({ error: 'Erro ao atualizar senha' }, { status: 500 });
    }
    if (result.error.code === '22023' && result.error.message === 'invalid reset') {
      return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 400 });
    }
    if (atomicRequired || !isAtomicResetAbsent(result.error)) {
      console.error('[RESET_PASSWORD] Consumidor atômico indisponível');
      return NextResponse.json({ error: 'Erro ao atualizar senha' }, { status: 500 });
    }

    // Only an explicit missing RPC before migration may use the legacy flow.
    const { data: updatedUser, error: updateUserError } = await supabase
      .from('users')
      .update({
        senha: hashedPassword,
        updated_at: nowIso
      })
      .ilike('email', email)
      .select('id')
      .maybeSingle();

    if (updateUserError) {
      console.error('[RESET_PASSWORD] Erro ao atualizar senha');
      return NextResponse.json({ error: 'Erro ao atualizar senha' }, { status: 500 });
    }

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Usuário não encontrado para este token' },
        { status: 400 }
      );
    }

    // Invalida todos os tokens pendentes do usuário.
    const { error: invalidateError } = await supabase
      .from('password_reset_tokens')
      .update({ used_at: nowIso })
      .eq('email', email)
      .is('used_at', null);

    if (invalidateError) {
      console.error('[RESET_PASSWORD] Erro ao invalidar tokens');
    }

    return NextResponse.json({
      success: true,
      message: 'Senha atualizada com sucesso'
    });
  } catch {
    console.error('[RESET_PASSWORD] Erro inesperado');
    return NextResponse.json({ error: 'Erro ao processar solicitação' }, { status: 500 });
  }
}
