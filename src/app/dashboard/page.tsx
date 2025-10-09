"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserChats } from '@/lib/supabase/client-utils-chat';
import ExpiryToast from '@/components/access/ExpiryToast';

// Definição dos agentes disponíveis
const agents = [
  {
    id: 'comunicacao-executiva',
    name: 'Comunicação Executiva',
    description: 'Gere scripts personalizados para suas necessidades',
    icon: '/images/comunicacao-executiva-logo.png',
    path: '/script'
  },
  {
    id: 'apresentacao-resultados',
    name: 'Apresentação para Reunião de Resultados',
    description: 'Crie apresentações de resultados profissionais',
    icon: '/images/apresentacao-resultados-logo.png',
    path: '/dashboard/apresentacao'
  }
];

export default function DashboardPage() {
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
      } catch (err) {
        console.error('Erro ao carregar chats:', err);
      } finally {
        setIsLoadingChats(false);
      }
    };
    
    if (user) {
      loadChats();
    }
  }, [user]);

  const handleAgentSelection = (path: string) => {
    router.push(path);
  };
  
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
  
  const diasParaAviso = diasRestantesApi;
  const dataExpParaAviso = dataExpiracaoApi;
  
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
          title="Selecione um Agente" 
          onMenuToggle={() => {}} 
          daysRemaining={diasParaAviso}
        />
        
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-900 to-gray-950 w-full p-6">
          <div className="max-w-6xl mx-auto">
            {/* Resumo do Plano / Expiração */}
            {typeof diasParaAviso === 'number' && (
              <div className={`mb-6 rounded-lg border p-4 ${diasParaAviso <= 0 ? 'bg-red-500/10 border-red-500/40 text-red-300' : diasParaAviso <= 3 ? 'bg-red-500/10 border-red-500/40 text-red-300' : 'bg-yellow-500/10 border-yellow-500/40 text-yellow-300'}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 4h.01M10.29 3.86l-7.6 13.15A1.5 1.5 0 003.9 19.5h16.2a1.5 1.5 0 001.31-2.49L13.81 3.86a1.5 1.5 0 00-2.62 0z" />
                    </svg>
                    <span className="text-sm">
                      {diasParaAviso <= 0
                        ? 'Seu plano está expirado.'
                        : `Seu plano expira em ${diasParaAviso} dia${diasParaAviso === 1 ? '' : 's'}.`}
                      {dataExpParaAviso ? ` Data de expiração: ${new Date(dataExpParaAviso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}.` : ''}
                    </span>
                  </div>
                  {typeof diasParaAviso === 'number' && diasParaAviso <= 10 && (
                    <div className="flex items-center gap-2">
                      <a
                        href="https://app.bussolaexecutiva.com.br/renovar-executivia"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-md bg-[#FF6B00] hover:bg-[#E05E00] text-white text-xs font-medium"
                      >
                        {diasParaAviso > 0 ? 'Renovar' : 'Renovar Acesso'}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Toast de Expiração (<= 3 dias) */}
            <ExpiryToast daysRemaining={diasParaAviso} dataExpiracao={dataExpParaAviso || null} />
            {/* Seção do Vídeo Tutorial */}
            <div className="mb-10">
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-white mb-2">Como Usar a ExecutivIA</h2>
                <p className="text-sm text-gray-400">Assista ao tutorial e aprenda a usar nossa plataforma</p>
              </div>
              
              <div className="relative w-full max-w-2xl mx-auto rounded-lg overflow-hidden shadow-xl border-2 border-gray-700 hover:border-[#FF6B00] transition-all duration-300">
                <div className="relative pb-[56.25%] h-0">
                  <iframe
                    className="absolute top-0 left-0 w-full h-full"
                    src="https://www.youtube.com/embed/YuFJZzh-o64"
                    title="Tutorial ExecutivIA"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>

            <h1 className="text-3xl font-bold mb-8 text-center">Selecione um Agente</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {agents.map((agent) => (
                <div 
                  key={agent.id}
                  onClick={() => handleAgentSelection(agent.path)}
                  className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-8 flex flex-col items-center cursor-pointer hover:from-gray-700 hover:to-gray-800 transition-all duration-300 border-2 border-gray-700 hover:border-[#FF6B00] shadow-xl hover:shadow-2xl hover:scale-[1.02] group"
                >
                  {/* Container da imagem sem círculo */}
                  <div className="relative mb-6 p-4 bg-gray-900/50 rounded-xl border border-gray-700 group-hover:border-[#FF6B00]/50 transition-all duration-300 shadow-lg">
                    {agent.icon ? (
                      <Image 
                        src={agent.icon} 
                        alt={agent.name} 
                        width={160} 
                        height={160}
                        className="w-40 h-40 object-contain"
                        onError={(e) => {
                          // Fallback para ícone SVG embutido se a imagem falhar
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                            svg.setAttribute('width', '160');
                            svg.setAttribute('height', '160');
                            svg.setAttribute('viewBox', '0 0 24 24');
                            svg.setAttribute('fill', 'none');
                            svg.setAttribute('stroke', 'currentColor');
                            svg.setAttribute('stroke-width', '2');
                            svg.setAttribute('stroke-linecap', 'round');
                            svg.setAttribute('stroke-linejoin', 'round');
                            svg.setAttribute('class', 'text-[#FF6B00]');
                            svg.innerHTML = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>';
                            parent.appendChild(svg);
                          }
                        }}
                      />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#FF6B00]">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                    )}
                  </div>
                  <h2 className="text-xl font-bold mb-3 text-[#FF6B00] group-hover:text-orange-400 transition-colors duration-300 text-center">{agent.name}</h2>
                  <p className="text-gray-400 text-center leading-relaxed">{agent.description}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
