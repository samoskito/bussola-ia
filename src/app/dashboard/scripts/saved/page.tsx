import * as React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { getScripts } from '@/lib/supabase';

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

// Mock scripts - would come from Supabase in real app
const mockScripts = [
  {
    id: '1',
    title: 'Planejamento Estratégico Q3',
    created_at: '2025-05-10T14:30:00Z',
    content: '# Script para Reunião: Planejamento Estratégico Q3...'
  },
  {
    id: '2',
    title: 'Reunião de Equipe Semanal',
    created_at: '2025-05-12T10:00:00Z',
    content: '# Script para Reunião: Reunião de Equipe Semanal...'
  },
  {
    id: '3',
    title: 'Apresentação de Resultados',
    created_at: '2025-05-13T16:45:00Z',
    content: '# Script para Reunião: Apresentação de Resultados...'
  }
];

export default function SavedScriptsPage() {
  // Na implementação real, buscaríamos os scripts do usuário do Supabase
  // const scripts = await getScripts(userId);
  
  return (
    <div className="flex h-screen bg-dark-100 text-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar projects={mockProjects} chats={mockChats} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header userName="Patrícia" />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold">Scripts Salvos</h1>
              <Link href="/dashboard/scripts" className="btn-primary py-2 px-4">
                Criar Novo Script
              </Link>
            </div>
            
            <div className="bg-dark-200 rounded-lg p-6">
              {mockScripts.length > 0 ? (
                <div className="space-y-4">
                  {mockScripts.map((script) => (
                    <div key={script.id} className="bg-dark-300 p-4 rounded-md">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-semibold text-primary">{script.title}</h3>
                          <p className="text-sm text-gray-400">
                            Criado em: {new Date(script.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <button className="btn-secondary py-1 px-3 text-sm">
                            Visualizar
                          </button>
                          <button className="btn-secondary py-1 px-3 text-sm">
                            Editar
                          </button>
                          <button className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded-md text-sm">
                            Excluir
                          </button>
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="text-gray-300 line-clamp-2">
                          {script.content.substring(0, 150)}...
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">Você ainda não tem scripts salvos.</p>
                  <Link href="/dashboard/scripts" className="btn-primary py-2 px-4">
                    Criar Seu Primeiro Script
                  </Link>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
