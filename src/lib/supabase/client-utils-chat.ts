'use client';

/**
 * Função para buscar os chats do usuário no cliente
 */
export async function fetchUserChats(): Promise<{ chats: any[] | null; expirado?: boolean; diasRestantes?: number; dataExpiracao?: string | null; error?: string }> {
  try {
    console.log('Iniciando fetchUserChats');
    
    const response = await fetch('/api/chats', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      // Garantir que não use cache
      cache: 'no-store',
      // Importante para garantir que os cookies sejam enviados
      credentials: 'include'
    });
    
    console.log('Status da resposta API chats:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Resposta de erro da API:', errorText);
      throw new Error(`Erro ao buscar chats: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Dados recebidos da API chats:', data);
    
    // Garantir que sempre retorne um array, mesmo vazio, e propagar metadados
    return { 
      chats: Array.isArray(data.chats) ? data.chats : [],
      expirado: typeof data.expirado === 'boolean' ? data.expirado : undefined,
      diasRestantes: typeof data.diasRestantes === 'number' ? data.diasRestantes : undefined,
      dataExpiracao: typeof data.dataExpiracao === 'string' || data.dataExpiracao === null ? data.dataExpiracao : undefined
    };
  } catch (error) {
    console.error('Fetch chats error:', error);
    return { 
      chats: [], 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}
