'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clientLogout } from '@/lib/supabase/client-utils';

// Esta página executa o logout automaticamente e redireciona o usuário
export default function LogoutPage() {
  const router = useRouter();
  
  useEffect(() => {
    async function performLogout() {
      try {
        // Executar o logout no cliente
        await clientLogout();
        // Redirecionar para a página de login
        router.push('/auth/login?logged_out=true');
      } catch (error) {
        console.error('Erro ao fazer logout:', error);
        router.push('/dashboard');
      }
    }
    
    performLogout();
  }, [router]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-white text-center">
        <h1 className="text-2xl font-bold mb-4">Saindo...</h1>
        <p>Você está sendo redirecionado.</p>
      </div>
    </div>
  );
}
