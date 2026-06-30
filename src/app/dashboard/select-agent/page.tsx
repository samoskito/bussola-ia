"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Image from 'next/image';
import MobileMenu from '@/components/layout/MobileMenu';
import { AGENTS } from '@/lib/agents';

export default function AgentSelectionPage() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const toggleMobileMenu = () => setIsMobileMenuOpen((v) => !v);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleAgentSelection = (agentType: string) => {
    router.push(`/dashboard/agent/${agentType}`);
  };

  return (
    <div className="flex h-screen bg-dark-100 text-white overflow-hidden">
      <Sidebar />

      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={closeMobileMenu}
        chats={[]}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header userName="Usuario" onMenuToggle={toggleMobileMenu} />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-center">Selecione um Agente</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {AGENTS.map((agent) => (
                <div
                  key={agent.type}
                  onClick={() => handleAgentSelection(agent.type)}
                  className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-8 flex flex-col items-center cursor-pointer hover:from-gray-700 hover:to-gray-800 transition-all duration-300 border-2 border-gray-700 hover:border-[#FF6B00] shadow-xl hover:shadow-2xl hover:scale-[1.02] group"
                >
                  <div className="relative mb-6 p-4 bg-gray-900/50 rounded-xl border border-gray-700 group-hover:border-[#FF6B00]/50 transition-all duration-300 shadow-lg">
                    <Image
                      src={agent.icon}
                      alt={agent.name}
                      width={160}
                      height={160}
                      className="w-40 h-40 object-contain"
                    />
                  </div>
                  <h2 className="text-xl font-bold mb-3 text-[#FF6B00] group-hover:text-orange-400 transition-colors duration-300 text-center">{agent.name}</h2>
                  <p className="text-gray-400 text-center leading-relaxed">{agent.description}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
