"use client";

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import MobileMenu from '@/components/layout/MobileMenu';
import ChatInterface from '@/components/chat/ChatInterface';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserChats } from '@/lib/supabase/client-utils-chat';

export default function DashboardPage() {
  const { user } = useAuth();
  const [userName, setUserName] = useState('Usuário');
  
  useEffect(() => {
    if (user && user.nome) {
      setUserName(user.nome);
    } else if (user && user.email) {
      // Se não tiver nome, usa a parte antes do @ do email
      const emailName = user.email.split('@')[0];
      setUserName(emailName.charAt(0).toUpperCase() + emailName.slice(1));
    }
  }, [user]);
  
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
  
  // Carregar os chats do usuário
  useEffect(() => {
    const loadChats = async () => {
      try {
        setIsLoadingChats(true);
        console.log('Carregando chats do usuário...');
        const { chats: userChats, error } = await fetchUserChats();
        
        console.log('Resposta da API de chats:', { userChats, error });
        
        if (error) {
          console.error('Erro ao carregar chats:', error);
          return;
        }
        
        if (userChats && userChats.length > 0) {
          console.log('Chats carregados com sucesso:', userChats);
          setChats(userChats);
        } else {
          console.log('Nenhum chat encontrado para o usuário');
        }
      } catch (err) {
        console.error('Erro ao carregar chats:', err);
      } finally {
        setIsLoadingChats(false);
      }
    };
    
    loadChats();
  }, []);
  
  // Log para verificar os chats no estado
  useEffect(() => {
    console.log('Estado atual dos chats:', chats);
  }, [chats]);
  
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
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          userName={userName} 
          onMenuToggle={toggleMobileMenu}
        />
        
        <main className="flex-1 overflow-hidden bg-gradient-to-b from-gray-900 to-gray-950">
          <div className="h-full max-w-7xl mx-auto w-full">
            <ChatInterface userName={userName} />
          </div>
        </main>
      </div>
    </div>
  );
}
