import type { TopicDefinition } from './types';

export const TAXONOMY_VERSION = '2026-10-14.v1';
export const INSIGHT_TOPICS: TopicDefinition[] = [
  { id: 'comunicacao_clara', label: 'Comunicação clara', description: 'Clareza, concisão e adequação da mensagem ao público.' },
  { id: 'feedback', label: 'Feedback', description: 'Preparação de feedback de desempenho e desenvolvimento.' },
  { id: 'conflitos', label: 'Conflitos e conversas sensíveis', description: 'Negociação, limites e resolução de conflitos.' },
  { id: 'resultados', label: 'Apresentação de resultados', description: 'Indicadores, reuniões de resultados e explicação de desvios.' },
  { id: 'narrativa_executiva', label: 'Narrativa executiva', description: 'Estrutura, argumentação e histórias para decisões.' },
  { id: 'posicionamento_linkedin', label: 'Posicionamento no LinkedIn', description: 'Conteúdo profissional, autoridade e posicionamento.' },
  { id: 'lideranca', label: 'Liderança e equipe', description: 'Alinhamento, delegação e comunicação com equipes.' },
  { id: 'outros', label: 'Outros temas', description: 'Demandas sem correspondência nas categorias atuais.' },
];
