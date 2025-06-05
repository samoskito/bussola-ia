"use client";

// @ts-ignore - Desativando verificações de tipo para JSX
// @ts-nocheck

import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ChatInterface from '@/components/chat/ChatInterface';

// Mock data - would come from database in real app
const mockProjects = [
  { id: '1', name: 'Projeto X' },
  { id: '2', name: 'Projeto Y' },
  { id: '3', name: 'Projeto Z', isActive: true },
  { id: '4', name: 'Projeto W' },
];

const mockChats = Array(10).fill(0).map((_, i) => ({
  id: `chat-${i + 1}`,
  title: 'Lorem ipsum dolor...',
}));

const mockAgents = [
  { id: '1', name: 'BússolaScriptIA', isActive: true },
  { id: '2', name: 'BússolaScriptIA' },
  { id: '3', name: 'BússolaScriptIA' },
  { id: '4', name: 'BússolaScriptIA' },
  { id: '5', name: 'BússolaScriptIA' },
  { id: '6', name: 'BússolaScriptIA' },
];

export default function DashboardPage() {
  return (
    <div className="flex h-screen bg-dark-100 text-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar projects={mockProjects} chats={mockChats} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header userName="Patrícia" />
        
        <main className="flex-1 overflow-y-auto p-6">
          <ChatInterface userName="Patrícia" agents={mockAgents} />
        </main>
      </div>
    </div>
  );
}
