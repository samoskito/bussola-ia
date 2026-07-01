import { NextResponse } from 'next/server';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    console.log('[LOGIN] Iniciando processo de login');
    const { email, password } = await request.json();
    
    if (!email || !password) {
      console.log('[LOGIN] Email ou senha não fornecidos');
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    console.log('[LOGIN] Criando cliente Supabase');
    let supabase;
    try {
      supabase = createServerSupabaseClient();
    } catch (clientError) {
      console.error('[LOGIN] Erro de configuração do Supabase:', clientError);
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta (SUPABASE_SERVICE_ROLE_KEY ausente).' },
        { status: 500 }
      );
    }
    
    // Buscar usuário da tabela users
    console.log(`[LOGIN] Buscando usuário com email: ${email.trim().toLowerCase()}`);
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();
    
    if (userError) {
      console.log('[LOGIN] Erro ao buscar usuário:', userError);
      // Ajuda de diagnóstico para políticas RLS mal configuradas
      if (userError.code === '42P17') {
        return NextResponse.json(
          { error: 'Erro de política no banco (RLS recursiva na tabela users).' },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: 'Erro ao buscar usuário' },
        { status: 500 }
      );
    }
    
    if (!user) {
      console.log('[LOGIN] Usuário não encontrado:', email);
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      );
    }
    
    console.log('[LOGIN] Usuário encontrado, verificando senha');
    
    // Verificar se o campo senha existe
    if (!user.senha) {
      console.log('[LOGIN] Usuário não possui senha definida');
      return NextResponse.json(
        { error: 'Conta de usuário inválida' },
        { status: 401 }
      );
    }
    
    // Verificar senha
    try {
      console.log('[LOGIN] Comparando senha com bcrypt');
      console.log('[LOGIN] Senha do usuário existe:', !!user.senha);
      console.log('[LOGIN] Comprimento da senha armazenada:', user.senha ? user.senha.length : 0);
      
      // Verificar se a senha está no formato bcrypt (deve começar com $2a$, $2b$ ou $2y$)
      if (!user.senha || !(user.senha.startsWith('$2a$') || user.senha.startsWith('$2b$') || user.senha.startsWith('$2y$'))) {
        console.error('[LOGIN] A senha armazenada não está no formato bcrypt esperado');
        return NextResponse.json(
          { error: 'Erro na configuração da conta. Entre em contato com o suporte.' },
          { status: 500 }
        );
      }
      
      // Comparar senha com bcrypt
      const isPasswordValid = await bcrypt.compare(password, user.senha);
      
      if (!isPasswordValid) {
        console.log('[LOGIN] Senha inválida para:', email);
        return NextResponse.json(
          { error: 'Credenciais inválidas' },
          { status: 401 }
        );
      }
      
      console.log('[LOGIN] Senha válida, autenticação bem-sucedida');
    } catch (bcryptError) {
      console.error('[LOGIN] Erro ao comparar senhas com bcrypt:', bcryptError);
      return NextResponse.json(
        { error: 'Erro na verificação de credenciais' },
        { status: 500 }
      );
    }
    
    // Gerar token JWT
    try {
      console.log('[LOGIN] Gerando token JWT');
      
      if (!process.env.JWT_SECRET) {
        console.warn('[LOGIN] JWT_SECRET não está definido, usando chave padrão');
      }
      
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'Z2SMs9QPYai304J7lz+aitwqWEJJSjW1Q0ypVsS12ezKRwSuWKkP07LOBRV7q70EiEgvwQVta959/vcbAFpgPA==',
        { expiresIn: '30d' }
      );
      
      console.log('[LOGIN] Token JWT gerado com sucesso');
      
      // Definir cookie seguro
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60, // 30 dias
        path: '/',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const,
      };
      
      console.log('[LOGIN] Configurações de cookie:', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        ambiente: process.env.NODE_ENV || 'não definido'
      });
      
      // Remover senha do objeto usuário
      const { senha, ...userWithoutPassword } = user;
      const responseUser = userWithoutPassword.nivel === 'admin'
        ? { ...userWithoutPassword, data_expiracao: null }
        : userWithoutPassword;
      
      console.log('[LOGIN] Preparando resposta com dados do usuário');
      
      // Configurar cookie e retornar usuário
      const response = NextResponse.json({ user: responseUser });
      response.cookies.set('auth_token', token, cookieOptions);
      
      console.log('[LOGIN] Login bem-sucedido para:', email);
      return response;
    } catch (jwtError) {
      console.error('[LOGIN] Erro ao gerar token JWT:', jwtError);
      return NextResponse.json(
        { error: 'Erro ao gerar credenciais de acesso' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[LOGIN] Erro geral no processo de login:', error);
    return NextResponse.json(
      { error: 'Erro ao processar login' },
      { status: 500 }
    );
  }
}
