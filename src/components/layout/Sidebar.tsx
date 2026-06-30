'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { fetchUserChats } from '@/lib/supabase/client-utils-chat';
import { useAuth } from '@/contexts/AuthContext';
import { getMensagemAviso } from '@/lib/access-control';
import { useRouter } from 'next/navigation';
import LogoutButton from '@/components/auth/LogoutButton';
import type { AgentType } from '@/lib/agents';
import { AGENTS, getAgentLabel } from '@/lib/agents';

type Chat = {
  id: string;
  title: string;
  created_at?: string;
  agent_type?: AgentType | null;
};

const getAgentBadgeClass = (agentType?: AgentType | null) => {
  switch (agentType || 'comunicacao') {
    case 'apresentacao':
      return 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300';
    case 'conversas_dificeis':
      return 'bg-rose-500/20 border-rose-500/30 text-rose-300';
    case 'postagem':
      return 'bg-sky-500/20 border-sky-500/30 text-sky-300';
    case 'comunicacao':
    default:
      return 'bg-[#FF6B00]/20 border-[#FF6B00]/30 text-[#FF6B00]';
  }
};

interface SidebarProps {
  initialChats?: Chat[];
}

const Sidebar: React.FC<SidebarProps> = ({ initialChats = [] }) => {
  const [chats, setChats] = useState<Chat[]>(initialChats);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  const [expiredByApi, setExpiredByApi] = useState<boolean>(false);
  const [apiDiasRestantes, setApiDiasRestantes] = useState<number | undefined>(undefined);
  const [apiDataExpiracao, setApiDataExpiracao] = useState<string | undefined>(undefined);
  
  // Calcular aviso de expiração (compacto)
  let diasRestantes: number | undefined;
  if (user?.data_expiracao) {
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const exp = new Date(user.data_expiracao);
    exp.setHours(0,0,0,0);
    const diff = Math.ceil((exp.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    diasRestantes = diff;
  }
  const aviso = getMensagemAviso(diasRestantes);
  
  useEffect(() => {
    const loadChats = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const { chats: userChats, error, expirado, diasRestantes: apiDias, dataExpiracao } = await fetchUserChats();
        
        if (error) {
          setError(error);
          return;
        }
        
        if (Array.isArray(userChats)) {
          setChats(userChats as Chat[]);
        }
        setExpiredByApi(Boolean(expirado));
        setApiDiasRestantes(apiDias);
        setApiDataExpiracao(dataExpiracao ?? undefined);
      } catch (err) {
        console.error('Erro ao carregar chats:', err);
        setError('Não foi possível carregar seus chats');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadChats();
  }, []);

  const handleNewChat = () => {
    router.push('/dashboard');
  };

  return (
    <aside className="w-64 h-screen bg-gray-900 flex flex-col overflow-hidden border-r border-gray-800 shadow-lg">
      {/* Logo */}
      <div className="p-3" style={{ backgroundColor: '#010811' }}>
        <Link href="/dashboard">
          <div className="flex items-center justify-center">
            <Image 
              src="/images/executivia-logo.png" 
              alt="ExecutivIA" 
              width={100} 
              height={100} 
              className="object-contain w-auto h-auto"
              priority
            />
          </div>
        </Link>
      </div>

      {/* Aviso de expiração compacto */}
      {aviso && (
        <div className={`mx-3 mt-3 mb-0 rounded-md text-xs px-3 py-2 border ${diasRestantes && diasRestantes <= 3 ? 'bg-red-500/10 border-red-500/40 text-red-300' : 'bg-yellow-500/10 border-yellow-500/40 text-yellow-300'}`}>
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 4h.01M10.29 3.86l-7.6 13.15A1.5 1.5 0 003.9 19.5h16.2a1.5 1.5 0 001.31-2.49L13.81 3.86a1.5 1.5 0 00-2.62 0z" />
            </svg>
            <span>{aviso}</span>
          </div>
        </div>
      )}
      
      {/* New Chat Button */}
      <div className="px-3 py-3">
        <button 
          onClick={handleNewChat}
          className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium text-white bg-[#FF6B00] hover:bg-[#E05E00] rounded-md transition-colors duration-200 shadow-md"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Novo Chat
        </button>
      </div>
      
      {/* Chat History */}
      <div className="px-3 mt-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Histórico de Chats</h2>
          {chats.length > 0 && (
            <button 
              className="text-xs text-gray-400 hover:text-white transition-colors duration-200"
              title="Limpar histórico"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
        
        {/* Chat List */}
        <div className="overflow-y-auto max-h-[250px] pr-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
          {isLoading ? (
            <div className="flex justify-center items-center h-20">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-[#FF6B00]"></div>
            </div>
          ) : error ? (
            <div className="text-red-400 text-sm py-2 px-2 bg-red-400/10 rounded-md border border-red-400/20">
              {error}
              <button 
                onClick={() => setError(null)} 
                className="ml-2 text-red-400 hover:text-red-300"
              >
                ×
              </button>
            </div>
          ) : chats.length === 0 ? (
            expiredByApi ? (
              <div className="text-sm py-3 px-3 rounded-md border bg-red-500/10 border-red-500/40 text-red-300 text-center">
                <div className="flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 4h.01M10.29 3.86l-7.6 13.15A1.5 1.5 0 003.9 19.5h16.2a1.5 1.5 0 001.31-2.49L13.81 3.86a1.5 1.5 0 00-2.62 0z" />
                  </svg>
                  <span>
                    Seu histórico está indisponível porque seu plano expirou
                    { (apiDataExpiracao || user?.data_expiracao) ? ` em ${new Date(apiDataExpiracao || (user?.data_expiracao as string)).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}` : '' }.
                  </span>
                </div>
                <div className="mt-2">
                  <Link
                    href="https://app.bussolaexecutiva.com.br/renovar-executivia"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-3 py-1.5 rounded-md bg-[#FF6B00] hover:bg-[#E05E00] text-white text-xs font-medium"
                  >
                    Renovar Acesso
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-sm py-3 px-2 bg-gray-800/50 rounded-md border border-gray-700/50 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto mb-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Nenhum chat encontrado
              </div>
            )
          ) : (
            <ul className="space-y-1">
              {chats.map((chat) => {
                const chatDate = chat.created_at ? new Date(chat.created_at) : new Date();
                const formattedDate = chatDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                
                return (
                  <li key={chat.id}>
                    <Link 
                      href={`/dashboard/chat/${chat.id}`}
                      className="flex items-center px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors duration-200 group border border-transparent hover:border-gray-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 group-hover:text-[#FF6B00]" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                      </svg>
                      <div className="ml-2 flex-1 overflow-hidden">
                        <div className="truncate font-medium">{chat.title || `Chat ${chat.id.slice(0, 8)}`}</div>
                        <div className="text-xs text-gray-500 truncate flex items-center gap-2">
                          <span>{formattedDate}</span>
                          <span className={`${getAgentBadgeClass(chat.agent_type)} border px-2 py-0.5 rounded-full` }>
                            {getAgentLabel(chat.agent_type || 'comunicacao')}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      
      {/* Divider */}
      <div className="border-t border-gray-800 my-3 mx-3"></div>
      
      {/* Main Navigation */}
      <nav className="px-3 mb-auto">
        <ul className="space-y-1">
          <li>
            <Link 
              href="/dashboard"
              className="flex items-center px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors duration-200 group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-white" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              <span className="ml-3">Dashboard</span>
            </Link>
          </li>
          {AGENTS.map((agent) => (
            <li key={agent.type}>
              <Link
                href={`/dashboard/agent/${agent.type}`}
                className="flex items-center px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors duration-200 group"
              >
                <Image
                  src={agent.icon}
                  alt={agent.name}
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded object-contain bg-gray-950 border border-gray-700 group-hover:border-[#FF6B00]/60"
                />
                <span className="ml-3 line-clamp-2 leading-snug">{agent.name}</span>
              </Link>
            </li>
          ))}
          <li>
            <Link 
              href="/dashboard/apresentacao"
              className="hidden"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="ml-3">Apresentação para Reunião de Resultados</span>
            </Link>
          </li>
          <li>
            <Link 
              href="/dashboard/profile"
              className="flex items-center px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors duration-200 group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" />
              </svg>
              <span className="ml-3">Meu Perfil</span>
            </Link>
          </li>
        </ul>
      </nav>
      
      {/* Logout Button */}
      <div className="mt-auto p-4 border-t border-gray-800">
        <LogoutButton 
          variant="text" 
          className="w-full flex items-center px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-md transition-colors duration-200"
        />
      </div>
    </aside>
  );
};

export default Sidebar;
