import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const cookieStore = cookies();
  try {
    const { email, password } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();
    
    // Buscar usuário da tabela users
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .single();
    
    if (userError || !user) {
      console.log('Usuário não encontrado:', email);
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      );
    }
    
    // Verificar senha
    const isPasswordValid = await bcrypt.compare(password, user.senha);
    
    if (!isPasswordValid) {
      console.log('Senha inválida para:', email);
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      );
    }
    
    // Gerar token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );
    
    // Definir cookie seguro
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60, // 30 dias
      path: '/',
      sameSite: 'strict' as const,
    };
    
    // Remover senha do objeto usuário
    const { senha, ...userWithoutPassword } = user;
    
    // Configurar cookie e retornar usuário
    const response = NextResponse.json({ user: userWithoutPassword });
    response.cookies.set('auth_token', token, cookieOptions);
    
    return response;
  } catch (error) {
    console.error('Erro de login:', error);
    return NextResponse.json(
      { error: 'Erro ao processar login' },
      { status: 500 }
    );
  }
}