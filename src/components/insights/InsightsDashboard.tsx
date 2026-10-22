'use client';

import { useEffect, useRef, useState } from 'react';
import { AGENTS, getAgentLabel } from '@/lib/agents';
import type { InsightAgentFilter, InsightPeriod, InsightReport, MessageKind } from '@/lib/insights/types';
import { EXPORT_CONTENT_TYPES, exportFileName, type ExportFormat, type ExportKind } from '@/lib/insights/export-files';

class ExportFailure extends Error {}

const number = (value: number) => value.toLocaleString('pt-BR');
const date = (value: string) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00-03:00` : value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const kindLabels: Record<MessageKind, string> = {
  initial_request: 'Pedido inicial', question: 'Pergunta', context: 'Contexto',
  refinement: 'Refinamento', confirmation: 'Confirmação', unclassifiable: 'Sem classificação',
};
const control = 'rounded-md border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400';

type ReportState = 'loading' | 'ready' | 'disabled' | 'denied' | 'error';

export default function InsightsDashboard() {
  const [days, setDays] = useState<InsightPeriod>(30);
  const [agentType, setAgentType] = useState<InsightAgentFilter>('all');
  const [topicId, setTopicId] = useState('');
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<ReportState>('loading');
  const [report, setReport] = useState<InsightReport | null>(null);
  const [knownMode, setKnownMode] = useState<InsightReport['mode'] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [prepared, setPrepared] = useState<{ url: string; name: string } | null>(null);
  const exportRequest = useRef<AbortController | null>(null);

  useEffect(() => () => exportRequest.current?.abort(), []);

  useEffect(() => {
    const controller = new AbortController();
    exportRequest.current?.abort();
    setExporting(false);
    setExportError('');
    setState('loading');
    setReport(null);
    const query = new URLSearchParams({ days: String(days), agentType });
    if (topicId) query.set('topicId', topicId);
    async function load() {
      try {
        const response = await fetch(`/api/insights/report?${query}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (controller.signal.aborted) return;
        if (response.status === 401 || response.status === 403) { setState('denied'); return; }
        if (response.status === 503) { setState('disabled'); return; }
        if (!response.ok) throw new Error('report_unavailable');
        const data: InsightReport = await response.json();
        if (controller.signal.aborted) return;
        if (data.processing.state === 'disabled') { setState('disabled'); return; }
        setReport(data);
        setKnownMode(data.mode);
        setState('ready');
      } catch {
        if (!controller.signal.aborted) setState('error');
      }
    }
    void load();
    return () => controller.abort();
  }, [days, agentType, topicId, retry]);

  // A prepared file stays available as a real link until the filters change. The
  // automatic click happens after an async fetch, outside the user's gesture: Chrome
  // allows the first such download per page but silently holds later ones behind its
  // "multiple downloads" permission (the JSON-after-CSV case of 19/10). Clicking the
  // link is a fresh gesture and always works.
  // The blob URL lives in a ref so it is revoked outside any setState callback:
  // when a new file replaces it, when filters change and on unmount.
  const preparedUrl = useRef<string | null>(null);
  const releasePrepared = () => {
    if (preparedUrl.current) URL.revokeObjectURL(preparedUrl.current);
    preparedUrl.current = null;
    setPrepared(null);
  };
  useEffect(() => releasePrepared, [days, agentType, topicId]);
  useEffect(() => () => { if (preparedUrl.current) URL.revokeObjectURL(preparedUrl.current); preparedUrl.current = null; }, []);

  async function download(kind: ExportKind, format: ExportFormat) {
    exportRequest.current?.abort();
    const controller = new AbortController();
    exportRequest.current = controller;
    setExporting(true);
    setExportError('');
    releasePrepared();
    const query = new URLSearchParams({ days: String(days), agentType, format });
    if (topicId) query.set('topicId', topicId);
    try {
      const endpoint = kind === 'perguntas' ? '/api/insights/questions-export' : '/api/insights/export';
      const response = await fetch(`${endpoint}?${query}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      if (!response.ok) {
        const message = await response.json().then(body => typeof body?.error === 'string' ? body.error : '', () => '');
        throw new ExportFailure(message);
      }
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const name = exportFileName({ kind, mode: report?.mode ?? 'live', days, agentType, ...(topicId ? { topicId } : {}), format });
      if (preparedUrl.current) URL.revokeObjectURL(preparedUrl.current);
      const url = URL.createObjectURL(new Blob([blob], { type: blob.type || EXPORT_CONTENT_TYPES[format] }));
      preparedUrl.current = url;
      setPrepared({ url, name });
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      if (!controller.signal.aborted) setExportError(error instanceof ExportFailure && error.message ? error.message : 'A exportação não foi concluída. Tente novamente.');
    } finally {
      if (!controller.signal.aborted) setExporting(false);
    }
  }

  const topics = report?.topics.slice().sort((a, b) => b.distinctUsers - a.distinctUsers || b.messages - a.messages) ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-4 py-6 sm:px-8 sm:py-9">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">Leitura de demandas · administração</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">O que as pessoas estão pedindo?</h1>
          <p className="mt-3 text-sm leading-6 text-gray-400">Uma visão das quatro IAs, com temas, pessoas e conversas. Mensagens de contas administrativas são excluídas da análise e dos exemplos.</p>
        </div>
        <span className="rounded-full border border-gray-700 px-3 py-1.5 text-xs text-gray-400">Acesso exclusivo · admins</span>
      </div>

      {knownMode === 'demo' && (
        <div role="note" className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orange-400/40 bg-gray-950 px-4 py-3 shadow-lg">
          <strong className="text-sm text-orange-300">Demonstração · dados simulados</strong>
          <span className="text-xs text-gray-300">Sem classificação real, chamadas pagas ou atualização agendada.</span>
        </div>
      )}

      <div className="grid grid-cols-1 items-end gap-4 border-y border-gray-800 py-5 sm:grid-cols-2 xl:flex xl:flex-wrap">
        <label className="flex min-w-0 flex-col gap-2 text-xs text-gray-400">Período
          <select value={days} onChange={event => { setDays(event.target.value === 'all' ? 'all' : Number(event.target.value)); setTopicId(''); }} className={`${control} w-full xl:w-auto`}>
            <option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option>
            <option value="all">Todo o histórico</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-xs text-gray-400">Agente de IA
          <select value={agentType} onChange={event => { setAgentType(event.target.value as InsightAgentFilter); setTopicId(''); }} className={`${control} w-full xl:w-80`}>
            <option value="all">Todas as quatro IAs</option>{AGENTS.map(agent => <option key={agent.type} value={agent.type}>{agent.name}</option>)}
          </select>
        </label>
        <div className="flex gap-2 sm:col-span-2 xl:ml-auto">
          <button onClick={() => void download('insights', 'csv')} disabled={state !== 'ready' || exporting} className={`${control} flex-1 hover:border-orange-400 disabled:cursor-not-allowed disabled:opacity-40 xl:flex-none`}>{exporting ? 'Exportando…' : 'Exportar CSV'}</button>
          <button onClick={() => void download('insights', 'json')} disabled={state !== 'ready' || exporting} className={`${control} flex-1 hover:border-orange-400 disabled:cursor-not-allowed disabled:opacity-40 xl:flex-none`}>JSON</button>
        </div>
        {report?.mode === 'live' && <div className="flex flex-wrap items-center gap-2 sm:col-span-2 xl:basis-full xl:justify-end">
          <span className="text-xs text-gray-400">Perguntas completas dos alunos (sem nome, e-mail ou telefone):</span>
          <button onClick={() => void download('perguntas', 'csv')} disabled={state !== 'ready' || exporting} className={`${control} hover:border-orange-400 disabled:cursor-not-allowed disabled:opacity-40`}>Perguntas CSV</button>
          <button onClick={() => void download('perguntas', 'json')} disabled={state !== 'ready' || exporting} className={`${control} hover:border-orange-400 disabled:cursor-not-allowed disabled:opacity-40`}>Perguntas JSON</button>
        </div>}
      </div>
      {exportError && <p role="alert" className="text-sm text-red-300">{exportError}</p>}
      {prepared && <p role="status" className="text-sm text-gray-300">Arquivo pronto: <a href={prepared.url} download={prepared.name} className="text-orange-300 underline hover:text-orange-200">baixar {prepared.name}</a>. Se o download não começou automaticamente, clique no link.</p>}

      {state !== 'ready' && <StatePanel state={state} retry={() => setRetry(value => value + 1)} />}

      {state === 'ready' && report && <>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-gray-400">
          <span>{date(report.window.start)} — {date(report.window.end)} · horário de Brasília</span>
          <span>{report.mode === 'demo' ? 'Relatório demonstrativo' : 'Relatório gerado'} em {date(report.generatedAt)}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Metric label="Mensagens elegíveis" value={number(report.summary.eligibleMessages)} note="Volume após excluir contas admin" />
          <Metric label="Pessoas distintas" value={number(report.summary.distinctUsers)} note="Cada pessoa contada uma vez" />
          <Metric label="Conversas distintas" value={number(report.summary.distinctChats)} note="Chats ativos no período" />
          <Metric label="Cobertura de classificação" value={`${number(report.summary.coveragePercent)}%`} note={`${number(report.summary.classifiedMessages)} de ${number(report.summary.eligibleMessages)} mensagens`} />
        </div>
        {topicId && <p className="text-xs leading-5 text-gray-400">As métricas gerais e a cobertura consideram o período e o agente selecionados. O filtro de tema restringe os exemplos e os temas exibidos.</p>}

        {report.summary.eligibleMessages === 0 ? <div className="rounded-lg border border-dashed border-gray-700 px-6 py-12 text-center"><h2 className="font-semibold">Nenhuma mensagem elegível neste recorte</h2><p className="mt-2 text-sm text-gray-400">Experimente outro período ou selecione todas as IAs.</p></div> : <>
          <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            <section className="min-w-0 rounded-lg border border-gray-800 bg-gray-900/50 p-5 sm:p-6" aria-labelledby="topics-heading">
              <p className="text-xs uppercase tracking-widest text-orange-300">01 / Temas recorrentes</p>
              <h2 id="topics-heading" className="mt-2 text-xl font-semibold">Mais pessoas, mais recorrência</h2>
              <p className="mt-2 text-xs leading-5 text-gray-400">Ordenado por pessoas distintas. Uma mensagem pode conter mais de um tema; os totais dos temas não são somáveis.</p>
              {topics.length === 0 ? <p className="py-8 text-sm text-gray-400">Ainda não há temas classificados para este recorte.</p> : <ol className="mt-5 divide-y divide-gray-800">
                {topics.map((topic, index) => <li key={topic.id} className="py-4">
                  <div className="flex items-start gap-3">
                    <span className="pt-1 font-mono text-xs text-gray-500">{String(index + 1).padStart(2, '0')}</span>
                    <div className="min-w-0 flex-1"><button onClick={() => setTopicId(topic.id)} className="text-left text-sm font-medium hover:text-orange-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400">{topic.label}<span className="sr-only">: consultar exemplos</span></button><p className="mt-1 text-xs leading-5 text-gray-400">{topic.description}</p></div>
                    <div className="shrink-0 text-right"><span className="text-xl font-semibold tabular-nums text-orange-300">{number(topic.distinctUsers)}</span><p className="text-[11px] text-gray-400">pessoas</p></div>
                  </div>
                  <div className="ml-7 mt-3 h-1 overflow-hidden rounded bg-gray-800" aria-hidden="true"><div className="h-full bg-orange-500" style={{ width: `${Math.max(2, (topic.distinctUsers / Math.max(1, topics[0].distinctUsers)) * 100)}%` }} /></div>
                  <p className="ml-7 mt-2 text-xs text-gray-500">{number(topic.messages)} mensagens · {number(topic.distinctChats)} conversas · {number(topic.sharePercent)}% do volume classificado</p>
                </li>)}
              </ol>}
            </section>
            <div className="space-y-6">
              <TrendChart report={report} />
              <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-5 sm:p-6" aria-labelledby="agents-heading">
                <h2 id="agents-heading" className="text-lg font-semibold">Por agente</h2>
                <p className="mt-1 text-xs text-gray-400">Volume de mensagens elegíveis</p>
                <div className="mt-4 space-y-4">{report.agents.map(agent => <div key={agent.agentType} className="flex items-start justify-between gap-3 text-sm"><div className="min-w-0"><p>{getAgentLabel(agent.agentType)}</p><p className="mt-1 text-xs text-gray-500">{number(agent.distinctUsers)} pessoas · {number(agent.distinctChats)} conversas</p></div><span className="font-mono tabular-nums text-orange-300">{number(agent.messages)}</span></div>)}</div>
              </section>
            </div>
          </div>

          <section className="rounded-lg border border-gray-800 p-5 sm:p-6" aria-labelledby="examples-heading">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs uppercase tracking-widest text-orange-300">02 / Exemplos de demandas</p><h2 id="examples-heading" className="mt-2 text-xl font-semibold">Do tema ao pedido</h2><p className="mt-2 text-xs leading-5 text-gray-400">Resumos mínimos, sem nomes, contatos ou transcrição integral. {report.mode === 'demo' && 'Todos os exemplos abaixo são fictícios.'}</p></div>
              {topicId && <button onClick={() => setTopicId('')} className={control}>Limpar filtro de tema</button>}
            </div>
            {topicId && <p className="mt-4 text-sm text-orange-300">Tema: {report.topics.find(topic => topic.id === topicId)?.label ?? topicId}</p>}
            <div className="mt-5 grid gap-3 md:grid-cols-2">{report.examples.map(example => <article key={example.id} className="rounded-md border border-gray-800 bg-gray-900/50 p-4"><div className="flex flex-wrap justify-between gap-2 text-[11px] text-gray-400"><span>{getAgentLabel(example.agentType)}</span><span>{kindLabels[example.kind]}</span></div><p className="mt-3 text-sm leading-6 text-gray-200">{example.demand}</p><p className="mt-3 text-xs text-gray-500">{date(example.createdAt)}{report.mode === 'live' ? ` · pergunta #${example.questionId}` : ''} · {example.needsReview ? 'Requer revisão humana' : `Confiança: ${Math.round(example.confidence * 100)}%`}</p></article>)}</div>
            {report.examples.length === 0 && <p className="mt-5 text-sm text-gray-400">Nenhum exemplo disponível para este filtro.</p>}
          </section>
        </>}
        <section className="border-t border-gray-800 pt-5 text-xs leading-6 text-gray-400" aria-labelledby="processing-heading">
          <h2 id="processing-heading" className="font-semibold text-gray-200">Como interpretar esta leitura</h2>
          <p>Mensagens incluem pedidos iniciais, perguntas, contexto, refinamentos e confirmações. Volume de mensagens não representa uma contagem de demandas únicas.</p>
          <p>{number(report.summary.pendingMessages)} pendentes · {number(report.summary.failedMessages)} falhas · {number(report.summary.excludedAdminMessages)} mensagens administrativas excluídas{report.mode === 'demo' ? ' (contagens simuladas)' : ''}.</p>
          <p className="mt-2">Atualização: {report.processing.scheduleLabel}. {report.processing.lastProcessedAt ? `Último processamento${report.mode === 'demo' ? ' simulado' : ''}: ${date(report.processing.lastProcessedAt)}.` : 'Nenhum processamento real registrado.'}</p>
        </section>
      </>}
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4 sm:p-5"><p className="text-xs leading-5 text-gray-400">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">{value}</p><p className="mt-3 text-[11px] leading-5 text-gray-500">{note}</p></div>;
}

