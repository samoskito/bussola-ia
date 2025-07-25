"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Image from 'next/image';

// Definição dos agentes disponíveis
const agents = [
  {
    id: 'script-ia',
    name: 'ScriptIA',
    description: 'Gere scripts personalizados para suas necessidades',
    icon: '/assets/images/icons/script-icon.svg',
    path: '/dashboard'
  },
  {
    id: 'apresentacao-resultados',
    name: 'Apresentação de Resultado',
    description: 'Crie apresentações de resultados profissionais',
    icon: '/assets/images/icons/presentation-icon.svg',
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
                  className="bg-gray-800 rounded-lg p-6 flex flex-col items-center cursor-pointer hover:bg-gray-700 transition-colors duration-200 border border-gray-700 hover:border-orange-500"
                >
                  <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mb-4">
                    {agent.icon ? (
                      <Image 
                        src={agent.icon} 
                        alt={agent.name} 
                        width={48} 
                        height={48}
                        className="text-orange-500"
                        onError={(e) => {
                          // Fallback para ícone SVG embutido se a imagem falhar
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                            svg.setAttribute('width', '48');
                            svg.setAttribute('height', '48');
                            svg.setAttribute('viewBox', '0 0 24 24');
                            svg.setAttribute('fill', 'none');
                            svg.setAttribute('stroke', 'currentColor');
                            svg.setAttribute('stroke-width', '2');
                            svg.setAttribute('stroke-linecap', 'round');
                            svg.setAttribute('stroke-linejoin', 'round');
                            svg.innerHTML = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>';
                            parent.appendChild(svg);
                          }
                        }}
                      />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                    )}
                  </div>
                  <h2 className="text-xl font-semibold mb-2 text-orange-500">{agent.name}</h2>
                  <p className="text-gray-400 text-center">{agent.description}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
