import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  try {
    // Usar o utilitário de atualização de sessão
    const response = await updateSession(request);
    
    // Obter o caminho da URL
    const path = request.nextUrl.pathname;
    
    // Verificar se o caminho é uma rota protegida
    const isProtectedRoute = path.startsWith('/dashboard');
    const isAuthRoute = path.startsWith('/auth');
    
    // Verificar se o usuário está autenticado
    const isAuthenticated = request.cookies.has('sb-access-token') || 
                          request.cookies.has('sb-refresh-token') ||
                          request.headers.get('authorization')?.startsWith('Bearer ');
    
    // Se for uma rota protegida e o usuário não estiver autenticado, redirecionar para o login
    if (isProtectedRoute && !isAuthenticated) {
      const redirectUrl = new URL('/auth/login', request.url);
      redirectUrl.searchParams.set('redirectedFrom', path);
      return NextResponse.redirect(redirectUrl);
    }
    
    // Se for uma rota de autenticação e o usuário já estiver autenticado, redirecionar para o dashboard
    if (isAuthRoute && isAuthenticated && path !== '/auth/logout') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    
    return response;
  } catch (error) {
    console.error('Erro no middleware:', error);
    // Em caso de erro, permitir acesso para evitar bloqueios
    return NextResponse.next();
  }
}

// Match all request paths except for the ones starting with:
// - _next/static (static files)
// - _next/image (image optimization files)
// - favicon.ico (favicon file)
// - auth/ (auth pages)
// - api/ (API routes)
// - public/ (public files)
// - robots.txt
// - sitemap.xml
// - manifest.json
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|auth/|api/|public/|robots.txt|sitemap.xml|manifest.json).*)',
  ],
};
