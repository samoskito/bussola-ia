"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Image from 'next/image';

// Definição dos agentes disponíveis
const agents = [
  {
    id: 'comunicacao-executiva',
    name: 'Comunicação Executiva',
    description: 'Gere scripts personalizados para suas necessidades',
    icon: '/images/comunicacao-executiva-logo.png',
    path: '/dashboard'
  },
  {
    id: 'apresentacao-resultados',
    name: 'Apresentação para Reunião de Resultados',
    description: 'Crie apresentações de resultados profissionais',
    icon: '/images/apresentacao-resultados-logo.png',
    path: '/dashboard/apresentacao'
  }
];

export default function AgentSelectionPage() {
  const router = useRouter();

  const handleAgentSelection = (path: string) => {
    router.push(path);
  };

  return (
    <div className="flex h-screen bg-dark-100 text-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header userName="Usuário" />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-center">Selecione um Agente</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {agents.map((agent) => (
                <div 
                  key={agent.id}
                  onClick={() => handleAgentSelection(agent.path)}
                  className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-8 flex flex-col items-center cursor-pointer hover:from-gray-700 hover:to-gray-800 transition-all duration-300 border-2 border-gray-700 hover:border-[#FF6B00] shadow-xl hover:shadow-2xl hover:scale-[1.02] group"
                >
                  {/* Container da imagem sem círculo */}
                  <div className="relative mb-6 p-4 bg-gray-900/50 rounded-xl border border-gray-700 group-hover:border-[#FF6B00]/50 transition-all duration-300 shadow-lg">
                    {agent.icon ? (
                      <Image 
                        src={agent.icon} 
                        alt={agent.name} 
                        width={160} 
                        height={160}
                        className="w-40 h-40 object-contain"
                        onError={(e) => {
                          // Fallback para ícone SVG embutido se a imagem falhar
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                            svg.setAttribute('width', '160');
                            svg.setAttribute('height', '160');
                            svg.setAttribute('viewBox', '0 0 24 24');
                            svg.setAttribute('fill', 'none');
                            svg.setAttribute('stroke', 'currentColor');
                            svg.setAttribute('stroke-width', '2');
                            svg.setAttribute('stroke-linecap', 'round');
                            svg.setAttribute('stroke-linejoin', 'round');
                            svg.setAttribute('class', 'text-[#FF6B00]');
                            svg.innerHTML = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>';
                            parent.appendChild(svg);
                          }
                        }}
                      />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#FF6B00]">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                    )}
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
