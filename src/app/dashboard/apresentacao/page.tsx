"use client";

import React, { useEffect, useState } from 'react';

// Configuração para desativar a pré-renderização estática
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ApresentacaoInterface from '@/components/chat/ApresentacaoInterface';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserChats } from '@/lib/supabase/client-utils-chat';
import { verificarAcessoIA } from '@/lib/access-control';
import AccessDenied from '@/components/access/AccessDenied';
import AccessWarning from '@/components/access/AccessWarning';
import ExpiryToast from '@/components/access/ExpiryToast';

const mockAgents = [
  { id: '1', name: 'Apresentação para Reunião de Resultados', isActive: true },
  { id: '2', name: 'Apresentação para Reunião de Resultados' },
  { id: '3', name: 'Apresentação para Reunião de Resultados' },
  { id: '4', name: 'Apresentação para Reunião de Resultados' },
  { id: '5', name: 'Apresentação para Reunião de Resultados' },
  { id: '6', name: 'Apresentação para Reunião de Resultados' },
];

export default function ApresentacaoPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [chats, setChats] = useState([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [diasRestantesApi, setDiasRestantesApi] = useState<number | undefined>(undefined);
  const [dataExpiracaoApi, setDataExpiracaoApi] = useState<string | null | undefined>(undefined);
  
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
  
  // Verificar acesso à IA de Apresentação para Reunião de Resultados
  const resultadoAcesso = verificarAcessoIA(user, 'Apresentação para Reunião de Resultados');
  const diasParaAviso = typeof diasRestantesApi === 'number' ? diasRestantesApi : resultadoAcesso.diasRestantes;
  const dataExpParaAviso = (typeof dataExpiracaoApi !== 'undefined') ? dataExpiracaoApi : user.data_expiracao;
  
  // Se não tem acesso, mostrar tela de bloqueio
  if (!resultadoAcesso.acesso) {
    return (
      <AccessDenied
        motivo={resultadoAcesso.motivo || 'Você não tem acesso a esta IA'}
        expirado={resultadoAcesso.expirado}
        nomeIA="Apresentação para Reunião de Resultados"
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
          title="Apresentação para Reunião de Resultados" 
          onMenuToggle={() => {}} 
          agentType="apresentacao"
          daysRemaining={diasParaAviso}
        />
        
        {/* Aviso de Expiração Próxima */}
        <AccessWarning 
          diasRestantes={diasParaAviso}
          dataExpiracao={dataExpParaAviso}
        />
        <ExpiryToast daysRemaining={diasParaAviso} dataExpiracao={dataExpParaAviso || null} />
        
        <main className="flex-1 overflow-hidden bg-gradient-to-b from-gray-900 to-gray-950 w-full">
          <div className="h-full w-full">
            <ApresentacaoInterface userName={user.nome || user.email} agents={mockAgents} />
          </div>
        </main>
      </div>
    </div>
  );
}
