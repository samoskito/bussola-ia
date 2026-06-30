import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import { getAgentByType } from '@/lib/agents';
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

    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Token invalido' }, { status: 401 });
    }

    const userId = decoded.userId;
    const { chatId, message } = await request.json();

    if (!chatId || !message) {
      return NextResponse.json({ error: 'ID do chat e mensagem sao obrigatorios' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: chatData, error: chatError } = await supabase
      .from('chats')
      .select('id, user_id, agent_type')
      .eq('id', chatId)
      .single();

    if (chatError || !chatData) {
      console.error('Erro ao verificar chat:', chatError);
      return NextResponse.json({ error: 'Chat nao encontrado' }, { status: 404 });
    }

    if (chatData.user_id !== userId) {
      return NextResponse.json({ error: 'Nao autorizado a acessar este chat' }, { status: 403 });
    }

    const agent = getAgentByType((chatData as { agent_type?: string | null }).agent_type || 'comunicacao');

    if (!agent) {
      return NextResponse.json({ error: 'Agente invalido' }, { status: 400 });
    }

    const accessResult = await userHasAgentAccess(supabase, userId, agent.type);

    if (!accessResult.access || !accessResult.user) {
      return NextResponse.json(
        { error: accessResult.error || 'Acesso negado' },
        { status: accessResult.status || 403 }
      );
    }

    const { data: scriptData, error: scriptError } = await supabase
      .from('scripts')
      .insert([
        {
          user_id: userId,
          chatid: chatId,
          input: message,
          output: null,
        },
      ])
      .select()
      .single();

    if (scriptError || !scriptData) {
      console.error('Erro ao salvar mensagem na tabela scripts:', scriptError);
      return NextResponse.json({ error: 'Erro ao salvar mensagem' }, { status: 500 });
    }

    const webhookUrl = getAgentWebhookUrl(agent.type);
    const scriptId = scriptData.id;
    const { id, email, nome, telefone } = accessResult.user;

    const webhookPayload = {
      chatId,
      message,
      scriptId,
      user: { id, email, nome, telefone }
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

      return NextResponse.json({
        success: true,
        message: 'Mensagem enviada com sucesso',
        scriptId,
      });
    } catch (webhookError) {
      console.error('Erro ao chamar webhook:', webhookError);
      return NextResponse.json({ error: 'Erro ao processar mensagem' }, { status: 500 });
    }
  } catch (error) {
    console.error('Erro ao processar requisicao:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
