'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import ChatDetail from '@/components/chat/ChatDetail';


type ChatPageProps = {
  params: {
    chatId: string;
  };
};

export default function ChatPage({ params }: ChatPageProps) {
  const { user, loading } = useAuth();
  const chatId = params.chatId;
  const [chatTitle, setChatTitle] = useState<string>('Carregando...');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header userName={user?.nome || 'Usuário'} title={chatTitle} />
        
        <main className="flex-1 overflow-hidden bg-gradient-to-b from-gray-900 to-gray-950">
          <div className="h-full w-full">
            <ChatDetail chatId={chatId} userName={user?.nome || 'Usuário'} />
          </div>
        </main>
      </div>
    </div>
  );
}
