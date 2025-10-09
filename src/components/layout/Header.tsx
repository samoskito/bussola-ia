'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiSettings, FiLogOut, FiBell } from 'react-icons/fi';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import LogoutButton from '../auth/LogoutButton';
import { useAuth } from '@/contexts/AuthContext';

interface HeaderProps {
  userName?: string;
  title?: string;
  onMenuToggle?: () => void;
  agentType?: 'comunicacao' | 'apresentacao';
  daysRemaining?: number;
}

const Header: React.FC<HeaderProps> = ({ userName = 'Usuário', title, onMenuToggle, agentType, daysRemaining }) => {
  const supabase = createClientComponentClient();
  const [userProfile, setUserProfile] = useState<any>(null);
  const { user: authUser } = useAuth();
  
  // Buscar dados do usuário do Supabase
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        // Obter a sessão atual
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user?.id) {
          // Buscar perfil do usuário
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          if (data && !error) {
            setUserProfile(data);
            if (process.env.NODE_ENV !== 'production') {
              // eslint-disable-next-line no-console
              console.log('Perfil do usuário carregado:', data);
            }
          } else if (error) {
            console.error('Erro ao buscar perfil do usuário:', error);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
      }
    };
    
    fetchUserProfile();
  }, [supabase]);
  
  return (
    <header className="relative z-50 flex items-center justify-between p-3 md:p-5 bg-gray-900 border-b border-gray-800 shadow-lg w-full h-[80px] sticky top-0">
      <div className="flex items-center">
        {/* Botão de menu - visível apenas em mobile */}
        <button 
          className="lg:hidden mr-3 p-2 rounded-lg bg-[#FF6B00]/10 hover:bg-[#FF6B00]/20 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#FF6B00] active:scale-95"
          onClick={onMenuToggle}
          aria-label="Abrir menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#FF6B00]">
            <path d="M4 6H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="flex items-center gap-1.5 md:gap-2 bg-[#FF6B00]/10 px-2 py-1 md:px-3 md:py-2 rounded-lg shadow-inner">
          <Image 
            src="/images/executivia-logo.png" 
            alt="ExecutivIA Logo" 
            width={28} 
            height={28}
            className="object-contain"
          />
          <span className="hidden sm:inline font-medium text-sm md:text-base">ExecutivIA</span>
        </div>
        
        {title && (
          <div className="hidden md:flex items-center ml-4 pl-4 border-l border-gray-700 gap-2">
            <h1 className="font-medium text-lg text-white">{title}</h1>
            {agentType && (
              <span className={`text-xs px-2 py-0.5 rounded-full border ${agentType === 'apresentacao' ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' : 'bg-[#FF6B00]/20 border-[#FF6B00]/30 text-[#FF6B00]'}`}>
                {agentType === 'apresentacao' ? 'Apresentação' : 'Comunicação'}
              </span>
            )}
          </div>
        )}
        
        {/* Título visível apenas em mobile quando há título */}
        {title && (
          <div className="md:hidden flex items-center ml-2 gap-2 flex-1 min-w-0">
            <h1 className="font-medium text-sm text-white truncate max-w-[50vw]">{title}</h1>
            {agentType && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${agentType === 'apresentacao' ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' : 'bg-[#FF6B00]/20 border-[#FF6B00]/30 text-[#FF6B00]'}`}>
                {agentType === 'apresentacao' ? 'Apresentação' : 'Comunicação'}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2 md:space-x-4">
        {/* Perfil (desktop) */}
        <Link href="/dashboard/profile" className="hidden md:flex items-center gap-2 px-3 py-2 bg-[#FF6B00]/5 rounded-lg shadow-inner hover:bg-[#FF6B00]/10 transition-colors">
          <div className="hidden md:block w-8 h-8 rounded-full bg-gray-700 flex-shrink-0 overflow-hidden">
            { (userProfile?.avatar || authUser?.avatar) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={(userProfile?.avatar || authUser?.avatar) as string} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">{userName.substring(0, 1).toUpperCase()}</span>
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{userName}</p>
            <p className="text-xs text-gray-400 hidden md:block">{userProfile?.email || authUser?.email || 'Usuário'}</p>
          </div>
        </Link>

        {/* Perfil (mobile compacto) */}
        <Link href="/dashboard/profile" className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#FF6B00]/10 hover:bg-[#FF6B00]/20 transition-colors overflow-hidden">
          { (userProfile?.avatar || authUser?.avatar) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={(userProfile?.avatar || authUser?.avatar) as string} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-white text-xs font-bold">{userName.substring(0, 1).toUpperCase()}</span>
          )}
        </Link>
        
        {typeof daysRemaining === 'number' && daysRemaining <= 7 && (
          <div className={`hidden md:flex items-center gap-2 px-3 py-1 rounded-full border ${daysRemaining <= 0 ? 'bg-red-500/10 border-red-500/40 text-red-300' : daysRemaining <= 3 ? 'bg-red-500/10 border-red-500/40 text-red-300' : 'bg-yellow-500/10 border-yellow-500/40 text-yellow-300'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 4h.01M10.29 3.86l-7.6 13.15A1.5 1.5 0 003.9 19.5h16.2a1.5 1.5 0 001.31-2.49L13.81 3.86a1.5 1.5 0 00-2.62 0z" />
            </svg>
            <span className="text-xs">
              {daysRemaining <= 0 ? 'Plano expirado' : `Expira em ${daysRemaining} dia${daysRemaining === 1 ? '' : 's'}`}
            </span>
          </div>
        )}

        <div className="hidden md:block">
          <LogoutButton />
        </div>
        
        <div className="md:hidden">
          <button 
            className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors duration-200"
            onClick={() => window.location.href = '/dashboard'}
            aria-label="Voltar ao Dashboard"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
              <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
