'use client';

// Este arquivo contém funções que só devem ser usadas no cliente
// A diretiva 'use client' garante que este código não será executado no servidor

/**
 * Função para fazer logout do usuário no cliente
 */
export async function clientLogout(): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Erro ao fazer logout');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

/**
 * Função para verificar a sessão do usuário no cliente
 */
export async function clientCheckSession(): Promise<{ user: any | null; error?: string }> {
  try {
    const response = await fetch('/api/auth/session', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Erro ao verificar sessão');
    }
    
    const data = await response.json();
    return { user: data.user || null };
  } catch (error) {
    console.error('Session check error:', error);
    return { 
      user: null, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

/**
 * Função para fazer login do usuário no cliente
 */
export async function clientLogin(email: string, password: string): Promise<{ user: any | null; error?: string }> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro ao fazer login');
    }
    
    const data = await response.json();
    return { user: data.user || null };
  } catch (error) {
    console.error('Login error:', error);
    return { 
      user: null, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}
