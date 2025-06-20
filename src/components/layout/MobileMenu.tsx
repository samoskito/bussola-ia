"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LogoutButton from '../auth/LogoutButton';
import Image from 'next/image';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  chats: Array<{ id: string; title: string }>;
}

const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose, chats }) => {
  const router = useRouter();
  
  // Log para verificar os chats recebidos pelo MobileMenu
  useEffect(() => {
    if (isOpen) {
      console.log('MobileMenu aberto - chats recebidos:', chats);
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
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Overlay com efeito de fade */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Menu lateral com efeito de slide */}
      <div className="fixed left-0 top-0 bottom-0 w-72 bg-gray-900 flex flex-col z-50 overflow-y-auto transform transition-all duration-300 ease-in-out shadow-xl border-r border-gray-800">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center" onClick={onClose}>
              <Image 
                src="/assets/images/logos/LOGO-BUSSOLA-LARANJA-E-BRANCO-1024x373.webp" 
                alt="Bússola Executiva" 
                width={150}
                height={55}
                className="h-10 w-auto object-contain"
              />
            </Link>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-primary-500"
              aria-label="Fechar menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          <div 
            className="flex items-center px-4 py-3 rounded-md text-base font-medium text-gray-500 cursor-not-allowed"
          >
            <svg className="w-5 h-5 mr-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>

          <Link 
            href="/dashboard"
            className={`flex items-center px-4 py-3 rounded-md text-base font-medium ${isActive('/dashboard') ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
            onClick={onClose}
          >
            <svg className="w-5 h-5 mr-3 text-gray-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Gerar Scripts
          </Link>
        </nav>

        {/* Chats Section */}
        <div className="px-2 py-2 border-t border-gray-700">
          <div className="px-4 py-2">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Seus chats</h3>
            <div className="space-y-1">
              {chats && chats.length > 0 ? (
                chats.map((chat) => (
                  <Link
                    key={chat.id}
                    href={`/dashboard/chat/${chat.id}`}
                    className={`flex items-center px-3 py-2 text-sm rounded-md ${isActive(`/dashboard/chat/${chat.id}`) ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                    onClick={onClose}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 mr-2 group-hover:text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                    </svg>
                    <span className="truncate">{chat.title || 'Chat sem título'}</span>
                  </Link>
                ))
              ) : (
                <div className="text-sm text-gray-400 py-2">Nenhum chat encontrado</div>
              )}
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-700">
          <LogoutButton 
            variant="full" 
            className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-md transition-colors duration-200"
            onClick={onClose}
          />
        </div>
      </div>
    </div>
  );
};

export default MobileMenu;
