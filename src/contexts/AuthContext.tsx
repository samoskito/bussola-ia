'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import type { Session, User } from '@supabase/auth-js';

// Log environment for debugging
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

// Define user type that matches your users table
type AppUser = (User & {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
    [key: string]: any;
  };
  app_metadata?: Record<string, any>;
  aud?: string;
  created_at?: string;
  // Add any additional fields from your users table
  [key: string]: any;
}) | null;

type AppSession = Session | null;

export type AuthContextType = {
  user: AppUser;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  error: string | null;
  getSession: () => Promise<AppSession>;
};

// Export the context with the correct type
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const getSession = useCallback(async (): Promise<AppSession> => {
    if (typeof window === 'undefined') return null;
    
    try {
      setLoading(true);
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
        throw error;
      }
      
      if (!session) {
        setUser(null);
        return null;
      }
      
      // Fetch additional user data from your users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (userError) {
        console.error('Error fetching user data:', userError);
        // Don't throw, continue with basic session
      }
      
      // Merge auth user with your users table data
      const userWithData: AppUser = {
        ...session.user,
        id: session.user.id,
        email: session.user.email || undefined,
        created_at: session.user.created_at,
        app_metadata: session.user.app_metadata || {},
        aud: session.user.aud,
        user_metadata: {
          ...(session.user.user_metadata || {}),
          ...(userData || {})
        },
        ...(userData || {})
      };
      
      // Update user state
      setUser(userWithData);
      
      return session;
    } catch (error) {
      console.error('Error in getSession:', error);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getSession();
  }, [router, getSession]);

  useEffect(() => {
    const checkSession = async () => {
      try {
        setLoading(true);
        
        // Verificar se há um usuário no localStorage
        if (typeof window !== 'undefined') {
          const userJson = localStorage.getItem('user');
          if (userJson) {
            const userData = JSON.parse(userJson);
            setUser(userData);
            
            // Se estiver na página de login, redirecionar para o dashboard
            if (window.location.pathname === '/auth/login') {
              router.push('/dashboard');
            }
            return;
          }
        }
        
        // Se não houver usuário e estiver em uma rota protegida, redirecionar para o login
        if (window.location.pathname.startsWith('/dashboard')) {
          router.push('/auth/login');
        }
        
        setUser(null);
      } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        setUser(null);
        
        // Em caso de erro, redirecionar para o login
        if (window.location.pathname.startsWith('/dashboard')) {
          router.push('/auth/login');
        }
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, supabaseSession) => {
      try {
        if (!supabaseSession) {
          setUser(null);
          
          // If signed out and not on login page, redirect to login
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth/login')) {
            window.location.href = '/auth/login';
          }
          return;
        }
        
        // Fetch additional user data from your users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', supabaseSession.user.id)
          .single();
        
        if (userError) {
          console.error('Error fetching user data:', userError);
          // Continue with basic session data
        }
        
        // Create a properly typed user object
        const userWithData: AppUser = {
          ...supabaseSession.user,
          id: supabaseSession.user.id,
          email: supabaseSession.user.email || undefined,
          created_at: supabaseSession.user.created_at,
          app_metadata: supabaseSession.user.app_metadata || {},
          aud: supabaseSession.user.aud,
          user_metadata: {
            ...(supabaseSession.user.user_metadata || {}),
            ...(userData || {})
          },
          ...(userData || {})
        };
        
        setUser(userWithData);
      
        if (typeof window === 'undefined') return;
        
        // Get redirect path from URL if available
        const searchParams = new URLSearchParams(window.location.search);
        const redirectTo = searchParams.get('redirectedFrom') || '/dashboard';
        
        switch (event) {
          case 'SIGNED_IN':
            // Small delay to ensure the session is properly set
            setTimeout(() => router.push(redirectTo), 100);
            break;
            
          case 'SIGNED_OUT':
            setUser(null);
            // Force a full page reload to clear any state
            if (window.location.pathname !== '/auth/login') {
              window.location.href = '/auth/login';
            }
            break;
            
          case 'INITIAL_SESSION':
            if (supabaseSession?.user && window.location.pathname === '/auth/login') {
              setTimeout(() => router.push(redirectTo), 100);
            }
            break;
            
          case 'TOKEN_REFRESHED':
            // Handle token refresh if needed
            break;
            
          default:
            break;
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
        setUser(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [router, getSession]);

  const signIn = async (email: string, password: string) => {
    if (typeof window === 'undefined') {
      return { error: 'Cannot sign in on server side' };
    }
    if (loading) return { error: 'Autenticação em andamento' };
    
    try {
      setLoading(true);
      setError(null);
      
      // Buscar usuário pelo email na tabela users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .single();
      
      if (userError || !userData) {
        throw new Error('E-mail ou senha inválidos');
      }
      
      // Verificar a senha (assumindo que a senha está em um campo 'senha' e está criptografada com bcrypt)
      // Nota: Em produção, use bcrypt para comparar hashes de senha
      if (userData.senha !== password) {
        throw new Error('E-mail ou senha inválidos');
      }
      
      // Criar um objeto de usuário compatível com o tipo AppUser
      const userWithData: AppUser = {
        id: userData.id,
        email: userData.email,
        user_metadata: {
          full_name: userData.nome,
          avatar_url: userData.avatar
        },
        created_at: userData.created_at || new Date().toISOString(),
        app_metadata: {},
        aud: 'authenticated',
        // Incluir todos os outros campos da tabela users
        ...userData
      };
      
      // Atualizar o estado do usuário
      setUser(userWithData);
      
      // Armazenar o ID do usuário no localStorage para persistência
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(userWithData));
      }
      
      // Disparar evento de login bem-sucedido
      window.dispatchEvent(new Event('userLoggedIn'));
      
      // Retornar sucesso
      return { error: null };
      
    } catch (error: any) {
      console.error('Erro ao fazer login:', error);
      
      // Limpar estado do usuário em caso de erro
      setUser(null);
      
      // Mapear mensagens de erro amigáveis
      let errorMessage = 'Ocorreu um erro ao fazer login. Por favor, tente novamente.';
      
      if (error.message) {
        if (error.message.includes('E-mail ou senha inválidos')) {
          errorMessage = 'E-mail ou senha inválidos. Por favor, verifique suas credenciais.';
        }
      }
      
      return { error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      
      // Limpar o usuário do estado
      setUser(null);
      
      // Remover o usuário do localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user');
      }
      
      // Disparar evento de logout
      window.dispatchEvent(new Event('userLoggedOut'));
      
      // Redirecionar para a página de login
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      } else {
        // Fallback for server-side rendering
        router.push('/auth/login');
      }
      
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      
      // Force sign out even if there was an error
      setUser(null);
      
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
      
    } finally {
      setLoading(false);
    }
  };

  const contextValue = {
    user,
    loading,
    signIn,
    signOut,
    error,
    getSession,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
