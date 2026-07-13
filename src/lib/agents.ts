export const AGENTS = [
  {
    type: 'comunicacao',
    name: 'Comunicação Executiva',
    description: 'Gere scripts personalizados para suas necessidades',
    icon: '/images/comunicacao-executiva-logo.png',
    adminOnly: false,
    availabilityLabel: null,
    availabilityMessage: null,
  },
  {
    type: 'apresentacao',
    name: 'Apresentação para Reunião de Resultados',
    description: 'Crie apresentações de resultados profissionais',
    icon: '/images/apresentacao-resultados-logo.png',
    adminOnly: false,
    availabilityLabel: null,
    availabilityMessage: null,
  },
  {
    type: 'conversas_dificeis',
    name: 'Conversas Dificeis',
    description: 'Prepare conversas sensiveis com clareza, empatia e direção',
    icon: '/images/conversas-dificeis-logo.jpeg',
    adminOnly: false,
    availabilityLabel: null,
    availabilityMessage: null,
  },
  {
    type: 'postagem',
    name: 'Postagem no Linkedin',
    description: 'Crie posts profissionais para LinkedIn com apoio da IA',
    icon: '/images/postagem-linkedin-logo.jpeg',
    adminOnly: true,
    availabilityLabel: 'EM ATUALIZAÇÃO',
    availabilityMessage: 'Esta IA está em atualização e ficará disponível novamente assim que a manutenção terminar.',
  },
] as const;

export type AgentType = (typeof AGENTS)[number]['type'];

export function getAgentByType(type: string) {
  return AGENTS.find((agent) => agent.type === type) || null;
}

export function getAgentLabel(type: string) {
  return getAgentByType(type)?.name || type;
}

export function isAgentAdminOnly(type: string) {
  return Boolean(getAgentByType(type)?.adminOnly);
}

export function isAgentAvailableForUser(type: string, userNivel?: string | null) {
  return !isAgentAdminOnly(type) || userNivel === 'admin';
}

export function getAgentAvailabilityMessage(type: string) {
  return getAgentByType(type)?.availabilityMessage || 'Este agente está temporariamente indisponível.';
}
