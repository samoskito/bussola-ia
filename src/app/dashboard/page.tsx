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
    <div className="flex h-screen w-full bg-dark-100 text-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header userName={userName} />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <ChatInterface userName={userName} />
        </main>
      </div>
    </div>
  );
}
