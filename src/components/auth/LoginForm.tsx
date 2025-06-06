'use client';

import React, { useState, useId, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface LoginFormProps {
  className?: string;
  redirectTo?: string;
}

export default function LoginForm({ className = '', redirectTo = '/dashboard' }: LoginFormProps) {
  // State management
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  
  // Hooks
  const { signIn, user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  // Get redirect path from URL if available
  const getRedirectPath = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('redirectedFrom') || redirectTo;
    }
    return redirectTo;
  };
  
  const [redirectPath, setRedirectPath] = useState(redirectTo);
  
  // Refs for focus management
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  
  // Generate unique IDs for form elements
  const idPrefix = useId();
  const emailInputId = `${idPrefix}-email`;
  const passwordInputId = `${idPrefix}-password`;
  const errorMessageId = `${idPrefix}-error`;
  
  // Update redirect path when component mounts
  useEffect(() => {
    setRedirectPath(getRedirectPath());
  }, []);
  
  // Redirect if user is already authenticated
  useEffect(() => {
    if (user && !authLoading) {
      router.push(redirectPath);
    }
  }, [user, authLoading, router, redirectPath]);
  
  // Focus email input on mount
  useEffect(() => {
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, []);
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Reset error state
    setError(null);
    
    // Validate form
    if (!email.trim()) {
      setError('Por favor, insira seu e-mail');
      emailInputRef.current?.focus();
      return;
    }
    
    if (!password) {
      setError('Por favor, insira sua senha');
      passwordInputRef.current?.focus();
      return;
    }
    
    // Set loading state
    setIsSubmitting(true);
    
    try {
      const result = await signIn(email.trim().toLowerCase(), password);
      
      // Se signIn retornar um objeto com propriedade error
      if (result !== null && result !== undefined && typeof result === 'object' && 'error' in result && result.error) {
        // Focus on password field on error
        passwordInputRef.current?.focus();
        throw new Error(result.error);
      }
      
      // Success state will be handled by the auth state change in AuthContext
      setLoginSuccess(true);
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'Ocorreu um erro ao fazer login. Por favor, tente novamente.');
      
      // Focus on password field on error
      setTimeout(() => {
        if (passwordInputRef.current) {
          passwordInputRef.current.focus();
        }
      }, 100);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="w-full flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {loginSuccess ? (
        <div className="w-full space-y-6">
          <div 
            role="status"
            aria-live="polite"
            className="p-4 mb-4 text-sm text-green-700 bg-green-100 rounded-lg dark:bg-green-200 dark:text-green-800"
          >
            <p className="block sm:inline">Login bem-sucedido! Redirecionando para o dashboard...</p>
          </div>
          <div>
            <button
              onClick={() => router.push(redirectPath)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
            >
              Ir para o Dashboard
            </button>
          </div>
        </div>
      ) : (
        <form 
          className="w-full space-y-6" 
          onSubmit={handleSubmit}
          noValidate
          aria-label="Formulário de login"
        >
          <div>
            <label 
              htmlFor={emailInputId} 
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Seu email
            </label>
            <input
              id={emailInputId}
              ref={emailInputRef}
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="seu@email.com"
              aria-required="true"
              aria-invalid={error ? 'true' : 'false'}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label 
                htmlFor={passwordInputId} 
                className="block text-sm font-medium text-gray-300"
              >
                Sua senha
              </label>
              <a 
                href="/auth/reset-password" 
                className="text-sm text-orange-400 hover:text-orange-300 hover:underline focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded"
              >
                Esqueceu a senha?
              </a>
            </div>
            <input
              id={passwordInputId}
              ref={passwordInputRef}
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="••••••••"
              aria-required="true"
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? errorMessageId : undefined}
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <div 
              id={errorMessageId}
              role="alert"
              aria-live="assertive"
              className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-200 dark:text-red-800"
            >
              <p className="block sm:inline">{error}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center items-center bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-busy={isSubmitting}
              aria-live="polite"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Entrando...
                </>
              ) : 'Entrar'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
