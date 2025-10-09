import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
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
    const { chatId } = context.params;
    
    // Criar cliente do Supabase com a chave de serviço
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar detalhes do chat (inclui agent_type para validação)
    const { data: chat, error } = await supabase
      .from('chats')
      .select('id, user_id, title, created_at, agent_type')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single();
      
    if (error) {
      console.error('Erro ao buscar detalhes do chat:', error);
      return NextResponse.json({ error: 'Erro ao buscar detalhes do chat' }, { status: 500 });
    }
    
    if (!chat) {
      return NextResponse.json({ error: 'Chat não encontrado' }, { status: 404 });
    }

    // Buscar dados do usuário para verificar expiração e plano
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, data_expiracao, plano')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.error('Erro ao buscar dados do usuário:', userError);
      return NextResponse.json({ error: 'Erro ao buscar dados do usuário' }, { status: 500 });
    }

    // Verificar expiração
    let diasRestantes: number | undefined;
    if (userData.data_expiracao) {
      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      const exp = new Date(userData.data_expiracao);
      exp.setHours(0,0,0,0);
      diasRestantes = Math.ceil((exp.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      if (hoje > exp) {
        return NextResponse.json({ error: 'Seu plano expirou. Renove para continuar usando.' }, { status: 403 });
      }
    }

    // Validar plano usando agent_type (com fallback para título)
    if (userData.plano) {
      const type = (chat as any).agent_type as string | null;
      if (type === 'apresentacao' && !(userData.plano === 'Ambas' || userData.plano === 'Apresentação para Reunião de Resultados')) {
        return NextResponse.json({ error: 'Seu plano não inclui acesso à Apresentação para Reunião de Resultados.' }, { status: 403 });
      }
      if (type === 'comunicacao' && !(userData.plano === 'Ambas' || userData.plano === 'Comunicação Executiva')) {
        return NextResponse.json({ error: 'Seu plano não inclui acesso à Comunicação Executiva.' }, { status: 403 });
      }
      if (!type) {
        const title = (chat.title || '').toLowerCase();
        const isApresentacao = title.includes('apresentação') || title.includes('reuniao') || title.includes('reunião');
        if (isApresentacao && !(userData.plano === 'Ambas' || userData.plano === 'Apresentação para Reunião de Resultados')) {
          return NextResponse.json({ error: 'Seu plano não inclui acesso à Apresentação para Reunião de Resultados.' }, { status: 403 });
        }
        if (!isApresentacao && !(userData.plano === 'Ambas' || userData.plano === 'Comunicação Executiva')) {
          return NextResponse.json({ error: 'Seu plano não inclui acesso à Comunicação Executiva.' }, { status: 403 });
        }
      }
    }
    
    return NextResponse.json({ chat, diasRestantes, dataExpiracao: userData.data_expiracao || null });
    
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
