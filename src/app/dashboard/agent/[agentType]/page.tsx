"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ChatInterface from '@/components/chat/ChatInterface';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserChats } from '@/lib/supabase/client-utils-chat';
import AccessWarning from '@/components/access/AccessWarning';
import ExpiryToast from '@/components/access/ExpiryToast';
import MobileMenu from '@/components/layout/MobileMenu';
import { getAgentByType, isAgentAvailableForUser } from '@/lib/agents';

type AgentStartPageProps = {
  params: {
    agentType: string;
  };
};

export default function AgentStartPage({ params }: AgentStartPageProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const agent = getAgentByType(params.agentType);
  const [chats, setChats] = useState([]);
  const [diasRestantesApi, setDiasRestantesApi] = useState<number | undefined>(undefined);
  const [dataExpiracaoApi, setDataExpiracaoApi] = useState<string | null | undefined>(undefined);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const toggleMobileMenu = () => setIsMobileMenuOpen((v) => !v);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadChats = async () => {
      try {
        const { chats: userChats, error, diasRestantes, dataExpiracao } = await fetchUserChats();

        if (error) {
          console.error('Erro ao carregar chats:', error);
          return;
        }

        if (userChats && userChats.length > 0) {
          setChats(userChats);
        }
        setDiasRestantesApi(diasRestantes);
        setDataExpiracaoApi(dataExpiracao);
      } catch (err) {
        console.error('Erro ao carregar chats:', err);
      }
    };

    if (user) {
      loadChats();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isAdmin = user.nivel === 'admin';

  if (!agent) {
    return (
      <div className="flex h-screen w-full bg-gray-900 text-white overflow-hidden">
        <div className="hidden lg:flex lg:w-64 xl:w-72 2xl:w-80 border-r border-gray-800 shadow-xl">
          <Sidebar initialChats={chats} />
        </div>
        <MobileMenu isOpen={isMobileMenuOpen} onClose={closeMobileMenu} chats={chats as any} />
        <div className="flex-1 flex flex-col overflow-hidden w-full">
          <Header
            userName={user.nome || user.email}
            title="Agente inválido"
            onMenuToggle={toggleMobileMenu}
            daysRemaining={isAdmin ? undefined : diasRestantesApi}
          />
          <main className="flex-1 bg-gradient-to-b from-gray-900 to-gray-950 w-full flex items-center justify-center p-6">
            <div className="max-w-md text-center bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg px-6 py-5">
              <h1 className="text-lg font-semibold mb-2">Agente não encontrado</h1>
              <p className="text-sm">Volte ao dashboard e escolha um agente disponível.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!isAgentAvailableForUser(agent.type, user.nivel)) {
    return (
      <div className="flex h-screen w-full bg-gray-900 text-white overflow-hidden">
        <div className="hidden lg:flex lg:w-64 xl:w-72 2xl:w-80 border-r border-gray-800 shadow-xl">
          <Sidebar initialChats={chats} />
        </div>
        <MobileMenu isOpen={isMobileMenuOpen} onClose={closeMobileMenu} chats={chats as any} />
        <div className="flex-1 flex flex-col overflow-hidden w-full">
          <Header
            userName={user.nome || user.email}
            title={agent.name}
            onMenuToggle={toggleMobileMenu}
            agentType={agent.type}
            daysRemaining={isAdmin ? undefined : diasRestantesApi}
          />
          <main className="flex-1 bg-gradient-to-b from-gray-900 to-gray-950 w-full flex items-center justify-center p-6">
            <div className="max-w-md text-center bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 rounded-lg px-6 py-5">
              <div className="inline-flex rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-xs font-semibold mb-4">
                {agent.availabilityLabel}
              </div>
              <h1 className="text-lg font-semibold mb-2">{agent.name}</h1>
              <p className="text-sm text-yellow-100/90">
                Esta IA esta em ajustes finais e sera liberada em breve para usuarios. Administradores ja podem testar.
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const diasParaAviso = !isAdmin && typeof diasRestantesApi === 'number' ? diasRestantesApi : undefined;
  const dataExpParaAviso = isAdmin ? null : typeof dataExpiracaoApi !== 'undefined' ? dataExpiracaoApi : user.data_expiracao;

  return (
    <div className="flex h-screen w-full bg-gray-900 text-white overflow-hidden">
      <div className="hidden lg:flex lg:w-64 xl:w-72 2xl:w-80 border-r border-gray-800 shadow-xl">
        <Sidebar initialChats={chats} />
      </div>

      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={closeMobileMenu}
        chats={chats as any}
      />

      <div className="flex-1 flex flex-col overflow-hidden w-full">
        <Header
          userName={user.nome || user.email}
          title={agent.name}
          onMenuToggle={toggleMobileMenu}
          agentType={agent.type}
          daysRemaining={diasParaAviso}
        />

        <ExpiryToast daysRemaining={diasParaAviso} dataExpiracao={dataExpParaAviso || null} />

        <main className="flex-1 overflow-hidden bg-gradient-to-b from-gray-900 to-gray-950 w-full">
          <div className="px-3 md:px-6 pt-3">
            <AccessWarning
              diasRestantes={diasParaAviso}
              dataExpiracao={dataExpParaAviso}
            />
          </div>
          <div className="h-full w-full">
            <ChatInterface
              userName={user.nome || user.email}
              agentType={agent.type}
              agentName={agent.name}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
