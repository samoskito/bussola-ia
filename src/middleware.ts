import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  try {
    // Criar cliente do Supabase para o middleware
    const supabase = createMiddlewareClient({ req, res });
  
    // Verificar se o usuário está autenticado
    const { data: { session } } = await supabase.auth.getSession();
    
    // Obter o caminho da URL
    const path = req.nextUrl.pathname;
    
    // Verificar se o caminho é uma rota protegida
    const isProtectedRoute = path.startsWith('/dashboard');
    
    // Verificar se o caminho é uma rota de autenticação
    const isAuthRoute = path.startsWith('/auth');
    
    // Se for uma rota protegida e o usuário não estiver autenticado, redirecionar para o login
    if (isProtectedRoute && !session) {
      const redirectUrl = new URL('/auth/login', req.url);
      return NextResponse.redirect(redirectUrl);
    }
    
    // Se for uma rota de autenticação e o usuário já estiver autenticado, redirecionar para o dashboard
    if (isAuthRoute && session && path !== '/auth/logout') {
      const redirectUrl = new URL('/dashboard', req.url);
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
