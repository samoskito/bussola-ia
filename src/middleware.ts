import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  try {
    const path = request.nextUrl.pathname;
    
    // Public routes that don't require authentication
    const publicRoutes = [
      '/',
      '/auth/login',
      '/auth/register',
      '/auth/forgot-password',
      '/auth/reset-password',
    ];
    
    // Check if the current path is public
    const isPublicRoute = publicRoutes.some(route => 
      path === route || path.startsWith(`${route}/`)
    );
    
    // Skip middleware for public routes
    if (isPublicRoute) {
      return NextResponse.next();
    }
    
    // Check for auth token in cookies
    const token = request.cookies.get('auth_token')?.value;
    
    // If no token and not a public route, redirect to login
    if (!token) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirectedFrom', path);
      return NextResponse.redirect(loginUrl);
    }
    
    // If user is on auth pages but already authenticated, redirect to dashboard
    if (path.startsWith('/auth')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    
    return NextResponse.next();
  } catch (error) {
    console.error('Middleware error:', error);
    // In case of error, allow access to prevent blocking
    return NextResponse.next();
  }
}

// Match all request paths except for the ones starting with:
// - _next/static (static files)
// - _next/image (image optimization files)
// - favicon.ico (favicon file)
// - api/auth/ (auth API routes)
// - _next (Next.js internals)
// - public/ (public files)
// - robots.txt
// - sitemap.xml
// - manifest.json
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth|_next|public/|robots.txt|sitemap.xml|manifest.json).*)',
  ],
};
