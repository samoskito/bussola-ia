import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';

export async function POST(request: Request) {
  try {
    // Obter as variáveis de ambiente do Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Variáveis de ambiente do Supabase não encontradas');
      return NextResponse.json({ error: 'Configuração do servidor inválida' }, { status: 500 });
    }
    
    // Obter o token de autenticação do cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }
    
    // Verificar o token JWT para obter o ID do usuário
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as { userId: string; email: string };
    
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }
    
    const userId = decoded.userId;
    
    // Obter dados da mensagem do corpo da requisição
    const { chatId, message } = await request.json();
    
    if (!chatId || !message) {
      return NextResponse.json({ error: 'ID do chat e mensagem são obrigatórios' }, { status: 400 });
    }
    
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
    
    // Buscar dados do usuário
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, nome, telefone')
      .eq('id', userId)
      .single();
      
    if (userError || !userData) {
      console.error('Erro ao buscar dados do usuário:', userError);
      return NextResponse.json({ error: 'Erro ao buscar dados do usuário' }, { status: 500 });
    }
    
    // Enviar dados para o webhook
    const webhookUrl = 'https://webhook.bussolaexecutiva.com.br/webhook/91bb0137-006c-41d8-aba3-e29883ed46dc';
    
    const webhookPayload = {
      chatId: chatId,
      message: message,
      user: {
        id: userData.id,
        email: userData.email,
        nome: userData.nome,
        telefone: userData.telefone
      }
    };
    
    try {
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });
      
      if (!webhookResponse.ok) {
        console.error('Erro ao enviar dados para webhook:', await webhookResponse.text());
        return NextResponse.json({ error: 'Erro ao processar mensagem' }, { status: 500 });
      }
      
      // Resposta bem-sucedida do webhook
      return NextResponse.json({ 
        success: true, 
        message: 'Mensagem enviada com sucesso'
      });
      
    } catch (webhookError) {
      console.error('Erro ao chamar webhook:', webhookError);
      return NextResponse.json({ error: 'Erro ao processar mensagem' }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
