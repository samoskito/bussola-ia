'use client';

/**
 * Função para buscar os chats do usuário no cliente
 */
export async function fetchUserChats(): Promise<{ chats: any[] | null; error?: string }> {
  try {
    const response = await fetch('/api/chats', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Erro ao buscar chats');
    }
    
    const data = await response.json();
    return { chats: data.chats || [] };
  } catch (error) {
    console.error('Fetch chats error:', error);
    return { 
      chats: [], 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}
