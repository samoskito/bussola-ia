'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function UpdatePasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordError, setPasswordError] = useState('');
  const router = useRouter();

  // Verificar se o link contém token e email
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token') || '';
    const emailParam = params.get('email') || '';

    setToken(tokenParam);
    setEmail(emailParam);

    if (!tokenParam || !emailParam) {
        setMessage({
          type: 'error',
        text: 'Link inválido ou expirado. Solicite uma nova redefinição de senha.'
        });
    }
  }, []);

  // Validar senha
  const validatePassword = (password: string): boolean => {
    if (password.length < 8) {
      setPasswordError('A senha deve ter pelo menos 8 caracteres');
      return false;
    }
    
    setPasswordError('');
    return true;
  };

  // Verificar se as senhas coincidem
  const passwordsMatch = (): boolean => {
    if (password !== confirmPassword) {
      setPasswordError('As senhas não coincidem');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar senha
    if (!validatePassword(password) || !passwordsMatch()) {
      return;
    }
    
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          token,
          password
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Falha ao atualizar senha');
      }
      
      setMessage({
        type: 'success',
        text: 'Senha atualizada com sucesso!'
      });
      
      toast.success('Senha atualizada com sucesso!');
      
      // Limpar campos
      setPassword('');
      setConfirmPassword('');
      
      // Redirecionar para a página de login após 2 segundos
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
      
    } catch (error) {
      console.error('Erro ao processar solicitação:', error);
      setMessage({
        type: 'error',
        text: 'Ocorreu um erro ao tentar atualizar sua senha. Tente novamente mais tarde.'
      });
      toast.error('Falha ao atualizar senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-white mb-6">Atualizar senha</h2>
      <p className="text-gray-300 mb-6">
        Digite sua nova senha para atualizar sua conta.
      </p>

      {!token || !email ? null : (
        <p className="text-sm text-gray-400 mb-4">Conta: {email}</p>
      )}
      
      {message && (
        <div 
          className={`p-4 mb-6 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-100 text-green-800 dark:bg-green-200 dark:text-green-900' 
              : 'bg-red-100 text-red-800 dark:bg-red-200 dark:text-red-900'
          }`}
        >
          {message.text}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
            Nova senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="********"
            disabled={loading}
          />
        </div>
        
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
            Confirmar nova senha
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="********"
            disabled={loading}
          />
        </div>
        
        {passwordError && (
          <div className="text-red-500 text-sm">{passwordError}</div>
        )}
        
        <div>
          <button
            type="submit"
            disabled={loading || !token || !email}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Atualizando...' : 'Atualizar senha'}
          </button>
        </div>
      </form>
    </div>
  );
}
