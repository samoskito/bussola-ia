"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LogoutButton from '../auth/LogoutButton';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  chats: Array<{ id: string; title: string }>;
}

const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose, chats }) => {
  const router = useRouter();
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
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Menu */}
      <div className="fixed left-0 top-0 bottom-0 w-72 bg-gray-900 flex flex-col z-50 overflow-y-auto transform transition-all duration-300 ease-in-out shadow-xl border-r border-gray-800">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center">
              <img 
                src="/assets/images/logos/LOGO-BUSSOLA-LARANJA-E-BRANCO-1024x373.webp" 
                alt="Bússola Executiva" 
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
          <Link 
            href="/dashboard"
            className={`flex items-center px-4 py-3 rounded-md text-base font-medium ${isActive('/dashboard') ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
            onClick={onClose}
          >
            <svg className="w-5 h-5 mr-3 text-gray-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </Link>

          <Link 
            href="/dashboard/scripts"
            className={`flex items-center px-4 py-3 rounded-md text-base font-medium ${isActive('/dashboard/scripts') ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
            onClick={onClose}
          >
            <svg className="w-5 h-5 mr-3 text-gray-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Gerar Scripts
          </Link>

          <Link 
            href="/dashboard/scripts/saved"
            className={`flex items-center px-4 py-3 rounded-md text-base font-medium ${isActive('/dashboard/scripts/saved') ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
            onClick={onClose}
          >
            <svg className="w-5 h-5 mr-3 text-gray-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Scripts Salvos
          </Link>

          <Link 
            href="/dashboard/profile"
            className={`flex items-center px-4 py-3 rounded-md text-base font-medium ${isActive('/dashboard/profile') ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
            onClick={onClose}
          >
            <svg className="w-5 h-5 mr-3 text-gray-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Perfil
          </Link>

          <Link 
            href="/dashboard/help"
            className={`flex items-center px-4 py-3 rounded-md text-base font-medium ${isActive('/dashboard/help') ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
            onClick={onClose}
          >
            <svg className="w-5 h-5 mr-3 text-gray-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Ajuda
          </Link>
        </nav>

        {/* Chats Section */}
        <div className="px-2 py-2 border-t border-gray-700">
          <div className="px-4 py-2">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Seus chats</h3>
            <div className="space-y-1">
              {chats.map((chat) => (
                <Link
                  key={chat.id}
                  href={`/dashboard/chat/${chat.id}`}
                  className={`flex items-center px-3 py-2 text-sm rounded-md ${isActive(`/dashboard/chat/${chat.id}`) ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                  onClick={onClose}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 mr-2 group-hover:text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                  </svg>
                  <span className="truncate">{chat.title}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={() => {
              // Implementar lógica de logout aqui
              router.push('/auth/logout');
            }}
            className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-md transition-colors duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
            </svg>
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileMenu;
