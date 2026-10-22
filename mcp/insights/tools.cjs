'use strict';

const { z } = require('zod');
const { loadDemoReportModules } = require('./report-loader.cjs');
const demo = loadDemoReportModules();
const VERSION = '0.1.0';
const DAY = 86400000;
const agents = z.enum(['all', ...demo.AGENTS.map(agent => agent.type)]);
const topicId = z.enum(demo.INSIGHT_TOPICS.map(topic => topic.id));
const days = z.union([z.literal(7), z.literal(30), z.literal(90)]);
const filterShape = { days: days.default(30), agentType: agents.default('all'), topicId: topicId.optional() };
const filtersSchema = z.object({ days, agentType: agents, topicId: topicId.optional() }).strict();
const windowSchema = z.object({ start: z.string(), end: z.string(), timezone: z.literal('America/Sao_Paulo') }).strict();
const summarySchema = z.object({
  eligibleMessages: z.number().int().nonnegative(), classifiedMessages: z.number().int().nonnegative(),
  pendingMessages: z.number().int().nonnegative(), failedMessages: z.number().int().nonnegative(),
  excludedAdminMessages: z.number().int().nonnegative(), distinctUsers: z.number().int().nonnegative(),
  distinctChats: z.number().int().nonnegative(), coveragePercent: z.number().min(0).max(100),
}).strict();
const topicSchema = z.object({ id: topicId, label: z.string(), description: z.string(), messages: z.number().int(),
  distinctUsers: z.number().int(), distinctChats: z.number().int(), sharePercent: z.number(), trendPercent: z.number().nullable() }).strict();
const trendSchema = z.object({ date: z.string(), messages: z.number().int(), classifiedMessages: z.number().int() }).strict();
const exampleSchema = z.object({ id: z.string(), topicId, agentType: z.enum(demo.AGENTS.map(agent => agent.type)), demand: z.string(),
  kind: z.enum(['initial_request', 'question', 'context', 'refinement', 'confirmation', 'unclassifiable']),
  confidence: z.number(), needsReview: z.boolean(), createdAt: z.string() }).strict();
const agentSchema = z.object({ agentType: z.enum(demo.AGENTS.map(agent => agent.type)), messages: z.number().int(),
  distinctUsers: z.number().int(), distinctChats: z.number().int() }).strict();
const metadataShape = {
  mode: z.literal('demo'), generatedAt: z.string(), window: windowSchema, filters: filtersSchema,
  dataNotice: z.string(), countsNotice: z.string(), taxonomyVersion: z.string(),
};
const output = shape => z.object({ ...metadataShape, ...shape }).strict();
const snapshotSchema = z.object({ mode: z.literal('demo'), generatedAt: z.string(), window: windowSchema,
  summary: summarySchema, topics: z.array(topicSchema) }).strict();
const changeSchema = z.object({ id: topicId, label: z.string(), currentMessages: z.number().int(), previousMessages: z.number().int(),
  messageDelta: z.number().int(), messagePercent: z.number().nullable(), currentDistinctUsers: z.number().int(), previousDistinctUsers: z.number().int(), distinctUsersDelta: z.number().int() }).strict();
