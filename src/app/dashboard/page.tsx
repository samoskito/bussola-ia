"use client";

// @ts-ignore - Desativando verificações de tipo para JSX
// @ts-nocheck

import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ChatInterface from '@/components/chat/ChatInterface';

// Mock data - would come from database in real app
const mockChats = Array(10).fill(0).map((_, i) => ({
  id: `chat-${i + 1}`,
  title: 'Lorem ipsum dolor...',
}));

export default function DashboardPage() {
  return (
    <div className="flex h-screen w-full bg-dark-100 text-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar chats={mockChats} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header userName="Patrícia" />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <ChatInterface userName="Patrícia" />
        </main>
      </div>
    </div>
  );
}
