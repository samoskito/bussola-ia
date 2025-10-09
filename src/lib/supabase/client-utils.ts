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
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[CLIENT] Iniciando processo de login para:', email);
    }
    
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password }),
      // Importante para garantir que os cookies sejam enviados e recebidos
      credentials: 'include'
    });
    
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[CLIENT] Resposta do servidor:', response.status, response.statusText);
    }
    
    if (!response.ok) {
      let errorMessage = 'Erro ao fazer login';
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (parseError) {
        console.error('[CLIENT] Erro ao analisar resposta de erro:', parseError);
      }
      
      console.error('[CLIENT] Erro de login:', errorMessage);
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[CLIENT] Login bem-sucedido, dados do usuário recebidos');
    }
    return { user: data.user || null };
  } catch (error) {
    console.error('[CLIENT] Erro no processo de login:', error);
    return { 
      user: null, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}
