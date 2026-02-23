/**
 * Funções de autenticação para uso no servidor
 */

import { createServerSupabaseClient } from './server';

interface AuthResponse {
  user: any | null;
  error: Error | null;
}

/**
 * Registrar um novo usuário (versão servidor)
 */
export const serverSignUp = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    const supabase = createServerSupabaseClient({ useServiceRole: false });
    
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });
    
    if (error) throw error;
    return { user: data.user, error: null };
  } catch (error) {
    console.error('Sign up error (server):', error);
    return { user: null, error: error as Error };
  }
};
