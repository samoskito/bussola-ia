"use client";

import React, { useEffect, useState } from 'react';
import { Metadata } from 'next';

// Configuração para desativar a pré-renderização estática
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ChatInterface from '@/components/chat/ChatInterface';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserChats } from '@/lib/supabase/client-utils-chat';
import { verificarAcessoIA } from '@/lib/access-control';
import AccessDenied from '@/components/access/AccessDenied';
import AccessWarning from '@/components/access/AccessWarning';

const mockAgents = [
  { id: '1', name: 'Comunicação Executiva', isActive: true },
  { id: '2', name: 'Comunicação Executiva' },
  { id: '3', name: 'Comunicação Executiva' },
  { id: '4', name: 'Comunicação Executiva' },
  { id: '5', name: 'Comunicação Executiva' },
  { id: '6', name: 'Comunicação Executiva' },
];

export default function ScriptPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [chats, setChats] = useState([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  
  // Redirecionar para login se não estiver autenticado
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);
  
  // Carregar chats do usuário
  useEffect(() => {
    const loadChats = async () => {
      try {
        // Garantir que estamos no navegador antes de fazer a chamada
        if (typeof window !== 'undefined') {
          setIsLoadingChats(true);
          const { chats: userChats, error } = await fetchUserChats();
          
          if (error) {
            console.error('Erro ao carregar chats:', error);
            return;
          }
          
          if (userChats && userChats.length > 0) {
            setChats(userChats);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar chats:', err);
      } finally {
        setIsLoadingChats(false);
      }
    };
    
    if (user && typeof window !== 'undefined') {
      loadChats();
    }
  }, [user]);
  
  // Mostrar loading enquanto verifica autenticação
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }
  
  // Se não estiver autenticado, não renderizar nada (será redirecionado)
  if (!user) {
    return null;
  }
  
  // Verificar acesso à IA de Comunicação Executiva
  const resultadoAcesso = verificarAcessoIA(user, 'Comunicação Executiva');
  
  // Se não tem acesso, mostrar tela de bloqueio
  if (!resultadoAcesso.acesso) {
    return (
      <AccessDenied
        motivo={resultadoAcesso.motivo || 'Você não tem acesso a esta IA'}
        expirado={resultadoAcesso.expirado}
        nomeIA="Comunicação Executiva"
        dataExpiracao={user.data_expiracao}
      />
    );
  }
  
  return (
    <div className="flex h-screen w-full bg-gray-900 text-white overflow-hidden">
      {/* Sidebar - visível apenas em desktop */}
      <div className="hidden lg:flex lg:w-64 xl:w-72 2xl:w-80 border-r border-gray-800 shadow-xl">
        <Sidebar initialChats={chats} />
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        <Header 
          userName={user.nome || user.email} 
          title="Novo Chat" 
          onMenuToggle={() => {}} 
        />
        
        {/* Aviso de Expiração Próxima */}
        <AccessWarning 
          diasRestantes={resultadoAcesso.diasRestantes}
          dataExpiracao={user.data_expiracao}
        />
        
        <main className="flex-1 overflow-hidden bg-gradient-to-b from-gray-900 to-gray-950 w-full">
          <div className="h-full w-full">
            <ChatInterface userName={user.nome || user.email} agents={mockAgents} />
          </div>
        </main>
      </div>
    </div>
  );
}
