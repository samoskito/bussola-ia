import type { AgentType } from '@/lib/agents';
import { isAgentAvailableForUser } from '@/lib/agents';

type SupabaseLikeClient = {
  from: (table: string) => any;
};

export interface AgentAccessUser {
  id: string;
  email: string;
  nome: string | null;
  telefone: string | null;
  data_expiracao: string | null;
  plano: string | null;
  nivel: string | null;
}

export interface AgentAccessResult {
  access: boolean;
  error?: string;
  status?: number;
  user?: AgentAccessUser;
}

const hasDateExpired = (dateValue?: string | null) => {
  if (!dateValue) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiration = new Date(dateValue);
  expiration.setHours(0, 0, 0, 0);

  return today > expiration;
};

export async function userHasAgentAccess(
  supabase: SupabaseLikeClient,
  userId: string,
  agentType: AgentType
): Promise<AgentAccessResult> {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, nome, telefone, data_expiracao, plano, nivel')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    console.error('Erro ao buscar dados do usuario:', userError);
    return {
      access: false,
      error: 'Erro ao buscar dados do usuario',
      status: 500,
    };
  }

  const accessUser = user as AgentAccessUser;

  if (!isAgentAvailableForUser(agentType, accessUser.nivel)) {
    return {
      access: false,
      error: 'Este agente estara disponivel em breve.',
      status: 403,
      user: accessUser,
    };
  }

  if (hasDateExpired(accessUser.data_expiracao)) {
    return {
      access: false,
      error: 'Seu plano expirou. Renove para continuar usando.',
      status: 403,
      user: accessUser,
    };
  }

  if (accessUser.plano === 'Todas' || accessUser.plano === 'Ambas') {
    return {
      access: true,
      user: accessUser,
    };
  }

  const { data: agentAccess, error: accessError } = await supabase
    .from('user_agent_access')
    .select('enabled, expires_at')
    .eq('user_id', userId)
    .eq('agent_type', agentType)
    .eq('enabled', true)
    .maybeSingle();

  if (accessError) {
    console.error('Erro ao verificar acesso do agente:', accessError);
    return {
      access: false,
      error: 'Erro ao verificar acesso do agente',
      status: 500,
      user: accessUser,
    };
  }

  if (!agentAccess || hasDateExpired((agentAccess as { expires_at?: string | null }).expires_at)) {
    return {
      access: false,
      error: 'Seu plano nao inclui acesso a este agente.',
      status: 403,
      user: accessUser,
    };
  }

  return {
    access: true,
    user: accessUser,
  };
}
