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
  // Desestruturar chatId diretamente de params para compatibilidade com Next.js 15
  const { chatId } = params;
  const [chatTitle, setChatTitle] = useState<string>('Carregando...');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [chats, setChats] = useState<Array<{ id: string; title: string }>>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  
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
        setIsLoadingChats(true);
        const { chats: userChats, error } = await fetchUserChats();
        
        if (error) {
          console.error('Erro ao carregar chats:', error);
          return;
        }
        
        if (userChats && userChats.length > 0) {
          setChats(userChats);
        }
      } catch (err) {
        console.error('Erro ao carregar chats:', err);
      } finally {
        setIsLoadingChats(false);
      }
    };
    
    loadChats();
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
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      
      {/* Menu Mobile */}
      <MobileMenu 
        isOpen={isMobileMenuOpen} 
        onClose={closeMobileMenu} 
        chats={chats}
      />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header 
          userName={user?.nome || 'Usuário'} 
          title={chatTitle} 
          onMenuToggle={toggleMobileMenu}
        />
        
        <main className="flex-1 overflow-hidden bg-gradient-to-b from-gray-900 to-gray-950">
          <div className="h-full w-full">
            <ChatDetail chatId={chatId} userName={user?.nome || 'Usuário'} />
          </div>
        </main>
      </div>
    </div>
  );
}
