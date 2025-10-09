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
    const { message } = await request.json();
    
    if (!message) {
      return NextResponse.json({ error: 'Mensagem não fornecida' }, { status: 400 });
    }
    
    // Criar cliente do Supabase com a chave de serviço
    const supabase = createClient(supabaseUrl, supabaseKey);
    
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
        return NextResponse.json({ error: 'Seu plano expirou. Renove para continuar usando.' }, { status: 403 });
      }
    }

    // Verificar plano permite Apresentação para Reunião de Resultados
    if (userData.plano && !(userData.plano === 'Ambas' || userData.plano === 'Apresentação para Reunião de Resultados')) {
      return NextResponse.json({ error: 'Seu plano não inclui acesso à Apresentação para Reunião de Resultados.' }, { status: 403 });
    }

    // Criar um novo chat
    const { data: chatData, error: chatError } = await supabase
      .from('chats')
      .insert([
        { 
          user_id: userId,
          title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
          agent_type: 'apresentacao'
          // Removida referência à coluna 'type' que não existe na tabela 'chats'
        }
      ])
      .select('id, title, created_at')
      .single();
    
    if (chatError || !chatData) {
      console.error('Erro ao criar chat:', chatError);
      return NextResponse.json({ error: 'Erro ao criar chat' }, { status: 500 });
    }
    
    // Salvar a mensagem inicial na tabela scripts
    const { data: scriptData, error: scriptError } = await supabase
      .from('scripts')
      .insert([
        {
          user_id: userId,
          chatid: chatData.id,
          input: message,
          output: null // A resposta será atualizada quando o webhook responder
        }
      ])
      .select();

    if (scriptError) {
      console.error('Erro ao salvar mensagem na tabela scripts:', scriptError);
      // Não retornamos erro aqui para não bloquear a criação do chat, mas logamos o problema
    } else {
      console.log('Mensagem inicial salva com sucesso na tabela scripts, ID:', scriptData[0]?.id);
    }
    
    // Enviar dados para o webhook do agente Apresentação para Reunião de Resultados
    const webhookUrl = 'https://webhookbussola.palmup.com.br/webhook/ia/bussolascriptresultado';
    
    const webhookPayload = {
      chatId: chatData.id,
      message: message,
      scriptId: scriptData?.[0]?.id, // Incluir o ID do script para rastreamento
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
      }
    } catch (webhookError) {
      console.error('Erro ao chamar webhook:', webhookError);
      // Não retornamos erro aqui para não bloquear a criação do chat
    }
    
    return NextResponse.json({ 
      success: true, 
      chat: chatData
    });
    
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
