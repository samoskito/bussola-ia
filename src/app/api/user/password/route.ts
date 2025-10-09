import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as { userId: string };
    if (!decoded?.userId) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const { currentPassword, newPassword } = await request.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // Buscar usuário
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, senha')
      .eq('id', decoded.userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    if (!user.senha || !(user.senha.startsWith('$2a$') || user.senha.startsWith('$2b$') || user.senha.startsWith('$2y$'))) {
      return NextResponse.json({ error: 'Senha atual inválida' }, { status: 400 });
    }

    const isValid = await bcrypt.compare(currentPassword, user.senha);
    if (!isValid) {
      return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 401 });
    }

    // Atualizar senha
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);

    const { error: updateError } = await supabase
      .from('users')
      .update({ senha: hash })
      .eq('id', decoded.userId);

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao atualizar senha' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PASSWORD][POST] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
