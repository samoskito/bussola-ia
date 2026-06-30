"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import LogoutButton from '../auth/LogoutButton';
import Image from 'next/image';
import type { AgentType } from '@/lib/agents';
import { AGENTS, getAgentLabel, isAgentAvailableForUser } from '@/lib/agents';
import { useAuth } from '@/contexts/AuthContext';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  chats: Array<{ id: string; title: string; agent_type?: AgentType | null }>;
}

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

const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose, chats }) => {
  const { user } = useAuth();

  // Log para verificar os chats recebidos pelo MobileMenu
  useEffect(() => {
    if (isOpen) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('MobileMenu aberto - chats recebidos:', chats);
      }
    }
  }, [isOpen, chats]);
  
  // Fechar o menu quando pressionar ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Prevenir rolagem do body quando o menu estiver aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Simplificando a verificação de rota ativa usando window.location
  const isActive = (path: string) => {
    if (typeof window !== 'undefined') {
      return window.location.pathname === path;
    }
    return false;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] lg:hidden">
      {/* Overlay com efeito de fade */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Menu lateral com efeito de slide */}
      <div className="fixed left-0 top-0 bottom-0 w-80 bg-gray-900 flex flex-col z-50 overflow-y-auto transform transition-all duration-300 ease-in-out shadow-xl border-r border-gray-800">
        <div className="p-5 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center" onClick={onClose}>
              <Image 
                src="/images/executivia-logo.png" 
                alt="ExecutivIA" 
                width={100}
                height={100}
                className="h-10 w-auto object-contain"
              />
            </Link>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#FF6B00] active:scale-95 transition-all duration-200"
              aria-label="Fechar menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-5 space-y-2">
          <Link 
            href="/dashboard"
            className={`flex items-center px-4 py-3 rounded-lg text-base font-medium ${isActive('/dashboard') ? 'bg-[#FF6B00]/10 text-[#FF6B00]' : 'text-gray-300 hover:bg-gray-800 hover:text-white'} transition-all duration-200`}
            onClick={onClose}
          >
            <svg className="w-5 h-5 mr-3 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </Link>

          {AGENTS.map((agent) => {
            const href = `/dashboard/agent/${agent.type}`;
            const isLocked = !isAgentAvailableForUser(agent.type, user?.nivel);
            const content = (
              <>
                <Image
                  src={agent.icon}
                  alt={agent.name}
                  width={24}
                  height={24}
                  className="h-6 w-6 mr-3 rounded object-contain bg-gray-950 border border-gray-700"
                />
                <span className="leading-snug flex-1">{agent.name}</span>
                {isLocked && (
                  <span className="ml-2 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-semibold text-yellow-300">
                    {agent.availabilityLabel}
                  </span>
                )}
              </>
            );

            return (
              isLocked ? (
                <div
                  key={agent.type}
                  className="flex items-center px-4 py-3 rounded-lg text-base font-medium text-gray-500 cursor-not-allowed"
                >
                  {content}
                </div>
              ) : (
                <Link
                  key={agent.type}
                  href={href}
                  className={`flex items-center px-4 py-3 rounded-lg text-base font-medium ${isActive(href) ? 'bg-[#FF6B00]/10 text-[#FF6B00]' : 'text-gray-300 hover:bg-gray-800 hover:text-white'} transition-all duration-200`}
                  onClick={onClose}
                >
                  {content}
                </Link>
              )
            );
          })}
          
          <Link 
            href="/dashboard/apresentacao"
            className="hidden"
            onClick={onClose}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-3 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Apresentação para Reunião de Resultados</span>
          </Link>

          {/* Meu Perfil no final */}
          <Link 
            href="/dashboard/profile"
            className={`flex items-center px-4 py-3 rounded-lg text-base font-medium ${isActive('/dashboard/profile') ? 'bg-[#FF6B00]/10 text-[#FF6B00]' : 'text-gray-300 hover:bg-gray-800 hover:text-white'} transition-all duration-200`}
            onClick={onClose}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-3 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" />
            </svg>
            Meu Perfil
          </Link>
        </nav>

        {/* Chats Section */}
        <div className="px-4 py-4 border-t border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-300 tracking-wide">Seus chats</h3>
            <Link 
              href="/script"
              className="p-1.5 rounded-full bg-[#FF6B00]/10 hover:bg-[#FF6B00]/20 text-[#FF6B00] transition-colors duration-200"
              onClick={onClose}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </Link>
          </div>
          <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
            {chats && chats.length > 0 ? (
              chats.map((chat) => (
                <Link
                  key={chat.id}
                  href={`/dashboard/chat/${chat.id}`}
                  className={`flex items-center px-4 py-2.5 text-sm rounded-lg ${isActive(`/dashboard/chat/${chat.id}`) ? 'bg-[#FF6B00]/10 text-[#FF6B00]' : 'text-gray-300 hover:bg-gray-800 hover:text-white'} transition-all duration-200`}
                  onClick={onClose}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-current mr-2.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                  </svg>
                  <span className="truncate flex-1">{chat.title || 'Chat sem título'}</span>
                  <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full border ${getAgentBadgeClass(chat.agent_type)}`}>
                    {getAgentLabel(chat.agent_type || 'comunicacao')}
                  </span>
                </Link>
              ))
            ) : (
              <div className="text-sm text-gray-400 py-3 px-4 bg-gray-800/30 rounded-lg text-center">
                Nenhum chat encontrado
              </div>
            )}
          </div>
        </div>

        {/* Logout Button */}
        <div className="p-5 border-t border-gray-700 mt-auto">
          <button 
            onClick={async () => {
              onClose();
              // Redirecionar para a página de login após logout
              window.location.href = '/auth/login?logged_out=true';
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-all duration-200 shadow-inner"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sair da conta</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileMenu;
