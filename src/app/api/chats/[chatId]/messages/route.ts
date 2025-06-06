import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as jwt from 'jsonwebtoken';

export async function GET(
  request: Request,
  context: { params: { chatId: string } }
) {
  try {
    // Obter as variáveis de ambiente do Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Variáveis de ambiente do Supabase não encontradas');
      return NextResponse.json({ error: 'Configuração do servidor inválida' }, { status: 500 });
    }
    
    // Obter o token de autenticação do cookie
    const cookieHeader = request.headers.get('cookie') || '';
    const tokenMatch = cookieHeader.match(/auth_token=([^;]+)/);
    const token = tokenMatch ? tokenMatch[1] : '';
    
    if (!token) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }
    
    // Verificar o token JWT para obter o ID do usuário
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as { userId: string; email: string };
    
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }
    
    const userId = decoded.userId;
    // Usar context.params para acessar parâmetros no Next.js 15
    const { chatId } = context.params;
    
    // Criar cliente do Supabase com a chave de serviço
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verificar se o chat pertence ao usuário
    const { data: chatData, error: chatError } = await supabase
      .from('chats')
      .select('id, user_id')
      .eq('id', chatId)
      .single();
    
    if (chatError || !chatData) {
      console.error('Erro ao verificar chat:', chatError);
      return NextResponse.json({ error: 'Chat não encontrado' }, { status: 404 });
    }
    
    // Verificar se o chat pertence ao usuário autenticado
    if (chatData.user_id !== userId) {
      return NextResponse.json({ error: 'Não autorizado a acessar este chat' }, { status: 403 });
    }
    
    // Buscar mensagens do chat na tabela scripts
    const { data: messages, error: messagesError } = await supabase
      .from('scripts')
      .select('*')
      .eq('chatid', chatId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    
    if (messagesError) {
      console.error('Erro ao buscar mensagens:', messagesError);
      return NextResponse.json({ error: 'Erro ao buscar mensagens' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      messages: messages 
    });
    
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
