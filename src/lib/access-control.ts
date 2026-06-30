/**
 * Sistema de Controle de Acesso
 * Gerencia permissoes de acesso as IAs baseado em plano e data de expiracao.
 */

export type TipoIA =
  | 'Comunicacao Executiva'
  | 'Comunicação Executiva'
  | 'Apresentacao para Reuniao de Resultados'
  | 'Apresentação para Reunião de Resultados'
  | 'Conversas Dificeis'
  | 'Postagem no Linkedin';
export type Plano = TipoIA | 'Todas' | 'Personalizado' | 'Ambas';

export interface Usuario {
  id: string;
  nome?: string | null;
  email: string;
  data_expiracao?: string | null;
  plano?: Plano | null;
  [key: string]: any;
}

const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

export interface ResultadoVerificacao {
  acesso: boolean;
  motivo?: string;
  expirado?: boolean;
  diasRestantes?: number;
}

const planoSemAcesso: ResultadoVerificacao = {
  acesso: false,
  motivo: 'Seu usuario ainda nao possui um plano definido.',
  expirado: false,
};

export const verificarAcessoIA = (usuario: Usuario, tipoIA: TipoIA): ResultadoVerificacao => {
  devLog('[ACCESS CONTROL] Verificando acesso:', {
    usuario: usuario.email,
    tipoIA,
    plano: usuario.plano,
    data_expiracao: usuario.data_expiracao,
  });

  // A migracao normaliza usuarios atuais para "Todas"; sem plano nao deve bypassar permissao.
  if (!usuario.plano) {
    devLog('[ACCESS CONTROL] Sem plano definido, negando acesso');
    return planoSemAcesso;
  }

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
        diasRestantes: 0,
      };
    }

    const diasRestantes = Math.ceil((dataExpiracao.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

    if (usuario.plano === 'Todas' || usuario.plano === 'Ambas' || usuario.plano === tipoIA) {
      devLog('[ACCESS CONTROL] Acesso liberado! Plano:', usuario.plano, 'IA:', tipoIA);
      return {
        acesso: true,
        diasRestantes,
      };
    }

    devLog('[ACCESS CONTROL] Acesso negado! Plano nao inclui esta IA');
    return {
      acesso: false,
      motivo: `Seu plano atual e "${usuario.plano}". Para acessar "${tipoIA}", voce precisa fazer upgrade.`,
      expirado: false,
      diasRestantes,
    };
  }

  if (usuario.plano === 'Todas' || usuario.plano === 'Ambas' || usuario.plano === tipoIA) {
    return { acesso: true };
  }

  return {
    acesso: false,
    motivo: `Seu plano atual e "${usuario.plano}". Para acessar "${tipoIA}", voce precisa fazer upgrade.`,
    expirado: false,
  };
};

export const verificarAcessoGeral = (usuario: Usuario): ResultadoVerificacao => {
  if (!usuario.plano) {
    return planoSemAcesso;
  }

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
        diasRestantes: 0,
      };
    }

    const diasRestantes = Math.ceil((dataExpiracao.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

    return {
      acesso: true,
      diasRestantes,
    };
  }

  return { acesso: true };
};

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

export const formatarDataExpiracao = (dataExpiracao?: string | null): string => {
  if (!dataExpiracao) return 'Sem data de expiracao';

  const data = new Date(dataExpiracao);
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const getCorPlano = (diasRestantes?: number): string => {
  if (!diasRestantes || diasRestantes <= 0) return 'bg-red-500';
  if (diasRestantes <= 3) return 'bg-orange-500';
  if (diasRestantes <= 7) return 'bg-yellow-500';
  return 'bg-green-500';
};
