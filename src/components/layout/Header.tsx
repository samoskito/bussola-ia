'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiSettings, FiLogOut, FiBell } from 'react-icons/fi';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import LogoutButton from '../auth/LogoutButton';
import MobileMenu from './MobileMenu';

interface HeaderProps {
  userName?: string;
  title?: string;
}

interface Chat {
  id: string;
  title: string;
}

const Header: React.FC<HeaderProps> = ({ userName = 'Usuário', title }) => {
  const supabase = createClientComponentClient();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
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
  
  // Mock data para chats
  useEffect(() => {
    const mockChats = Array(5).fill(0).map((_, i) => ({
      id: `chat-${i + 1}`,
      title: `Chat ${i + 1}`,
    }));
    setChats(mockChats);
  }, []);
  
  return (
    <header className="relative z-50 flex items-center justify-between p-3 md:p-4 bg-gray-900 border-b border-gray-800 shadow-md w-full h-[80px]">
      <div className="flex items-center">
        {/* Botão de menu - visível apenas em mobile */}
        <button 
          className="lg:hidden mr-3 p-2 rounded-lg bg-[#FF6B00]/10 hover:bg-[#FF6B00]/20 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-[#FF6B00]"
          onClick={() => setIsMenuOpen(true)}
          aria-label="Abrir menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#FF6B00]">
            <path d="M4 6H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="flex items-center gap-2 bg-[#FF6B00]/5 px-3 py-2 rounded-lg">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#FF6B00]">
            <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-medium text-sm md:text-base">Bússola IA</span>
        </div>
        
        {title && (
          <div className="hidden md:flex items-center ml-4 pl-4 border-l border-gray-700">
            <h1 className="font-medium text-lg text-white">{title}</h1>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center gap-3 px-3 py-2 bg-primary-500/10 rounded-lg">
          <div>
            <p className="text-sm font-medium text-white">{userName}</p>
            <p className="text-xs text-gray-400">{userProfile?.email || 'Usuário'}</p>
          </div>
        </div>
        
        <div className="hidden md:block">
          <LogoutButton />
        </div>
      </div>
      
      {/* Menu mobile que aparece quando isMenuOpen é true */}
      {isMenuOpen && (
        <div className="fixed inset-x-0 top-16 z-40 bg-gray-900 border-t border-gray-800 shadow-lg px-4 py-3 space-y-2 lg:hidden">
          <Link 
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors duration-200"
            onClick={() => setIsMenuOpen(false)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 text-gray-400">
              <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" 
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 22V12H15V22" 
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm font-medium">Dashboard</span>
          </Link>
          
          <Link 
            href="/dashboard/scripts"
            className="flex items-center gap-3 px-3 py-2 text-primary-500 bg-primary-500/10 font-medium rounded-lg"
            onClick={() => setIsMenuOpen(false)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
              <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" 
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 2V8H20" 
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 13H8" 
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 17H8" 
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 9H9H8" 
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm">Scripts</span>
          </Link>
          
          <Link 
            href="/dashboard/profile"
            className="flex items-center gap-3 px-3 py-2 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors duration-200"
            onClick={() => setIsMenuOpen(false)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 text-gray-400">
              <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" 
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" 
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm font-medium">Perfil</span>
          </Link>
          
          <div className="pt-2 mt-2 border-t border-gray-800">
            <div className="md:hidden">
              <LogoutButton variant="full" />
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
