'use client';

import React from 'react';
import { toast } from 'react-hot-toast';

export default function ResetPasswordForm() {
  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        throw new Error('Falha ao solicitar redefinição de senha');
      }
      
      setMessage({
        type: 'success',
        text: 'Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.'
      });
      setEmail('');
      toast.success('Email de redefinição enviado com sucesso!');
    } catch (error) {
      console.error('Erro ao processar solicitação:', error);
      setMessage({
        type: 'error',
        text: 'Ocorreu um erro ao tentar enviar o e-mail de redefinição. Tente novamente mais tarde.'
      });
      toast.error('Falha ao enviar email de redefinição');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-white mb-6">Redefinir senha</h2>
      <p className="text-gray-300 mb-6">
        Digite o e-mail associado à sua conta e enviaremos um link para redefinir sua senha.
      </p>
      
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
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
            Seu e-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="seu@email.com"
            disabled={loading}
          />
        </div>
        
        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Enviando...' : 'Enviar link de redefinição'}
          </button>
        </div>
      </form>
    </div>
  );
}
