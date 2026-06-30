import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import { userHasAgentAccess } from '@/lib/agent-access';
import { getAgentWebhookUrl } from '@/lib/server/agent-webhooks';

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Variaveis de ambiente do Supabase nao encontradas');
      return NextResponse.json({ success: false, error: 'Configuracao do servidor invalida' }, { status: 500 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ success: false, error: 'Usuario nao autenticado' }, { status: 401 });
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error('JWT_SECRET nao configurado');
      return NextResponse.json({ success: false, error: 'Configuracao do servidor invalida' }, { status: 500 });
    }

    let decoded: { userId: string; email: string };

    try {
      decoded = jwt.verify(token, jwtSecret) as { userId: string; email: string };
    } catch (jwtError) {
      console.error('Token invalido:', jwtError);
      return NextResponse.json({ success: false, error: 'Token invalido' }, { status: 401 });
    }

    if (!decoded?.userId) {
      return NextResponse.json({ success: false, error: 'Token invalido' }, { status: 401 });
    }

    const { chatId, message } = await request.json();

    if (!chatId || !message) {
      return NextResponse.json(
        { success: false, error: 'ID do chat e mensagem sao obrigatorios' },
        { status: 400 }
      );
    }

    const userId = decoded.userId;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: chatData, error: chatError } = await supabase
      .from('chats')
      .select('id, title, user_id, agent_type')
      .eq('id', chatId)
      .single();

    if (chatError || !chatData || chatData.user_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Chat nao encontrado ou nao pertence ao usuario' },
        { status: 404 }
      );
    }

    if ((chatData as { agent_type?: string | null }).agent_type && (chatData as { agent_type?: string | null }).agent_type !== 'apresentacao') {
      return NextResponse.json(
        { success: false, error: 'Este chat pertence a outro agente. Use o endpoint correto.' },
        { status: 400 }
      );
    }

    const accessResult = await userHasAgentAccess(supabase, userId, 'apresentacao');

    if (!accessResult.access || !accessResult.user) {
      return NextResponse.json(
        { success: false, error: accessResult.error || 'Acesso negado' },
        { status: accessResult.status || 403 }
      );
    }

    const { data: messageData, error: messageError } = await supabase
      .from('scripts')
      .insert([
        {
          user_id: userId,
          chatid: chatId,
          input: message,
          output: null,
        },
      ])
      .select('id')
      .single();

    if (messageError || !messageData?.id) {
      console.error('Erro ao inserir mensagem:', messageError);
      return NextResponse.json(
        { success: false, error: 'Erro ao salvar mensagem' },
        { status: 500 }
      );
    }

    const { id, email, nome, telefone } = accessResult.user;
    const webhookPayload = {
      chatId,
      message,
      scriptId: messageData.id,
      user: { id, email, nome, telefone },
    };

    try {
      const webhookResponse = await fetch(getAgentWebhookUrl('apresentacao'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });

      if (!webhookResponse.ok) {
        console.error('Erro ao enviar mensagem para webhook:', await webhookResponse.text());
      }
    } catch (webhookError) {
      console.error('Erro ao enviar mensagem para webhook:', webhookError);
    }

    return NextResponse.json({
      success: true,
      message: 'Mensagem enviada com sucesso',
      scriptId: messageData.id,
    });
  } catch (error) {
    console.error('Erro ao processar requisicao:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
