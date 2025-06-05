"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { login } from './actions';
import { supabase, getImageUrl, STORAGE_BUCKETS } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [presenterImageUrl, setPresenterImageUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  
  useEffect(() => {
    // Carregar a URL da imagem da apresentadora do Supabase
    const presenterUrl = getImageUrl(STORAGE_BUCKETS.IMAGES, 'auth/presenter.jpg');
    setPresenterImageUrl(presenterUrl);
    
    // Carregar a URL do logo do Supabase
    const logoImageUrl = getImageUrl(STORAGE_BUCKETS.ASSETS, 'logo.svg');
    setLogoUrl(logoImageUrl);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    
    try {
      await login(formData);
    } catch (error) {
      console.error('Erro ao fazer login:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row">
      {/* Mobile layout (vertical) */}
      <div className="flex flex-col w-full h-screen md:hidden" 
        style={{
          background: 'linear-gradient(to bottom, #1A1A1A, #2A2A2A)',
          position: 'relative',
        }}>
        <div className="flex-1 flex flex-col items-center justify-center p-8 z-10">
          <div className="w-full max-w-sm">
            <div className="mb-12 flex justify-center">
              <Image 
                src={logoUrl || "/images/logo.svg"} 
                alt="BÚSSOLA EXECUTIVA" 
                width={200} 
                height={50} 
                priority
              />
            </div>
            
            <form className="w-full space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Seu email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-[#111111] border border-[#333333] rounded-md py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Sua senha
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-[#111111] border border-[#333333] rounded-md py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#FF6B00] text-white font-medium py-3 px-4 rounded-md hover:bg-[#FF8534] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:ring-opacity-50"
                >
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </div>
            </form>
            
            <div className="mt-4 text-center">
              <Link href="/auth/reset-password" className="text-sm text-[#FF6B00] hover:underline">
                Esqueceu sua senha?
              </Link>
            </div>
          </div>
        </div>
        
        {/* Imagem de fundo para mobile */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 z-0">
          {presenterImageUrl && (
            <Image 
              src={presenterImageUrl}
              alt="Apresentadora" 
              fill
              style={{ objectFit: 'cover', objectPosition: 'center 20%', opacity: 0.7 }}
              priority
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] to-transparent"></div>
        </div>
      </div>

      {/* Desktop layout (horizontal) */}
      <div className="hidden md:flex w-full h-screen">
        {/* Lado esquerdo - Imagem */}
        <div className="w-1/2 relative">
          {presenterImageUrl ? (
            <Image 
              src={presenterImageUrl}
              alt="Apresentadora" 
              fill
              style={{ objectFit: 'cover' }}
              priority
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#333333] to-[#1A1A1A] flex items-center justify-center">
              <div className="text-[#FF6B00] text-opacity-30 text-xl">Carregando imagem...</div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#1A1A1A] opacity-30"></div>
        </div>
        
        {/* Lado direito - Formulário */}
        <div className="w-1/2 flex items-center justify-center p-8" 
          style={{ background: 'linear-gradient(to bottom, #1A1A1A, #2A2A2A)' }}>
          <div className="w-full max-w-md">
            <div className="mb-12 flex justify-center">
              <Image 
                src={logoUrl || "/images/logo.svg"} 
                alt="BÚSSOLA EXECUTIVA" 
                width={220} 
                height={55} 
                priority
              />
            </div>
            
            <form className="w-full space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="desktop-email" className="block text-sm font-medium text-gray-300 mb-2">
                  Seu email
                </label>
                <input
                  id="desktop-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-[#111111] border border-[#333333] rounded-md py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="desktop-password" className="block text-sm font-medium text-gray-300 mb-2">
                  Sua senha
                </label>
                <input
                  id="desktop-password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-[#111111] border border-[#333333] rounded-md py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#FF6B00] text-white font-medium py-3 px-4 rounded-md hover:bg-[#FF8534] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:ring-opacity-50"
                >
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </div>
            </form>
            
            <div className="mt-4 text-center">
              <Link href="/auth/reset-password" className="text-sm text-[#FF6B00] hover:underline">
                Esqueceu sua senha?
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
