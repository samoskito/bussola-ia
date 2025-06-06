"use client";

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ChatInterface from '@/components/chat/ChatInterface';
import { useAuth } from '@/contexts/AuthContext';

// Os chats agora são carregados diretamente do Supabase no componente Sidebar

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
  
  return (
    <div className="flex h-screen w-full bg-gray-900 text-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header userName={userName} />
        
        <main className="flex-1 overflow-hidden bg-gradient-to-b from-gray-900 to-gray-950">
          <div className="h-full max-w-7xl mx-auto w-full">
            <ChatInterface userName={userName} />
          </div>
        </main>
      </div>
    </div>
  );
}
