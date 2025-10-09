import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
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
    
    // Obter dados da requisição
    const { chatId, message } = await request.json();
    
    if (!chatId || !message) {
      return NextResponse.json(
        { success: false, error: 'ID do chat e mensagem são obrigatórios' },
        { status: 400 }
      );
    }
    
    // Criar cliente do Supabase com a chave de serviço
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verificar se o chat pertence ao usuário
    const { data: chatData, error: chatError } = await supabase
      .from('chats')
      .select('id, title, agent_type')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single();
    
    if (chatError || !chatData) {
      return NextResponse.json(
        { success: false, error: 'Chat não encontrado ou não pertence ao usuário' },
        { status: 404 }
      );
    }
    
    // Garantir que este endpoint seja usado apenas para chats de Apresentação
    if ((chatData as any).agent_type && (chatData as any).agent_type !== 'apresentacao') {
      return NextResponse.json(
        { success: false, error: 'Este chat pertence a outro agente. Use o endpoint correto.' },
        { status: 400 }
      );
    }

    // Buscar dados do usuário
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, nome, telefone, data_expiracao, plano')
      .eq('id', userId)
      .single();
      
    if (userError || !userData) {
      console.error('Erro ao buscar dados do usuário:', userError);
      return NextResponse.json({ error: 'Erro ao buscar dados do usuário' }, { status: 500 });
    }
    
    // Verificar expiração do plano
    if (userData.data_expiracao) {
      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      const exp = new Date(userData.data_expiracao);
      exp.setHours(0,0,0,0);
      if (hoje > exp) {
        return NextResponse.json(
          { success: false, error: 'Seu plano expirou. Renove para continuar usando.' },
          { status: 403 }
        );
      }
    }

    // Verificar plano permite Apresentação para Reunião de Resultados
    if (userData.plano && !(userData.plano === 'Ambas' || userData.plano === 'Apresentação para Reunião de Resultados')) {
      return NextResponse.json(
        { success: false, error: 'Seu plano não inclui acesso à Apresentação para Reunião de Resultados.' },
        { status: 403 }
      );
    }

    // Salvar a mensagem do usuário na tabela scripts
    const { data: messageData, error: messageError } = await supabase
      .from('scripts')
      .insert([
        {
          user_id: userId,
          chatid: chatId,
          input: message,
          output: null // A resposta será atualizada quando o webhook responder
        }
      ])
      .select()
      .single();
    
    if (messageError) {
      console.error('Erro ao inserir mensagem:', messageError);
      return NextResponse.json(
        { success: false, error: 'Erro ao salvar mensagem' },
        { status: 500 }
      );
    }
    
    // Enviar dados para o webhook do agente Apresentação para Reunião de Resultados
    try {
      const webhookUrl = 'https://webhookbussola.palmup.com.br/webhook/ia/bussolascriptresultado';
      
      const webhookPayload = {
        chatId: chatId,
        message: message,
        scriptId: messageData.id, // Enviar o ID do script para o webhook
        user: {
          id: userData.id,
          email: userData.email,
          nome: userData.nome,
          telefone: userData.telefone
        }
      };
      
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });
      
      if (!webhookResponse.ok) {
        console.error('Erro ao enviar mensagem para webhook:', await webhookResponse.text());
      }
    } catch (webhookError) {
      console.error('Erro ao enviar mensagem para webhook:', webhookError);
      // Não falhar a requisição se o webhook falhar
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Mensagem enviada com sucesso',
      scriptId: messageData.id
    });
    
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
