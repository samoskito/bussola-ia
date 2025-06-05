"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/layout/Sidebar';
import ScriptGeneratorChat from '@/components/scripts/ScriptGeneratorChat';

interface User {
  id: string;
  nome: string;
  email: string;
  imagem_perfil?: string;
}

interface Project {
  id: string;
  name: string;
  isActive?: boolean;
}

interface Chat {
  id: string;
  title: string;
}

export default function ScriptGeneratorPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Mock data - would come from database in real app
  const mockProjects = [
    { id: '1', name: 'Projeto X' },
    { id: '2', name: 'Projeto Y' },
    { id: '3', name: 'Projeto Z', isActive: true },
    { id: '4', name: 'Projeto W' },
  ];

  const mockChats = Array(10).fill(0).map((_, i) => ({
    id: `chat-${i + 1}`,
    title: 'Lorem ipsum dolor...',
  }));

  const mockAgents = [
    { id: '1', name: 'BússolaScriptIA', isActive: true },
    { id: '2', name: 'BússolaScriptIA' },
    { id: '3', name: 'BússolaScriptIA' },
    { id: '4', name: 'BússolaScriptIA' },
    { id: '5', name: 'BússolaScriptIA' },
    { id: '6', name: 'BússolaScriptIA' },
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
      <div className="flex items-center justify-center min-h-screen bg-dark-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-dark-100 text-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar projects={mockProjects} chats={mockChats} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          <ScriptGeneratorChat userName={user.nome} agents={mockAgents} />
        </main>
      </div>
    </div>
  );
}