function StatePanel({ state, retry }: { state: ReportState; retry: () => void }) {
  const messages = {
    loading: ['Carregando a leitura…', 'Consultando o período e os agentes selecionados.'],
    disabled: ['Insights ainda não ativados', 'O classificador e o executor diário aguardam configuração e aprovação. Nenhum dado real está sendo classificado.'],
    denied: ['Acesso não autorizado', 'Sua sessão não tem permissão administrativa para consultar este relatório.'],
    error: ['Não foi possível carregar o relatório', 'Tente novamente para consultar este recorte.'],
    ready: ['', ''],
  };
  return <div role={state === 'error' || state === 'denied' ? 'alert' : 'status'} className="rounded-lg border border-gray-800 bg-gray-900/50 px-6 py-12"><div className="mb-5 h-1 w-12 bg-orange-500" /><h2 className="text-xl font-semibold">{messages[state][0]}</h2><p className="mt-3 max-w-xl text-sm leading-6 text-gray-400">{messages[state][1]}</p>{state === 'error' && <button onClick={retry} className={`${control} mt-5`}>Tentar novamente</button>}</div>;
}

function TrendChart({ report }: { report: InsightReport }) {
  const maximum = Math.max(1, ...report.trend.map(point => point.messages));
  const points = report.trend.map((point, index) => `${20 + (index / Math.max(1, report.trend.length - 1)) * 460},${135 - (point.messages / maximum) * 110}`).join(' ');
  return <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-5 sm:p-6" aria-labelledby="trend-heading">
    <h2 id="trend-heading" className="text-lg font-semibold">Mensagens ao longo do tempo</h2>
    <p className="mt-1 text-xs text-gray-400">Volume diário, sem deduplicação de demandas</p>
    {report.trend.length > 0 ? <>
      <svg viewBox="0 0 500 160" className="mt-5 w-full" role="img" aria-labelledby="trend-title trend-description"><title id="trend-title">Volume diário de mensagens elegíveis</title><desc id="trend-description">Dados exatos disponíveis na tabela abaixo do gráfico. O maior volume diário é {number(maximum)} mensagens.</desc><path d="M20 25H480M20 80H480M20 135H480" stroke="#283341" strokeDasharray="3 5" /><polyline points={points} fill="none" stroke="#FF6B00" strokeWidth="2.5" strokeLinejoin="round" />{report.trend.length === 1 && <circle cx="20" cy={135 - (report.trend[0].messages / maximum) * 110} r="4" fill="#FF6B00" />}</svg>
      <div className="flex justify-between text-[11px] text-gray-500"><span>{date(report.trend[0].date)}</span><span>{date(report.trend[report.trend.length - 1].date)}</span></div>
      <details className="mt-4 text-xs text-gray-400"><summary className="cursor-pointer rounded py-1 hover:text-orange-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400">Consultar dados do gráfico</summary><div className="mt-3 max-h-60 overflow-auto"><table className="w-full text-left tabular-nums"><caption className="sr-only">Mensagens por dia, elegíveis e classificadas</caption><thead className="text-gray-300"><tr><th scope="col" className="py-2">Dia</th><th scope="col">Elegíveis</th><th scope="col">Classificadas</th></tr></thead><tbody>{report.trend.map(point => <tr key={point.date} className="border-t border-gray-800"><th scope="row" className="py-2 font-normal">{date(point.date)}</th><td>{number(point.messages)}</td><td>{number(point.classifiedMessages)}</td></tr>)}</tbody></table></div></details>
    </> : <p className="mt-5 text-sm text-gray-400">Nenhum dado diário disponível.</p>}
  </section>;
}
