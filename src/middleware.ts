import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  try {
    // Verificar se estamos em modo de desenvolvimento
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Verificar se existe uma sessão simulada para desenvolvimento
    const hasMockSession = req.cookies.get('supabase-auth-token') || 
                          req.headers.get('authorization')?.startsWith('Bearer mock-token');
    
    // Criar cliente do Supabase para o middleware
    const supabase = createMiddlewareClient({ req, res });
  
    // Verificar se o usuário está autenticado
    const { data: { session } } = await supabase.auth.getSession();
    
    // Obter o caminho da URL
    const path = req.nextUrl.pathname;
    
    // Verificar se o caminho é uma rota protegida
    const isProtectedRoute = path.startsWith('/dashboard');
    // Verificar se é a rota de login ou página inicial
    const isLoginPage = path === '/auth/login' || path === '/';
    
    // Em modo de desenvolvimento, permitir acesso às rotas protegidas se houver sessão simulada
    if (isDevelopment && isProtectedRoute && hasMockSession) {
      console.log('Modo de desenvolvimento: permitindo acesso à rota protegida');
      return res;
    }
    
    // Se for uma rota protegida e o usuário não estiver autenticado, redirecionar para o login
    if (isProtectedRoute && !session) {
      console.log('Usuário não autenticado tentando acessar rota protegida');
      const redirectUrl = new URL('/auth/login', req.url);
      return NextResponse.redirect(redirectUrl);
    }
    
    // Se o usuário estiver autenticado e tentar acessar a página de login ou a página inicial,
    // redirecionar para o dashboard/chat
    if (isLoginPage && (session || (isDevelopment && hasMockSession))) {
      console.log('Usuário autenticado tentando acessar login, redirecionando para dashboard');
      const redirectUrl = new URL('/dashboard/chat', req.url);
      return NextResponse.redirect(redirectUrl);
    }
    
    return res;
  } catch (error) {
    console.error('Erro no middleware:', error);
    return res;
  }
}

// Configurar quais rotas o middleware deve ser executado
export const config = {
  matcher: ['/dashboard/:path*', '/auth/:path*'],
};
