"use client";

import React, { useEffect, useState } from 'react';
import EnhancedChatInterface from '@/components/chat/EnhancedChatInterface';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  nome: string;
  email: string;
  imagem_perfil?: string;
}

interface Agent {
  id: string;
  name: string;
  isActive?: boolean;
}

export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Agentes disponíveis (exemplo)
  const agents: Agent[] = [
    { id: '1', name: 'Bússola Executiva', isActive: true },
    { id: '2', name: 'Assistente de Reuniões' },
    { id: '3', name: 'Gerador de Scripts' }
  ];

  useEffect(() => {
    const checkUser = async () => {
      try {
        setLoading(true);
        
        // Verificar se o usuário está autenticado
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/auth/login');
          return;
        }
        
        // Buscar dados do usuário
        const { data: userData, error } = await supabase
          .from('users')
          .select('id, nome, email, imagem_perfil')
          .eq('id', session.user.id)
          .single();
        
        if (error || !userData) {
          console.error('Erro ao buscar dados do usuário:', error);
          router.push('/auth/login');
          return;
        }
        
        setUser(userData);
      } catch (error) {
        console.error('Erro ao verificar usuário:', error);
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    };
    
    checkUser();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dark-500">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen bg-dark-500 text-white p-4 md:p-8">
      <header className="mb-8">
        <div className="container mx-auto">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-primary">Bússola Executiva</h1>
            <div className="flex items-center gap-4">
              <a href="/dashboard" className="text-gray-400 hover:text-white">
                Dashboard
              </a>
              <a href="/dashboard/scripts" className="text-gray-400 hover:text-white">
                Meus Scripts
              </a>
              <div className="relative">
                <button className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
                    {user.imagem_perfil ? (
                      <img 
                        src={user.imagem_perfil} 
                        alt={user.nome} 
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <span>{user.nome.charAt(0)}</span>
                    )}
                  </div>
                  <span>{user.nome}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <main className="flex-grow container mx-auto">
        <div className="bg-dark-400 rounded-lg p-6 h-full">
          <EnhancedChatInterface 
            user={user}
            agents={agents}
          />
        </div>
      </main>
      
      <footer className="mt-8 text-center text-gray-500 text-sm">
        <p>© {new Date().getFullYear()} Bússola Executiva. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
