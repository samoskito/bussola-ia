import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Verificar se estamos acessando o dashboard/chat diretamente
  const isDashboardChat = request.nextUrl.pathname === '/dashboard/chat';
  
  // Se estamos acessando o dashboard/chat diretamente, permitir acesso incondicional
  if (isDashboardChat) {
    console.log('Acesso direto ao dashboard/chat, permitindo sem verificação');
    return response;
  }

  // Verificar se existe uma sessão manual no localStorage ou sessionStorage via cookies
  const hasManualSessionCookie = request.cookies.has('sb-access-token') || 
                               request.cookies.has('sb-refresh-token');
  
  // Verificar se há token de autorização no header
  const authHeader = request.headers.get('authorization');
  const hasAuthHeader = authHeader && 
                      (authHeader.includes('manual-session-token') || 
                       authHeader.startsWith('Bearer '));
  
  // Combinar as verificações
  const hasManualSession = hasManualSessionCookie || hasAuthHeader;
  
  // Obter o caminho da URL
  const path = request.nextUrl.pathname;
  
  // Verificar se o caminho é uma rota protegida
  const isProtectedRoute = path.startsWith('/dashboard');
  
  // Permitir acesso a rotas protegidas se houver sessão manual
  if (isProtectedRoute && hasManualSession) {
    console.log('Sessão manual detectada, permitindo acesso à rota protegida');
    return response;
  }

  // Atualizar a sessão do usuário
  const { data: { session } } = await supabase.auth.getSession()

  // Se for uma rota protegida e o usuário não estiver autenticado, redirecionar para o login
  if (isProtectedRoute && !session && !hasManualSession) {
    console.log('Usuário não autenticado tentando acessar rota protegida');
    const redirectUrl = new URL('/auth/login', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return response
}
