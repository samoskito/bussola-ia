'use client';

import { useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContext, type AuthContextType } from '@/contexts/AuthContext';
import { getCurrentUser, login as loginService, logout as logoutService } from '@/lib/auth-utils';

// Fallback for pathname in case usePathname is not available
const useSafePathname = () => {
  if (typeof window === 'undefined') return '';
  return window.location.pathname;
};

// Custom hook to sync auth state with server
export const useAuthSync = () => {
  const [loading, setLoading] = useState(true);
  const { setUser } = useAuth();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        setUser(user);
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [setUser]);

  return { loading };
};

/**
 * Custom hook to access the authentication context
 * @returns Authentication context with user, loading state, and auth methods
 */
export const useAuth = () => {
  const context = useContext(AuthContext) as AuthContextType;
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

/**
 * Hook to check if the current user is authenticated
 * @returns Object with isAuthenticated boolean and loading state
 */
export const useIsAuthenticated = () => {
  const { user, loading } = useAuth();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return { 
    isAuthenticated: isClient && !!user, 
    loading 
  };
};

/**
 * Hook to protect routes that require authentication
 * Redirects to login if not authenticated
 * @param redirectTo Path to redirect after login (default: current path)
 */
export const useRequireAuth = (redirectTo?: string) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = useSafePathname();
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (!loading && !user && isClient) {
      // If not logged in, redirect to login page
      const searchParams = new URLSearchParams();
      if (redirectTo) {
        searchParams.set('redirectedFrom', redirectTo);
      } else if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        searchParams.set('redirectedFrom', `${currentPath}${window.location.search}`);
      }
      router.push(`/auth/login?${searchParams.toString()}`);
    }
  }, [user, loading, router, redirectTo]);
  
  return { user, loading };
};

/**
 * Hook to protect routes that should only be accessible to unauthenticated users
 * Redirects to dashboard if already authenticated
 * @param redirectTo Path to redirect if already authenticated (default: '/dashboard')
 */
export const useRequireNoAuth = (redirectTo: string = '/dashboard') => {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (!loading && user) {
      // If already logged in, redirect to dashboard or specified path
      router.push(redirectTo);
    }
  }, [user, loading, router, redirectTo]);
  
  return { user, loading };
};
