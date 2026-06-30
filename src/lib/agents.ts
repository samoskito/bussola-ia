export const AGENTS = [
  {
    type: 'comunicacao',
    name: 'Comunicação Executiva',
    description: 'Gere scripts personalizados para suas necessidades',
    icon: '/images/comunicacao-executiva-logo.png',
  },
  {
    type: 'apresentacao',
    name: 'Apresentação para Reunião de Resultados',
    description: 'Crie apresentações de resultados profissionais',
    icon: '/images/apresentacao-resultados-logo.png',
  },
  {
    type: 'conversas_dificeis',
    name: 'Conversas Dificeis',
    description: 'Prepare conversas sensiveis com clareza, empatia e direção',
    icon: '/images/conversas-dificeis-logo.jpeg',
  },
  {
    type: 'postagem',
    name: 'Postagem no Linkedin',
    description: 'Crie posts profissionais para LinkedIn com apoio da IA',
    icon: '/images/postagem-linkedin-logo.jpeg',
  },
] as const;

export type AgentType = (typeof AGENTS)[number]['type'];

export function getAgentByType(type: string) {
  return AGENTS.find((agent) => agent.type === type) || null;
}

export function getAgentLabel(type: string) {
  return getAgentByType(type)?.name || type;
}
