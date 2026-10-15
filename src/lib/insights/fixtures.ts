import { AGENTS } from '../agents';
import { saoPauloDate } from './filters';
import type { Classification, SourceMessage } from './types';

export interface DemoMessage extends SourceMessage {
  status: 'classified' | 'pending' | 'failed';
  classification?: Classification;
}

const seeds = [
  { topics: ['comunicacao_clara', 'lideranca'], demand: 'Preparar um alinhamento claro de prioridades com a equipe.' },
  { topics: ['resultados', 'narrativa_executiva'], demand: 'Apresentar indicadores e explicar desvios em uma reunião de resultados.' },
  { topics: ['feedback', 'conflitos'], demand: 'Conduzir um feedback respeitoso sobre entregas e expectativas.' },
  { topics: ['posicionamento_linkedin'], demand: 'Escrever um post profissional sobre aprendizados de liderança.' },
];

/** Entirely invented fixtures: no database reads and no copies of audited volumes. */
export function createDemoFixtures(now: Date = new Date()): DemoMessage[] {
  const anchor = new Date(`${saoPauloDate(now)}T00:00:00-03:00`).getTime();
  const rows: DemoMessage[] = [];
  for (let age = 0; age < 180; age++) {
    AGENTS.forEach((agent, agentIndex) => {
      const seed = seeds[agentIndex];
      const userId = `synthetic-person-${(age + agentIndex * 3) % 19}`;
      const chatId = `synthetic-chat-${age}-${agentIndex}`;
      const createdAt = new Date(Math.min(anchor - age * 86400000 + 12 * 3600000 + agentIndex * 60000, now.getTime() - 1000)).toISOString();
      const index = age * 4 + agentIndex;
      const status = index % 17 === 0 ? 'failed' : index % 9 === 0 ? 'pending' : 'classified';
      rows.push({ id: index * 2 + 1, userId, chatId, agentType: agent.type, userLevel: 'user',
        input: seed.demand, createdAt, status,
        ...(status === 'classified' ? { classification: {
          kind: age % 5 === 0 ? 'question' : 'initial_request', topicIds: seed.topics,
          normalizedDemand: seed.demand, confidence: 0.93, needsReview: false,
        } as Classification } : {}),
      });
      if (age % 3 === 0) {
        const kinds = ['refinement', 'context', 'confirmation', 'unclassifiable'] as const;
        const kind = kinds[Math.floor(age / 3) % kinds.length];
        rows.push({ id: index * 2 + 2, userId, chatId, agentType: agent.type, userLevel: 'user',
          input: 'Complemento fictício ao pedido anterior.', createdAt, status: 'classified', classification: {
            kind, topicIds: kind === 'unclassifiable' ? [] : seed.topics,
            normalizedDemand: kind === 'unclassifiable' ? 'Conteúdo sem demanda identificável.' : 'Ajustar o pedido anterior ao público e ao tom desejados.',
            confidence: kind === 'unclassifiable' ? 0.4 : 0.85, needsReview: kind === 'unclassifiable',
          },
        });
      }
    });
    if (age % 10 === 0) rows.push({
      id: 10000 + age, userId: 'synthetic-admin', chatId: `synthetic-admin-chat-${age}`,
      agentType: 'comunicacao', userLevel: 'admin', input: 'Conteúdo administrativo fictício que deve ser excluído.',
      createdAt: new Date(Math.min(anchor - age * 86400000 + 3600000, now.getTime() - 1000)).toISOString(),
      status: 'classified', classification: { kind: 'initial_request', topicIds: ['outros'], normalizedDemand: 'EXCLUIR ADMIN', confidence: 1, needsReview: false },
    });
  }
  return rows;
}