const annotations = Object.freeze({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
const countsNotice = 'Contagens representam mensagens classificadas, incluindo refinamentos e contexto, não demandas únicas. Uma mensagem pode ter vários temas; percentuais por tema não somam necessariamente 100%. Cobertura se refere ao período/agente inteiro, inclusive com filtro de tema.';

function metadata(report) {
  return { mode: 'demo', generatedAt: report.generatedAt, window: report.window, filters: report.filters,
    dataNotice: 'Dados inteiramente simulados. Sem consulta ao banco, classificação paga ou atualização diária real.', countsNotice, taxonomyVersion: demo.TAXONOMY_VERSION };
}

function registerDemoTools(server, { now = () => new Date() } = {}) {
  function getReport(input) {
    const clock = now();
    if (!(clock instanceof Date) || !Number.isFinite(clock.getTime())) throw new Error('Relógio demo inválido.');
    const filters = { days: input.days, agentType: input.agentType, ...(input.topicId ? { topicId: input.topicId } : {}) };
    const fixtures = demo.createDemoFixtures(clock);
    return { report: demo.buildDemoReport(filters, clock, fixtures), filters, fixtures, clock };
  }
  function register(name, description, inputSchema, outputSchema, action) {
    server.registerTool(name, { description, inputSchema, outputSchema, annotations }, async input => {
      try {
        const payload = outputSchema.parse(action(input));
        return { content: [{ type: 'text', text: JSON.stringify(payload) }], structuredContent: payload };
      } catch {
        // Do not return paths, environment values, stack traces or dependency errors.
        const payload = { mode: 'demo', error: { code: 'demo_tool_failed', message: 'Não foi possível gerar este relatório simulado.' } };
        return { isError: true, content: [{ type: 'text', text: JSON.stringify(payload) }], structuredContent: payload };
      }
    });
  }
  register('get_insight_summary', 'Consulte volume e cobertura de classificação simulados, pessoas e conversas distintas. Contagens são mensagens, não demandas únicas. O filtro de tema não reduz o denominador da cobertura.',
    z.object(filterShape).strict(), output({ summary: summarySchema, agents: z.array(agentSchema) }), input => {
      const { report } = getReport(input);
      return { ...metadata(report), summary: report.summary, agents: report.agents };
    });
  register('list_demand_topics', 'Liste temas simulados ordenados por pessoas distintas, depois mensagens. Classificação multirrótulo permite que a mesma mensagem conte em mais de um tema; não somar como demandas únicas.',
    z.object(filterShape).strict(), output({ topics: z.array(topicSchema) }), input => {
      const { report } = getReport(input);
      return { ...metadata(report), topics: [...report.topics].sort((a, b) => b.distinctUsers - a.distinctUsers || b.messages - a.messages || a.id.localeCompare(b.id)) };
    });
  register('get_topic_trend', 'Consulte série diária de mensagens de um tema simulado na timezone America/Sao_Paulo. Mensagens pendentes não têm tema conhecido; os pontos não equivalem a demandas únicas.',
    z.object({ ...filterShape, topicId }).strict(), output({ trend: z.array(trendSchema), topic: topicSchema }), input => {
      const { report } = getReport(input);
      return { ...metadata(report), trend: report.trend, topic: report.topics[0] };
    });
  register('get_topic_examples', 'Consulte até 12 exemplos sintéticos normalizados, sem texto bruto, identificadores de usuários ou conversas. Use topicId para selecionar um tema da taxonomia.',
    z.object({ ...filterShape, limit: z.number().int().min(1).max(12).default(5) }).strict(), output({ examples: z.array(exampleSchema) }), input => {
      const { report } = getReport(input);
      return { ...metadata(report), examples: report.examples.slice(0, input.limit).map(({ questionId: _questionId, ...example }) => example) };
    });
  register('compare_insight_periods', 'Compare o período simulado selecionado com o período anterior de igual duração. Ambos usam o mesmo conjunto sintético e relógio capturado; variação percentual é null quando a base anterior é zero. Mensagens por tema são multirrótulo, não demandas únicas.',
    z.object(filterShape).strict(), output({ current: snapshotSchema, previous: snapshotSchema, changes: z.array(changeSchema) }), input => {
      const { report, filters, fixtures, clock } = getReport(input);
      const previous = demo.buildDemoReport(filters, new Date(clock.getTime() - input.days * DAY), fixtures);
      // The previous clock selects its window; both snapshots are generated in this operation.
      const snapshot = item => ({ mode: 'demo', generatedAt: report.generatedAt, window: item.window, summary: item.summary, topics: item.topics });
      const changes = report.topics.map(topic => {
        const prior = previous.topics.find(item => item.id === topic.id);
        return { id: topic.id, label: topic.label, currentMessages: topic.messages, previousMessages: prior.messages,
          messageDelta: topic.messages - prior.messages, messagePercent: prior.messages ? Math.round((topic.messages - prior.messages) / prior.messages * 1000) / 10 : null,
          currentDistinctUsers: topic.distinctUsers, previousDistinctUsers: prior.distinctUsers, distinctUsersDelta: topic.distinctUsers - prior.distinctUsers };
      });
      return { ...metadata(report), current: snapshot(report), previous: snapshot(previous), changes };
    });
}

module.exports = { VERSION, registerDemoTools };
