"use client";

import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

const mockChats = Array(10).fill(0).map((_, i) => ({
  id: `chat-${i + 1}`,
  title: 'Lorem ipsum dolor...',
}));

interface ProfileFormData {
  name: string;
  email: string;
  phone: string;
  avatar_url: string;
  street: string;
  number: string;
  district: string;
  zip_code: string;
  city: string;
  state: string;
  country: string;
  position: string; // cargo
  company: string; // empresa
  age: string; // idade
}

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    email: '',
    phone: '',
    avatar_url: '',
    street: '',
    number: '',
    district: '',
    zip_code: '',
    city: '',
    state: '',
    country: '',
    position: '',
    company: '',
    age: ''
  });
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const getUser = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser(session.user);
          
          // Buscar dados do usuário na tabela users
          const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (error) {
            console.error('Erro ao buscar dados do usuário:', error);
            throw error;
          }
          
          if (userData) {
            // Preencher o formulário com os dados do usuário
            setFormData({
              name: userData.name || '',
              email: userData.email || session.user.email || '',
              phone: userData.phone || '',
              avatar_url: userData.avatar_url || '',
              street: userData.street || '',
              number: userData.number || '',
              district: userData.district || '',
              zip_code: userData.zip_code || '',
              city: userData.city || '',
              state: userData.state || '',
              country: userData.country || '',
              position: userData.position || '',
              company: userData.company || '',
              age: userData.age || ''
            });
            
            // Se houver avatar, definir a preview
            if (userData.avatar_url) {
              setAvatarPreview(userData.avatar_url);
            }
          } else {
            // Se não houver dados do usuário, preencher apenas o email
            setFormData(prev => ({
              ...prev,
              email: session.user.email || ''
            }));
          }
        }
      } catch (error) {
        console.error('Erro ao buscar dados do usuário:', error);
      } finally {
        setLoading(false);
      }
    };
    
    getUser();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      
      // Criar preview da imagem
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAvatarPreview(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSaving(true);
      
      // Upload do avatar se houver um novo arquivo
      let avatarUrl = formData.avatar_url;
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `avatars/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('user-avatars')
          .upload(filePath, avatarFile);
          
        if (uploadError) {
          throw uploadError;
        }
        
        // Obter a URL pública do avatar
        const { data } = supabase.storage.from('user-avatars').getPublicUrl(filePath);
        avatarUrl = data.publicUrl;
      }
      
      // Atualizar os dados do usuário na tabela users
      const { error } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          avatar_url: avatarUrl,
          street: formData.street,
          number: formData.number,
          district: formData.district,
          zip_code: formData.zip_code,
          city: formData.city,
          state: formData.state,
          country: formData.country,
          position: formData.position,
          company: formData.company,
          age: formData.age,
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
      setIsEditing(false);
      alert('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      alert('Ocorreu um erro ao atualizar o perfil. Por favor, tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    
    // Validar se as senhas coincidem
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('As senhas não coincidem');
      return;
    }
    
    try {
      setIsSaving(true);
      
      // Atualizar a senha do usuário
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });
      
      if (error) throw error;
      
      // Limpar o formulário de senha
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      setIsChangingPassword(false);
      alert('Senha atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar senha:', error);
      setPasswordError('Erro ao atualizar senha. Verifique sua senha atual.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-dark-100 text-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar initialChats={mockChats} />
      
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
                
                <form id="profile-form" onSubmit={handleSubmit} className="space-y-8">
                  {/* Avatar/Foto do Usuário */}
                  <div className="md:col-span-2 flex flex-col items-center sm:items-start">
                    <label className="block text-sm font-medium text-gray-300 mb-3">Foto do Perfil</label>
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-primary-500 bg-gray-900">
                        {avatarPreview || formData.avatar_url ? (
                          <Image 
                            src={avatarPreview || formData.avatar_url}
                            alt="Foto de perfil"
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-400">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        )}
                      </div>
                      
                      {isEditing && (
                        <div className="flex flex-col gap-2">
                          <input
                            type="file"
                            id="avatar"
                            name="avatar"
                            accept="image/*"
                            onChange={handleAvatarChange}
                            className="hidden"
                            ref={fileInputRef}
                            disabled={isSaving}
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center gap-2"
                            disabled={isSaving}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M17 8L12 3L7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M12 3V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Alterar foto
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
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
                    
                    {/* Idade */}
                    <div>
                      <label htmlFor="age" className="block text-sm font-medium text-gray-300 mb-2">Idade</label>
                      <input
                        type="number"
                        id="age"
                        name="age"
                        value={formData.age}
                        onChange={handleChange}
                        disabled={!isEditing || isSaving}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-[#FF6B00] disabled:opacity-60 transition-all duration-200"
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
                    
                    {/* Endereço - Título */}
                    <div className="md:col-span-2 mt-4">
                      <h3 className="text-lg font-semibold text-[#FF6B00] mb-3">Endereço</h3>
                    </div>
                    
                    {/* Rua */}
                    <div className="md:col-span-2">
                      <label htmlFor="street" className="block text-sm font-medium text-gray-300 mb-2">Rua</label>
                      <input
                        type="text"
                        id="street"
                        name="street"
                        value={formData.street}
                        onChange={handleChange}
                        disabled={!isEditing || isSaving}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-[#FF6B00] disabled:opacity-60 transition-all duration-200"
                      />
                    </div>
                    
                    {/* Número */}
                    <div>
                      <label htmlFor="number" className="block text-sm font-medium text-gray-300 mb-2">Número</label>
                      <input
                        type="text"
                        id="number"
                        name="number"
                        value={formData.number}
                        onChange={handleChange}
                        disabled={!isEditing || isSaving}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-[#FF6B00] disabled:opacity-60 transition-all duration-200"
                      />
                    </div>
                    
                    {/* Bairro */}
                    <div>
                      <label htmlFor="district" className="block text-sm font-medium text-gray-300 mb-2">Bairro</label>
                      <input
                        type="text"
                        id="district"
                        name="district"
                        value={formData.district}
                        onChange={handleChange}
                        disabled={!isEditing || isSaving}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-[#FF6B00] disabled:opacity-60 transition-all duration-200"
                      />
                    </div>
                    
                    {/* CEP */}
                    <div>
                      <label htmlFor="zip_code" className="block text-sm font-medium text-gray-300 mb-2">CEP</label>
                      <input
                        type="text"
                        id="zip_code"
                        name="zip_code"
                        value={formData.zip_code}
                        onChange={handleChange}
                        disabled={!isEditing || isSaving}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-[#FF6B00] disabled:opacity-60 transition-all duration-200"
                        placeholder="00000-000"
                      />
                    </div>
                    
                    {/* Cidade */}
                    <div>
                      <label htmlFor="city" className="block text-sm font-medium text-gray-300 mb-2">Cidade</label>
                      <input
                        type="text"
                        id="city"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        disabled={!isEditing || isSaving}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-[#FF6B00] disabled:opacity-60 transition-all duration-200"
                      />
                    </div>
                    
                    {/* Estado */}
                    <div>
                      <label htmlFor="state" className="block text-sm font-medium text-gray-300 mb-2">Estado</label>
                      <input
                        type="text"
                        id="state"
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        disabled={!isEditing || isSaving}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-[#FF6B00] disabled:opacity-60 transition-all duration-200"
                      />
                    </div>
                    
                    {/* País */}
                    <div>
                      <label htmlFor="country" className="block text-sm font-medium text-gray-300 mb-2">País</label>
                      <input
                        type="text"
                        id="country"
                        name="country"
                        value={formData.country}
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
