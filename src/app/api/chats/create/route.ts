import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import { userHasAgentAccess } from '@/lib/agent-access';
import { getAgentWebhookUrl } from '@/lib/server/agent-webhooks';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Variaveis de ambiente do Supabase nao encontradas');
      return NextResponse.json({ error: 'Configuracao do servidor invalida' }, { status: 500 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Usuario nao autenticado' }, { status: 401 });
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error('JWT_SECRET nao configurado');
      return NextResponse.json({ error: 'Configuracao do servidor invalida' }, { status: 500 });
    }

    let decoded: { userId: string; email: string };

    try {
      decoded = jwt.verify(token, jwtSecret) as { userId: string; email: string };
    } catch (jwtError) {
      console.error('Token invalido:', jwtError);
      return NextResponse.json({ error: 'Token invalido' }, { status: 401 });
    }

    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Token invalido' }, { status: 401 });
    }

    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Mensagem nao fornecida' }, { status: 400 });
    }

    const userId = decoded.userId;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const accessResult = await userHasAgentAccess(supabase, userId, 'comunicacao');

    if (!accessResult.access || !accessResult.user) {
      return NextResponse.json(
        { error: accessResult.error || 'Acesso negado' },
        { status: accessResult.status || 403 }
      );
    }

    const { data: chatData, error: chatError } = await supabase
      .from('chats')
      .insert([
        {
          user_id: userId,
          title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
          agent_type: 'comunicacao',
        },
      ])
      .select('id, title, created_at')
      .single();

    if (chatError || !chatData) {
      console.error('Erro ao criar chat:', chatError);
      return NextResponse.json({ error: 'Erro ao criar chat' }, { status: 500 });
    }

    const { data: scriptData, error: scriptError } = await supabase
      .from('scripts')
      .insert([
        {
          user_id: userId,
          chatid: chatData.id,
          input: message,
          output: null,
        },
      ])
      .select('id')
      .single();

    if (scriptError || !scriptData?.id) {
      console.error('Erro ao salvar mensagem na tabela scripts:', scriptError);
      return NextResponse.json({ error: 'Erro ao salvar mensagem' }, { status: 500 });
    }

    const { id, email, nome, telefone } = accessResult.user;
    const webhookPayload = {
      chatId: chatData.id,
      message,
      scriptId: scriptData.id,
      user: { id, email, nome, telefone },
    };

    try {
      const webhookResponse = await fetch(getAgentWebhookUrl('comunicacao'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });

      if (!webhookResponse.ok) {
        console.error('Erro ao enviar dados para webhook:', await webhookResponse.text());
      }
    } catch (webhookError) {
      console.error('Erro ao chamar webhook:', webhookError);
    }

    return NextResponse.json({
      success: true,
      chat: chatData,
    });
  } catch (error) {
    console.error('Erro ao processar requisicao:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
