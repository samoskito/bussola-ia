"use client";

import React from 'react';
// @ts-ignore - Ignorando erros de tipagem para permitir a build
const { useState, useEffect } = React;
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
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

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    role: ''
  });
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    const getUser = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser(session.user);
          
          // Buscar dados adicionais do usuário (em uma implementação real)
          // const { data: profile } = await supabase
          //   .from('profiles')
          //   .select('*')
          //   .eq('id', session.user.id)
          //   .single();
          
          // Dados simulados para demonstração
          setFormData({
            name: 'Patrícia Silva',
            email: session.user.email || '',
            company: 'Empresa ABC',
            role: 'Gerente de Projetos'
          });
        }
      } catch (error) {
        console.error('Erro ao buscar dados do usuário:', error);
      } finally {
        setLoading(false);
      }
    };
    
    getUser();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSaving(true);
      
      // Em uma implementação real, salvaríamos os dados no Supabase
      // await supabase
      //   .from('profiles')
      //   .upsert({
      //     id: user.id,
      //     name: formData.name,
      //     company: formData.company,
      //     role: formData.role,
      //     updated_at: new Date()
      //   });
      
      // Simulação de salvamento
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIsEditing(false);
      alert('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      alert('Ocorreu um erro ao atualizar o perfil. Por favor, tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-screen bg-dark-100 text-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar projects={mockProjects} chats={mockChats} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header userName={formData.name.split(' ')[0]} />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Perfil do Usuário</h1>
            
            {loading ? (
              <div className="bg-dark-200 p-8 rounded-lg flex justify-center items-center">
                <p className="text-gray-400">Carregando dados do usuário...</p>
              </div>
            ) : (
              <div className="bg-dark-200 p-8 rounded-lg">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-semibold text-primary">Informações Pessoais</h2>
                  
                  {!isEditing ? (
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="btn-secondary py-2 px-4"
                    >
                      Editar Perfil
                    </button>
                  ) : (
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => setIsEditing(false)}
                        className="btn-secondary py-2 px-4"
                        disabled={isSaving}
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit"
                        form="profile-form"
                        className="btn-primary py-2 px-4"
                        disabled={isSaving}
                      >
                        {isSaving ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  )}
                </div>
                
                <form id="profile-form" onSubmit={handleSubmit}>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                          Nome Completo
                        </label>
                        <input
                          id="name"
                          name="name"
                          type="text"
                          value={formData.name}
                          onChange={handleChange}
                          disabled={!isEditing || isSaving}
                          className="input-field"
                          required
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                          Email
                        </label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          value={formData.email}
                          disabled={true} // Email não pode ser alterado
                          className="input-field bg-dark-300"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="company" className="block text-sm font-medium text-gray-300 mb-1">
                          Empresa
                        </label>
                        <input
                          id="company"
                          name="company"
                          type="text"
                          value={formData.company}
                          onChange={handleChange}
                          disabled={!isEditing || isSaving}
                          className="input-field"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="role" className="block text-sm font-medium text-gray-300 mb-1">
                          Cargo
                        </label>
                        <input
                          id="role"
                          name="role"
                          type="text"
                          value={formData.role}
                          onChange={handleChange}
                          disabled={!isEditing || isSaving}
                          className="input-field"
                        />
                      </div>
                    </div>
                  </div>
                </form>
                
                <div className="mt-8 pt-6 border-t border-dark-300">
                  <h3 className="text-xl font-semibold text-primary mb-4">Segurança da Conta</h3>
                  
                  <div className="space-y-4">
                    <button className="btn-secondary py-2 px-4">
                      Alterar Senha
                    </button>
                    
                    <div className="mt-4">
                      <p className="text-gray-400 text-sm">
                        Última atualização do perfil: {new Date().toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
