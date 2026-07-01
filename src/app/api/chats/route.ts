import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import type { AgentType } from '@/lib/agents';
import { isAgentAvailableForUser } from '@/lib/agents';

const hasDateExpired = (dateValue?: string | null) => {
  if (!dateValue) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiration = new Date(dateValue);
  expiration.setHours(0, 0, 0, 0);

  return today > expiration;
};

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
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }
    
    const userId = decoded.userId;
    
    // Criar cliente do Supabase com a chave de serviço
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar dados do usuário para verificar expiração
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, data_expiracao, plano, nivel')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.error('Erro ao buscar dados do usuário:', userError);
      return NextResponse.json({ error: 'Erro ao buscar dados do usuário' }, { status: 500 });
    }

    const isAdmin = userData.nivel === 'admin';

    // Bloquear listagem caso plano expirado (e calcular dias restantes)
    let diasRestantes: number | undefined;
    if (!isAdmin && userData.data_expiracao) {
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
    // Se o usuário não tem acesso global, filtrar a lista pelos agentes liberados
    let filtered = chats || [];
    filtered = filtered.filter((c: any) => {
      const chatAgentType = (c.agent_type || 'comunicacao') as AgentType;
      return isAgentAvailableForUser(chatAgentType, userData.nivel);
    });

    const hasGlobalAgentAccess = isAdmin || userData.plano === 'Todas' || userData.plano === 'Ambas';

    if (!hasGlobalAgentAccess) {
      const { data: allowedRows, error: allowedError } = await supabase
        .from('user_agent_access')
        .select('agent_type, expires_at')
        .eq('user_id', userId)
        .eq('enabled', true);

      if (allowedError) {
        console.error('Erro ao buscar acessos de agentes:', allowedError);
        return NextResponse.json({ error: 'Erro ao buscar acessos de agentes' }, { status: 500 });
      }

      const allowedAgentTypes = new Set(
        (allowedRows || [])
          .filter((row: any) => !hasDateExpired(row.expires_at))
          .map((row: any) => row.agent_type as AgentType)
      );

      filtered = filtered.filter((c: any) => {
        const chatAgentType = (c.agent_type || 'comunicacao') as AgentType;
        return allowedAgentTypes.has(chatAgentType);
      });
    }

    return NextResponse.json({
      chats: filtered,
      expirado: false,
      diasRestantes: isAdmin ? undefined : diasRestantes,
      dataExpiracao: isAdmin ? null : userData.data_expiracao || null,
    });
    
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
