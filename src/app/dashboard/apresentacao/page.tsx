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
import MobileMenu from '@/components/layout/MobileMenu';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const toggleMobileMenu = () => setIsMobileMenuOpen((v) => !v);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  
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
      <div className="flex h-screen h-[100dvh] items-center justify-center bg-gray-900">
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
  const isAdmin = user.nivel === 'admin';
  const diasParaAviso = !isAdmin && typeof diasRestantesApi === 'number' ? diasRestantesApi : isAdmin ? undefined : resultadoAcesso.diasRestantes;
  const dataExpParaAviso = isAdmin ? null : (typeof dataExpiracaoApi !== 'undefined') ? dataExpiracaoApi : user.data_expiracao;
  
  // Se não tem acesso, mostrar tela de bloqueio
  if (!resultadoAcesso.acesso) {
    return (
      <AccessDenied
        motivo={resultadoAcesso.motivo || 'Você não tem acesso a esta IA'}
        expirado={resultadoAcesso.expirado}
        nomeIA="Apresentação para Reunião de Resultados"
        dataExpiracao={isAdmin ? null : user.data_expiracao}
      />
    );
  }
  
  return (
    <div className="flex h-screen h-[100dvh] w-full bg-gray-900 text-white overflow-hidden">
      {/* Sidebar - visível apenas em desktop */}
      <div className="hidden lg:flex lg:w-64 xl:w-72 2xl:w-80 border-r border-gray-800 shadow-xl">
        <Sidebar initialChats={chats} />
      </div>
      
      {/* Mobile Menu Overlay */}
      <MobileMenu 
        isOpen={isMobileMenuOpen} 
        onClose={closeMobileMenu} 
        chats={chats as any}
      />

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden w-full">
        <Header 
          userName={user.nome || user.email} 
          title="Apresentação para Reunião de Resultados" 
          onMenuToggle={toggleMobileMenu} 
          agentType="apresentacao"
          daysRemaining={diasParaAviso}
        />
        
        <ExpiryToast daysRemaining={diasParaAviso} dataExpiracao={dataExpParaAviso || null} />
        
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gradient-to-b from-gray-900 to-gray-950 w-full">
          {/* Aviso dentro do conteúdo */}
          <div className="shrink-0 px-3 md:px-6 pt-3">
            <AccessWarning 
              diasRestantes={diasParaAviso}
              dataExpiracao={dataExpParaAviso}
            />
          </div>
          <div className="min-h-0 flex-1 w-full">
            <ApresentacaoInterface userName={user.nome || user.email} agents={mockAgents} />
          </div>
        </main>
      </div>
    </div>
  );
}
