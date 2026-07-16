'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import MobileMenu from '@/components/layout/MobileMenu';
import { ChatDetail } from '@/components/chat';
import AccessDenied from '@/components/access/AccessDenied';
import { fetchUserChats } from '@/lib/supabase/client-utils-chat';
import AccessWarning from '@/components/access/AccessWarning';
import ExpiryToast from '@/components/access/ExpiryToast';
import type { AgentType } from '@/lib/agents';
import { getAgentByType, getAgentLabel } from '@/lib/agents';


type ChatPageProps = {
  params: {
    chatId: string;
  };
};

export default function ChatPage({ params }: ChatPageProps) {
  const { user, loading } = useAuth();
  // Não podemos usar React.use() em Client Components
  // Acessar chatId diretamente dos params
  const chatId = params.chatId;
  const [chatTitle, setChatTitle] = useState<string>('Carregando...');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [chats, setChats] = useState<Array<{ id: string; title: string; agent_type?: AgentType | null }>>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [agentType, setAgentType] = useState<AgentType | null>(null);
  const [accessDenied, setAccessDenied] = useState<{ motivo: string; expirado?: boolean } | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | undefined>(undefined);
  
  // Função para controlar a abertura/fechamento do menu mobile
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Função para fechar o menu mobile
  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };
  
  // Carregar os chats do usuário para o menu mobile
  useEffect(() => {
    const loadChats = async () => {
      try {
        setIsLoadingChats(true);
        const { chats: userChats, error } = await fetchUserChats();
        
        if (error) {
          console.error('Erro ao carregar chats:', error);
          return;
        }
        
        if (userChats && userChats.length > 0) {
          setChats(userChats);
        }
      } catch (err) {
        console.error('Erro ao carregar chats:', err);
      } finally {
        setIsLoadingChats(false);
      }
    };
    
    loadChats();
  }, []);

  useEffect(() => {
    // Verificar se há parâmetro de tipo na URL
    const urlParams = new URLSearchParams(window.location.search);
    const typeParam = urlParams.get('type');
    
    const agent = typeParam ? getAgentByType(typeParam) : null;

    if (agent) {
      console.log(`[ChatPage] Detectado agente do chat da URL: ${agent.type}`);
      setAgentType(agent.type);
    }
  }, []);

  useEffect(() => {
    // Função para buscar detalhes do chat
    const fetchChatDetails = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/chats/${chatId}`);
        
        if (!response.ok) {
          if (response.status === 403) {
            const data = await response.json().catch(() => ({ error: 'Acesso negado' }));
            const msg: string = data.error || 'Acesso negado';
            const expirado = /expirou/i.test(msg);
            setAccessDenied({ motivo: msg, expirado });
            return;
          }
          throw new Error('Erro ao carregar detalhes do chat');
        }
        
        const data = await response.json();
        if (data.chat) {
          setChatTitle(data.chat.title || 'Chat sem título');
          if (typeof data.diasRestantes === 'number') {
            setDaysRemaining(data.diasRestantes);
          }

          const chatAgent = getAgentByType((data.chat.agent_type as string | null) || 'comunicacao');
          setAgentType(chatAgent?.type || 'comunicacao');
        }
      } catch (err) {
        console.error('Erro ao buscar detalhes do chat:', err);
        setError('Não foi possível carregar os detalhes do chat');
      } finally {
        setIsLoading(false);
      }
    };

    if (chatId) {
      fetchChatDetails();
    }
  }, [chatId]);

  if (loading) {
    return (
      <div className="flex h-screen h-[100dvh] items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Será redirecionado pelo middleware
  }

  // Bloqueio de acesso (plano expirado ou sem permissão)
  if (accessDenied) {
    return (
      <AccessDenied
        motivo={accessDenied.motivo}
        expirado={accessDenied.expirado}
        nomeIA={getAgentLabel(agentType || 'comunicacao')}
        dataExpiracao={user?.data_expiracao || null}
      />
    );
  }
  
  // Render padrão do chat quando acesso permitido
  return (
    <div className="flex h-screen h-[100dvh] w-full bg-gray-900 text-white overflow-hidden">
      {/* Sidebar - visível apenas em desktop */}
      <div className="hidden lg:flex lg:w-64 xl:w-72 2xl:w-80 border-r border-gray-800 shadow-xl">
        <Sidebar />
      </div>
      
      {/* Menu Mobile - overlay quando aberto */}
      <MobileMenu 
        isOpen={isMobileMenuOpen} 
        onClose={closeMobileMenu} 
        chats={chats}
      />
      
      <div className="flex min-h-0 flex-col flex-1 overflow-hidden w-full">
        <Header 
          userName={user?.nome || 'Usuário'} 
          title={chatTitle} 
          onMenuToggle={toggleMobileMenu}
          agentType={agentType || 'comunicacao'}
          daysRemaining={daysRemaining}
        />
        <ExpiryToast daysRemaining={daysRemaining} dataExpiracao={user?.data_expiracao || null} />
        
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gradient-to-b from-gray-900 to-gray-950 w-full">
          {/* Aviso de Expiração Próxima (agora dentro do main) */}
          <div className="shrink-0 px-3 md:px-6 pt-3">
            <AccessWarning 
              diasRestantes={daysRemaining}
              dataExpiracao={user?.data_expiracao}
            />
          </div>
          <div className="min-h-0 flex-1 w-full">
            {error ? (
              <div className="flex h-full items-center justify-center p-4">
                <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-500 px-6 py-4 rounded-lg max-w-md text-center shadow-lg">
                  <p className="text-lg font-medium mb-2">Erro</p>
                  <p>{error}</p>
                </div>
              </div>
            ) : (
              <ChatDetail 
                chatId={chatId} 
                userName={user?.nome || 'Usuário'}
                agentType={agentType || 'comunicacao'}
                agentName={getAgentLabel(agentType || 'comunicacao')}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
