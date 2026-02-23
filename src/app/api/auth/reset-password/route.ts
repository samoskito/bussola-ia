import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

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
      console.error('[RESET_PASSWORD] Erro ao validar token:', tokenError);
      return NextResponse.json({ error: 'Erro ao validar token' }, { status: 500 });
    }

    if (!tokenRow) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: updatedUser, error: updateUserError } = await supabase
      .from('users')
      .update({
        senha: hashedPassword,
        updated_at: nowIso
      })
      .eq('email', email)
      .select('id')
      .maybeSingle();

    if (updateUserError) {
      console.error('[RESET_PASSWORD] Erro ao atualizar senha:', updateUserError);
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
      console.error('[RESET_PASSWORD] Erro ao invalidar tokens:', invalidateError);
    }

    return NextResponse.json({
      success: true,
      message: 'Senha atualizada com sucesso'
    });
  } catch (error) {
    console.error('[RESET_PASSWORD] Erro inesperado:', error);
    return NextResponse.json({ error: 'Erro ao processar solicitação' }, { status: 500 });
  }
}

