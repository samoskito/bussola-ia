/**
 * Sistema de Controle de Acesso
 * Gerencia permissões de acesso às IAs baseado em plano e data de expiração
 */

export type TipoIA = 'Comunicação Executiva' | 'Apresentação para Reunião de Resultados';
export type Plano = 'Comunicação Executiva' | 'Apresentação para Reunião de Resultados' | 'Ambas';

export interface Usuario {
  id: string;
  nome?: string | null;
  email: string;
  data_expiracao?: string | null;
  plano?: Plano | null;
  [key: string]: any;
}

// Log apenas em desenvolvimento
const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

export interface ResultadoVerificacao {
  acesso: boolean;
  motivo?: string;
  expirado?: boolean;
  diasRestantes?: number;
}

/**
 * Verifica se o usuário tem acesso a uma IA específica
 */
export const verificarAcessoIA = (usuario: Usuario, tipoIA: TipoIA): ResultadoVerificacao => {
  devLog('[ACCESS CONTROL] Verificando acesso:', {
    usuario: usuario.email,
    tipoIA,
    plano: usuario.plano,
    data_expiracao: usuario.data_expiracao
  });
  
  // Se não tem plano definido, libera acesso (compatibilidade com usuários antigos)
  if (!usuario.plano) {
    devLog('[ACCESS CONTROL] Sem plano definido, liberando acesso (compatibilidade)');
    return { acesso: true };
  }

  // Verificar se o plano expirou
  if (usuario.data_expiracao) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Zerar horas para comparação apenas de data
    
    const dataExpiracao = new Date(usuario.data_expiracao);
    dataExpiracao.setHours(0, 0, 0, 0);
    
    if (hoje > dataExpiracao) {
      return {
        acesso: false,
        motivo: 'Seu plano expirou. Renove para continuar usando.',
        expirado: true,
        diasRestantes: 0
      };
    }
    
    // Calcular dias restantes
    const diasRestantes = Math.ceil((dataExpiracao.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    
    // Verificar se tem acesso à IA específica
    if (usuario.plano === 'Ambas' || usuario.plano === tipoIA) {
      devLog('[ACCESS CONTROL] Acesso liberado! Plano:', usuario.plano, 'IA:', tipoIA);
      return {
        acesso: true,
        diasRestantes
      };
    }
    
    devLog('[ACCESS CONTROL] Acesso negado! Plano não inclui esta IA');
    return {
      acesso: false,
      motivo: `Seu plano atual é "${usuario.plano}". Para acessar "${tipoIA}", você precisa fazer upgrade.`,
      expirado: false,
      diasRestantes
    };
  }
  
  // Se não tem data de expiração mas tem plano, verificar apenas o plano
  if (usuario.plano === 'Ambas' || usuario.plano === tipoIA) {
    return { acesso: true };
  }
  
  return {
    acesso: false,
    motivo: `Seu plano atual é "${usuario.plano}". Para acessar "${tipoIA}", você precisa fazer upgrade.`,
    expirado: false
  };
};

/**
 * Verifica se o usuário tem acesso a qualquer IA
 */
export const verificarAcessoGeral = (usuario: Usuario): ResultadoVerificacao => {
  // Se não tem plano definido, libera acesso
  if (!usuario.plano) {
    return { acesso: true };
  }

  // Verificar apenas se expirou
  if (usuario.data_expiracao) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const dataExpiracao = new Date(usuario.data_expiracao);
    dataExpiracao.setHours(0, 0, 0, 0);
    
    if (hoje > dataExpiracao) {
      return {
        acesso: false,
        motivo: 'Seu plano expirou. Renove para continuar usando.',
        expirado: true,
        diasRestantes: 0
      };
    }
    
    const diasRestantes = Math.ceil((dataExpiracao.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      acesso: true,
      diasRestantes
    };
  }
  
  return { acesso: true };
};

/**
 * Retorna mensagem de aviso quando o plano está próximo de expirar
 */
export const getMensagemAviso = (diasRestantes?: number): string | null => {
  if (!diasRestantes) return null;
  
  if (diasRestantes <= 0) {
    return 'Seu plano expirou hoje!';
  }
  
  if (diasRestantes <= 3) {
    return `Seu plano expira em ${diasRestantes} dia${diasRestantes > 1 ? 's' : ''}!`;
  }
  
  if (diasRestantes <= 7) {
    return `Seu plano expira em ${diasRestantes} dias.`;
  }
  
  return null;
};

/**
 * Formata a data de expiração para exibição
 */
export const formatarDataExpiracao = (dataExpiracao?: string | null): string => {
  if (!dataExpiracao) return 'Sem data de expiração';
  
  const data = new Date(dataExpiracao);
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Retorna a cor apropriada para o badge do plano
 */
export const getCorPlano = (diasRestantes?: number): string => {
  if (!diasRestantes || diasRestantes <= 0) return 'bg-red-500';
  if (diasRestantes <= 3) return 'bg-orange-500';
  if (diasRestantes <= 7) return 'bg-yellow-500';
  return 'bg-green-500';
};
