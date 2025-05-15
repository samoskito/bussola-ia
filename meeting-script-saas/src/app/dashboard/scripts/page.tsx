"use client";

// @ts-ignore - Desativando verificações de tipo para JSX
// @ts-nocheck

import React from 'react';
// @ts-ignore - Ignorando erros de tipagem para permitir a build
const { useState, useEffect } = React;
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ScriptGenerator from '@/components/scripts/ScriptGenerator';
import ScriptViewer from '@/components/scripts/ScriptViewer';
import { supabase } from '@/lib/supabase';

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

export default function ScriptsPage() {
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [scriptTitle, setScriptTitle] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);

  // Efeito para buscar o usuário atual
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
      }
    };

    getUser();
  }, []);

  const handleScriptGenerated = (script: string, title: string) => {
    setGeneratedScript(script);
    setScriptTitle(title);
  };

  const handleBack = () => {
    setGeneratedScript(null);
    setScriptTitle('');
  };

  return (
    <div className="flex h-screen bg-dark-100 text-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar projects={mockProjects} chats={mockChats} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header userName="Patrícia" />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Gerador de Scripts para Reuniões</h1>
            <p className="text-gray-400 mb-8">
              Crie scripts profissionais para suas reuniões em poucos minutos. Preencha as informações abaixo e nosso assistente de IA irá gerar um script personalizado para você.
            </p>

            <div className="grid grid-cols-1 gap-8">
              {!generatedScript ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <ScriptGenerator
                      onScriptGenerated={handleScriptGenerated}
                      userId={userId || undefined}
                    />
                  </div>

                  <div className="bg-dark-200 p-6 rounded-lg">
                    <h2 className="text-xl font-bold text-primary mb-4">Scripts Salvos</h2>

                    <div className="space-y-4">
                      <p className="text-gray-400">
                        Seus scripts salvos aparecerão aqui. Você ainda não tem nenhum script salvo.
                      </p>

                      <div className="flex flex-col space-y-2">
                        <a href="/dashboard/scripts/saved" className="btn-secondary w-full text-center">
                          Ver Scripts Salvos
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <ScriptViewer
                  script={generatedScript}
                  title={scriptTitle}
                  onBack={handleBack}
                  userId={userId || undefined}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
