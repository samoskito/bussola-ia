import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';

export async function GET(request: Request) {
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
    
    // Criar cliente do Supabase com a chave de serviço
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar dados do usuário para verificar expiração
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, data_expiracao, plano')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.error('Erro ao buscar dados do usuário:', userError);
      return NextResponse.json({ error: 'Erro ao buscar dados do usuário' }, { status: 500 });
    }

    // Bloquear listagem caso plano expirado (e calcular dias restantes)
    let diasRestantes: number | undefined;
    if (userData.data_expiracao) {
      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      const exp = new Date(userData.data_expiracao);
      exp.setHours(0,0,0,0);
      diasRestantes = Math.ceil((exp.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      if (hoje > exp) {
        return NextResponse.json({ chats: [], expirado: true, diasRestantes: 0, dataExpiracao: userData.data_expiracao }, { status: 200 });
      }
    }
    
    // Buscar todos os chats do usuário
    const { data: chats, error } = await supabase
      .from('chats')
      .select('id, title, created_at, agent_type')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Erro ao buscar chats:', error);
      return NextResponse.json({ error: 'Erro ao buscar chats' }, { status: 500 });
    }
    // Se o usuário não tem acesso a ambas as IAs, filtrar a lista
    let filtered = chats || [];
    if (userData.plano && userData.plano !== 'Ambas') {
      const allowCom = userData.plano === 'Comunicação Executiva';
      const allowApr = userData.plano === 'Apresentação para Reunião de Resultados';
      filtered = filtered.filter((c: any) => {
        // prefer agent_type when present
        if (c.agent_type === 'apresentacao') return allowApr;
        if (c.agent_type === 'comunicacao') return allowCom;
        // fallback to title inference if agent_type is null
        const title = (c.title || '').toLowerCase();
        const isApr = title.includes('apresentação') || title.includes('reuniao') || title.includes('reunião');
        return isApr ? allowApr : allowCom;
      });
    }

    return NextResponse.json({ chats: filtered, expirado: false, diasRestantes, dataExpiracao: userData.data_expiracao || null });
    
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
