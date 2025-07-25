'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirecionamento direto para o dashboard (página de seleção de agentes)
    console.log('Página de redirecionamento - redirecionando para /dashboard');
    
    // Usar router.push para navegação no lado do cliente
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white">
      <div className="w-full max-w-md p-8 space-y-8 bg-gray-900 rounded-lg shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-primary-500">Login bem-sucedido!</h2>
          <p className="mt-2">Redirecionando para o dashboard...</p>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
        <div className="text-center">
          <button
            onClick={() => window.location.href = '/dashboard/chat'}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          >
            Ir para o Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
