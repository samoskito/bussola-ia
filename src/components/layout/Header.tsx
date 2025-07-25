'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiSettings, FiLogOut, FiBell } from 'react-icons/fi';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import LogoutButton from '../auth/LogoutButton';

interface HeaderProps {
  userName?: string;
  title?: string;
  onMenuToggle?: () => void;
}

const Header: React.FC<HeaderProps> = ({ userName = 'Usuário', title, onMenuToggle }) => {
  const supabase = createClientComponentClient();
  const [userProfile, setUserProfile] = useState<any>(null);
  
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
            console.log('Perfil do usuário carregado:', data);
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

        <div className="flex items-center gap-2 bg-[#FF6B00]/10 px-3 py-2 rounded-lg shadow-inner">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#FF6B00]">
            <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-medium text-sm md:text-base">Bússola IA</span>
        </div>
        
        {title && (
          <div className="hidden md:flex items-center ml-4 pl-4 border-l border-gray-700">
            <h1 className="font-medium text-lg text-white">{title}</h1>
          </div>
        )}
        
        {/* Título visível apenas em mobile quando há título */}
        {title && (
          <div className="md:hidden flex items-center ml-3">
            <h1 className="font-medium text-sm text-white truncate max-w-[120px]">{title}</h1>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-3 md:space-x-4">
        <div className="flex items-center gap-2 px-3 py-2 bg-[#FF6B00]/5 rounded-lg shadow-inner">
          <div className="hidden md:block w-8 h-8 rounded-full bg-gray-700 flex-shrink-0 flex items-center justify-center">
            <span className="text-white text-xs font-bold">{userName.substring(0, 1).toUpperCase()}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-white">{userName}</p>
            <p className="text-xs text-gray-400 hidden md:block">{userProfile?.email || 'Usuário'}</p>
          </div>
        </div>
        
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
