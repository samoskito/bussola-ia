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
    <div className="flex h-screen w-full bg-dark-100 text-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar chats={mockChats} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header userName="Patrícia" />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-6xl mx-auto w-full">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 md:mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-white">Scripts Salvos</h1>
              <Link href="/dashboard/scripts" className="bg-[#FF6B00] hover:bg-[#E05E00] text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 5V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Criar Novo Script
              </Link>
            </div>
            
            <div className="bg-gray-800 rounded-xl p-5 md:p-6 shadow-lg border border-gray-700">
              {mockScripts.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:gap-5">
                  {mockScripts.map((script) => (
                    <div key={script.id} className="bg-gray-900 p-4 md:p-5 rounded-lg border border-gray-700 hover:border-[#FF6B00]/50 transition-all duration-200">
                      <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                        <div>
                          <h3 className="text-xl font-semibold text-[#FF6B00] mb-1">{script.title}</h3>
                          <p className="text-sm text-gray-400">
                            Criado em: {new Date(script.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button className="bg-gray-800 hover:bg-gray-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors duration-200">
                            Visualizar
                          </button>
                          <button className="bg-gray-800 hover:bg-gray-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors duration-200">
                            Editar
                          </button>
                          <button className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors duration-200">
                            Excluir
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 md:mt-4">
                        <p className="text-gray-300 line-clamp-2">
                          {script.content.substring(0, 150)}...
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-[#FF6B00]/10 flex items-center justify-center text-[#FF6B00]">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16L21 8V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M17 21V13H7V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M7 3V8H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                  <p className="text-gray-400 mb-6 text-lg">Você ainda não tem scripts salvos.</p>
                  <Link href="/dashboard/scripts" className="bg-[#FF6B00] hover:bg-[#E05E00] text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 inline-flex items-center justify-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 5V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
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
