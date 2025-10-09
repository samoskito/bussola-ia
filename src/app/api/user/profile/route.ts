import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as { userId: string };
    if (!decoded?.userId) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const supabase = createServerSupabaseClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, nome, telefone, avatar')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

    return NextResponse.json({ user });
  } catch (err) {
    console.error('[PROFILE][GET] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as { userId: string };
    if (!decoded?.userId) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const body = await request.json();
    const { nome, email, telefone } = body as { nome?: string; email?: string; telefone?: string };

    const supabase = createServerSupabaseClient();
    const { error } = await supabase
      .from('users')
      .update({ nome, email, telefone })
      .eq('id', decoded.userId);

    if (error) return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PROFILE][PUT] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
