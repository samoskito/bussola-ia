'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { fetchUserChats } from '@/lib/supabase/client-utils-chat';
import { useRouter } from 'next/navigation';
import LogoutButton from '@/components/auth/LogoutButton';

type Chat = {
  id: string;
  title: string;
  created_at?: string;
};

interface SidebarProps {
  initialChats?: Chat[];
}

const Sidebar: React.FC<SidebarProps> = ({ initialChats = [] }) => {
  const [chats, setChats] = useState<Chat[]>(initialChats);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  useEffect(() => {
    const loadChats = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const { chats: userChats, error } = await fetchUserChats();
        
        if (error) {
          setError(error);
          return;
        }
        
        if (userChats && userChats.length > 0) {
          setChats(userChats);
        }
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
      <div className="p-4 bg-gray-800">
        <Link href="/dashboard">
          <div className="flex items-center justify-center">
            <Image 
              src="/assets/images/logos/LOGO-BUSSOLA-LARANJA-E-BRANCO-1024x373.webp" 
              alt="Bússola Executiva" 
              width={150} 
              height={55} 
              className="object-contain w-auto h-auto"
              priority
            />
          </div>
        </Link>
      </div>
      
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
        <div className="overflow-y-auto max-h-[calc(100vh-280px)] pr-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
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
            <div className="text-gray-500 text-sm py-3 px-2 bg-gray-800/50 rounded-md border border-gray-700/50 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto mb-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Nenhum chat encontrado
            </div>
          ) : (
            <ul className="space-y-1">
              {chats.map((chat) => {
                const chatDate = chat.created_at ? new Date(chat.created_at) : new Date();
                const formattedDate = chatDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                
                return (
                  <li key={chat.id}>
                    <Link 
                      href={`/script/chat/${chat.id}`}
                      className="flex items-center px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors duration-200 group border border-transparent hover:border-gray-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 group-hover:text-[#FF6B00]" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                      </svg>
                      <div className="ml-2 flex-1 overflow-hidden">
                        <div className="truncate font-medium">{chat.title || `Chat ${chat.id.slice(0, 8)}`}</div>
                        <div className="text-xs text-gray-500 truncate">{formattedDate}</div>
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
          <li>
            <Link 
              href="/script"
              className="flex items-center px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors duration-200 group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              <span className="ml-3">Gerar Scripts</span>
            </Link>
          </li>
          <li>
            <Link 
              href="/dashboard/apresentacao"
              className="flex items-center px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors duration-200 group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="ml-3">Apresentação de Resultado</span>
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
