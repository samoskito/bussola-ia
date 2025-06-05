"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, supabase } from '@/lib/supabase';

interface LoginFormProps {
  className?: string;
}

export default function LoginForm({ className = '' }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  // Removido o useEffect que verificava a sessão para evitar loop de redirecionamento
  // O middleware já cuida disso

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Usar diretamente o cliente Supabase para login
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (loginError) throw loginError;
      
      console.log('Login bem-sucedido:', data);
      
      if (data.session) {
        console.log('Sessão encontrada, redirecionando...');
        
        // Armazenar token na sessão para garantir persistência
        sessionStorage.setItem('supabase.auth.token', JSON.stringify(data.session));
        
        // Usar múltiplas estratégias de redirecionamento
        try {
          // Estratégia 1: Next.js Router
          router.push('/dashboard/chat');
          
          // Estratégia 2: Redirecionamento direto após um curto delay
          setTimeout(() => {
            window.location.href = '/dashboard/chat';
          }, 500);
        } catch (navError) {
          console.error('Erro na navegação:', navError);
          // Fallback final
          window.location.href = '/dashboard/chat';
        }
      } else {
        console.log('Sem sessão após login');
        throw new Error('Falha na autenticação');
      }
    } catch (error: any) {
      console.log('Erro capturado:', error);
      console.error('Erro ao fazer login:', error);
      
      // Mostrar mensagem de erro amigável
      if (error?.message?.includes('Invalid login credentials')) {
        setError('Email ou senha incorretos. Por favor, tente novamente.');
      } else if (error?.message?.includes('Email not confirmed')) {
        setError('Por favor, confirme seu email antes de fazer login.');
      } else {
        setError('Ocorreu um erro ao fazer login. Por favor, tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`w-full ${className}`}>
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

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

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
    </div>
  );
}
