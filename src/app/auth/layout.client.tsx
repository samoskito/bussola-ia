'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Se o usuário já estiver autenticado, redirecionar para o dashboard
    // LoginForm owns the safe post-login continuation. Consent performs its
    // own server-side current-admin check and must remain visible after login.
    if (!loading && user && !['/auth/login', '/auth/insights-mcp', '/auth/update-password/demo', '/auth/first-access'].includes(window.location.pathname)) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Mostrar um loader enquanto verifica a autenticação
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // Se o usuário não estiver autenticado, mostrar o conteúdo da página de login
  return (
    <div className="min-h-screen w-full">
      {children}
    </div>
  );
}
