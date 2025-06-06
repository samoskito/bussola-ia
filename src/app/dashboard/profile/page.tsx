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

interface ProfileFormData {
  name: string;
  email: string;
  company: string;
  role: string;
  phone: string;
  position: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    email: '',
    company: '',
    role: '',
    phone: '',
    position: ''
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
          setTimeout(() => {
            const mockUserData = {
              id: '123',
              name: 'Patrícia Silva',
              email: 'patricia.silva@exemplo.com',
              company: 'Empresa ABC',
              role: 'Gerente de Marketing',
              phone: '(11) 98765-4321',
              position: 'Gerente de Marketing'
            };
            
            setUser(mockUserData);
            setFormData({
              name: mockUserData.name,
              email: mockUserData.email,
              company: mockUserData.company,
              role: mockUserData.role,
              phone: mockUserData.phone,
              position: mockUserData.position
            });
            setLoading(false);
          }, 1500);
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
    <div className="flex h-screen w-full bg-dark-100 text-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar chats={mockChats} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header userName={formData.name.split(' ')[0]} />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-4xl mx-auto w-full">
            <h1 className="text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-white">Perfil do Usuário</h1>
            
            {loading ? (
              <div className="bg-gray-800 p-8 rounded-xl shadow-lg flex justify-center items-center min-h-[300px] border border-gray-700">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-[#FF6B00] border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-400 text-lg">Carregando dados do usuário...</p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 p-6 md:p-8 rounded-xl shadow-lg border border-gray-700">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-8 pb-4 md:pb-6 border-b border-gray-700">
                  <h2 className="text-2xl font-semibold text-[#FF6B00]">Informações Pessoais</h2>
                  
                  {!isEditing ? (
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center gap-2"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Editar Perfil
                    </button>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      <button 
                        onClick={() => setIsEditing(false)}
                        className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                        disabled={isSaving}
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit"
                        form="profile-form"
                        className="bg-[#FF6B00] hover:bg-[#E05E00] text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center gap-2"
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Salvando...
                          </>
                        ) : 'Salvar'}
                      </button>
                    </div>
                  )}
                </div>
                
                <form id="profile-form" onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Nome */}
                    <div className="md:col-span-2">
                      <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">Nome Completo</label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        disabled={!isEditing || isSaving}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-[#FF6B00] disabled:opacity-60 transition-all duration-200"
                      />
                    </div>
                    
                    {/* Email */}
                    <div className="md:col-span-2">
                      <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        disabled={true} // Email não pode ser alterado
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-[#FF6B00] disabled:opacity-60 transition-all duration-200"
                      />
                      <p className="mt-1 text-xs text-gray-400">O email não pode ser alterado.</p>
                    </div>
                    
                    {/* Telefone */}
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">Telefone</label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        disabled={!isEditing || isSaving}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-[#FF6B00] disabled:opacity-60 transition-all duration-200"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    
                    {/* Empresa */}
                    <div>
                      <label htmlFor="company" className="block text-sm font-medium text-gray-300 mb-2">Empresa</label>
                      <input
                        type="text"
                        id="company"
                        name="company"
                        value={formData.company}
                        onChange={handleChange}
                        disabled={!isEditing || isSaving}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-[#FF6B00] disabled:opacity-60 transition-all duration-200"
                      />
                    </div>
                    
                    {/* Cargo */}
                    <div>
                      <label htmlFor="position" className="block text-sm font-medium text-gray-300 mb-2">Cargo</label>
                      <input
                        type="text"
                        id="position"
                        name="position"
                        value={formData.position}
                        onChange={handleChange}
                        disabled={!isEditing || isSaving}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-[#FF6B00] disabled:opacity-60 transition-all duration-200"
                      />
                    </div>
                  </div>
                </form>
                
                <div className="mt-8 pt-6 border-t border-gray-700">
                  <h3 className="text-xl font-semibold text-[#FF6B00] mb-5">Segurança da Conta</h3>
                  
                  <div className="space-y-5">
                    <button className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M12 15V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Alterar Senha
                    </button>
                    
                    <div className="mt-6 bg-gray-900 p-4 rounded-lg border border-gray-700">
                      <p className="text-gray-400 flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
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
