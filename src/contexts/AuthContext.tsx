'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { clientCheckSession, clientLogin, clientLogout } from '@/lib/supabase/client-utils';

// Define user type
type AppUser = {
  id: string;
  email: string;
  nome?: string | null;
  telefone?: string | null;
  avatar?: string | null;
  nivel?: 'admin' | 'user' | null;
  created_at: string;
  updated_at?: string | null;
  data_expiracao?: string | null;
  plano?: 'Comunicação Executiva' | 'Apresentação para Reunião de Resultados' | 'Ambas' | null;
} | null;

type AuthError = {
  error: string;
} | null;

export type AuthContextType = {
  user: AppUser;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthError>;
  signOut: () => Promise<void>;
  error: string | null;
  setUser: (user: AppUser) => void;
};

// Create the context with a default value
export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  signIn: async () => ({ error: 'Context not initialized' }),
  signOut: async () => {},
  setUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Verificar sessão ao carregar
  useEffect(() => {
    const checkSession = async () => {
      try {
        setLoading(true);
        const { user, error } = await clientCheckSession();
        
        if (user) {
          setUser(user);
        } else {
          setUser(null);
          if (error) {
            console.error('Erro ao verificar sessão:', error);
          }
        }
      } catch (err) {
        console.error('Erro ao verificar sessão:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  // Função de login
  const signIn = async (email: string, password: string): Promise<AuthError> => {
    try {
      setLoading(true);
      setError(null);
      
      const { user, error } = await clientLogin(email.trim().toLowerCase(), password);
      
      if (error) {
        setError(error);
        return { error };
      }
      
      if (!user) {
        const errorMsg = 'Falha ao fazer login';
        setError(errorMsg);
        return { error: errorMsg };
      }
      
      setUser(user);
      router.push('/dashboard');
      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Falha ao fazer login';
      setError(errorMessage);
      return { error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Função de logout
  const signOut = async () => {
    try {
      setLoading(true);
      const { success, error } = await clientLogout();
      
      if (!success) {
        console.error('Erro ao fazer logout:', error);
        setError('Falha ao fazer logout');
        return;
      }
      
      setUser(null);
      router.push('/auth/login');
    } catch (err) {
      console.error('Erro ao fazer logout:', err);
      setError('Falha ao fazer logout');
    } finally {
      setLoading(false);
    }
  };

  // Context value
  const contextValue = {
    user,
    loading,
    error,
    signIn,
    signOut,
    setUser,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
