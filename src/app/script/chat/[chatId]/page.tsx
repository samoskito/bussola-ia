'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import MobileMenu from '@/components/layout/MobileMenu';
import { ChatDetail } from '@/components/chat';
import { fetchUserChats } from '@/lib/supabase/client-utils-chat';


type ChatPageProps = {
  params: {
    chatId: string;
  };
};

export default function ChatPage({ params }: ChatPageProps) {
  const { user, loading } = useAuth();
  // Não podemos usar React.use() em Client Components
  // Acessar chatId diretamente dos params
  const chatId = params.chatId;
  const [chatTitle, setChatTitle] = useState<string>('Carregando...');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [chats, setChats] = useState<Array<{ id: string; title: string }>>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [chatType, setChatType] = useState<'script' | 'apresentacao' | undefined>();
  
  // Função para controlar a abertura/fechamento do menu mobile
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Função para fechar o menu mobile
  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };
  
  // Carregar os chats do usuário para o menu mobile
  useEffect(() => {
    const loadChats = async () => {
      try {
        // Garantir que estamos no navegador antes de fazer a chamada
        if (typeof window !== 'undefined') {
          setIsLoadingChats(true);
          const { chats: userChats, error } = await fetchUserChats();
          
          if (error) {
            console.error('Erro ao carregar chats:', error);
            return;
          }
          
          if (userChats && userChats.length > 0) {
            setChats(userChats);
          }
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

  useEffect(() => {
    // Verificar se há parâmetro de tipo na URL
    const urlParams = new URLSearchParams(window.location.search);
    const typeParam = urlParams.get('type');
    
    if (typeParam === 'apresentacao') {
      console.log('[ChatPage] Detectado tipo de chat da URL: apresentacao');
      setChatType('apresentacao');
    }
  }, []);

  useEffect(() => {
    // Função para buscar detalhes do chat
    const fetchChatDetails = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/chats/${chatId}`);
        
        if (!response.ok) {
          throw new Error('Erro ao carregar detalhes do chat');
        }
        
        const data = await response.json();
        if (data.chat) {
          setChatTitle(data.chat.title || 'Chat sem título');
          
          // Detectar tipo de chat pelo título
          const title = data.chat.title.toLowerCase();
          if (title.includes('apresentação') || title.includes('reuniao')) {
            console.log('[ChatPage] Detectado tipo de chat pelo título: apresentacao');
            setChatType('apresentacao');
          } else {
            console.log('[ChatPage] Detectado tipo de chat pelo título: script (padrão)');
            setChatType('script');
          }
        }
      } catch (err) {
        console.error('Erro ao buscar detalhes do chat:', err);
        setError('Não foi possível carregar os detalhes do chat');
      } finally {
        setIsLoading(false);
      }
    };

    if (chatId) {
      fetchChatDetails();
    }
  }, [chatId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Será redirecionado pelo middleware
  }

  return (
    <div className="flex h-screen w-full bg-gray-900 text-white overflow-hidden">
      {/* Sidebar - visível apenas em desktop */}
      <div className="hidden lg:flex lg:w-64 xl:w-72 2xl:w-80 border-r border-gray-800 shadow-xl">
        <Sidebar />
      </div>
      
      {/* Menu Mobile - overlay quando aberto */}
      <MobileMenu 
        isOpen={isMobileMenuOpen} 
        onClose={closeMobileMenu} 
        chats={chats}
      />
      
      <div className="flex flex-col flex-1 overflow-hidden w-full">
        <Header 
          userName={user?.nome || 'Usuário'} 
          title={chatTitle} 
          onMenuToggle={toggleMobileMenu}
        />
        
        <main className="flex-1 overflow-hidden bg-gradient-to-b from-gray-900 to-gray-950 w-full">
          <div className="h-full w-full">
            {error ? (
              <div className="flex h-full items-center justify-center p-4">
                <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-500 px-6 py-4 rounded-lg max-w-md text-center shadow-lg">
                  <p className="text-lg font-medium mb-2">Erro</p>
                  <p>{error}</p>
                </div>
              </div>
            ) : (
              <ChatDetail 
                chatId={chatId} 
                userName={user?.nome || 'Usuário'}
                chatType={chatType}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
