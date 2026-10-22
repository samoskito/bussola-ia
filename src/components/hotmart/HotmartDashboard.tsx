'use client';

import { useCallback, useEffect, useState } from 'react';
import { AGENTS, getAgentLabel, type AgentType } from '@/lib/agents';

type Offer = {
  id: string; productUcode: string; productName: string | null; offerCode: string; offerName: string | null; isSubscription: boolean;
  planName: string | null; priceValue: number | null; priceCurrency: string | null; source: 'api' | 'webhook'; syncedAt: string | null;
  agentTypes: AgentType[]; accessKind: 'single' | 'subscription' | null; durationDays: number | null; graceDays: number | null;
};
type EventRow = {
  id: string; eventType: string; eventCreatedAt: string; receivedAt: string; mode: 'shadow' | 'live'; status: string; transaction: string | null;
  productName: string | null; offerCode: string | null; buyerEmail: string | null; errorCode: string | null; attempts: number;
  plan: { summary?: string; action?: string; access?: { agentType: AgentType; enabled: boolean; expiresAt: string | null }[]; reviews?: { kind: string }[]; createUser?: unknown; invite?: boolean; convertToPersonal?: boolean } | null;
  result: Record<string, unknown> | null;
};
type Review = { id: string; kind: string; status: string; userEmail: string | null; eventType: string | null; details: Record<string, unknown>; proposal: Record<string, unknown> | null; createdAt: string };
type Summary = { mode: 'off' | 'shadow' | 'live'; environment: string; credentials: boolean; hottok: boolean; summary: { offers: number; unconfiguredOffers: number; openReviews: number; events: Record<string, number> | null; lastEventAt: string | null } };

const button = 'rounded-lg border border-gray-700 px-3 py-2 text-sm transition hover:border-orange-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400 disabled:cursor-not-allowed disabled:opacity-40';
const primary = `${button} border-orange-500 bg-orange-500 font-semibold text-gray-950 hover:bg-orange-400`;
const field = 'w-full rounded-lg border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-white outline-none focus:border-orange-400';
const modeLabel = { off: 'Desligado', shadow: 'Sombra (só registra o plano)', live: 'Ativo (aplica)' };
const statusLabel: Record<string, string> = { received: 'Recebido', processing: 'Processando', shadow_planned: 'Planejado (sombra)', applied: 'Aplicado', review: 'Em revisão', ignored: 'Ignorado', failed: 'Falhou' };
const reviewLabel: Record<string, string> = {
  unmapped_offer: 'Oferta não configurada', manual_access_kept: 'Acesso manual preservado', profile_divergence: 'Cadastro divergente',
  revocation_without_ledger: 'Redução sem compra registrada', stale_event: 'Evento fora de ordem', grant_after_revocation: 'Liberação após reembolso',
  switch_plan: 'Troca de plano', single_canceled: 'Cancelamento de compra única', identity_mismatch: 'Compra de outro usuário',
  admin_buyer: 'Comprador administrador', invalid_buyer: 'Comprador inválido', invite_failed: 'Falha no convite',
};
const when = (value: string | null) => value ? new Date(value).toLocaleString('pt-BR') : '—';
const day = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'sem prazo';

async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/admin/hotmart${path}`, { method, cache: 'no-store', ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(response.status === 401 ? 'Sua sessão expirou. Entre novamente.' : response.status === 403 ? 'Acesso exclusivo para administradores.' : data.error || 'Operação indisponível.');
  return data as T;
}

function OfferEditor({ offer, onSaved }: { offer: Offer; onSaved: (message: string) => void }) {
  const [agents, setAgents] = useState<AgentType[]>(offer.agentTypes);
  const [kind, setKind] = useState<'' | 'single' | 'subscription'>(offer.accessKind ?? (offer.isSubscription ? 'subscription' : ''));
  const [days, setDays] = useState(offer.durationDays?.toString() ?? (offer.isSubscription ? '' : '365'));
  const [grace, setGrace] = useState(offer.graceDays?.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    setBusy(true); setError('');
    try {
      await api(`/offers/${offer.id}`, 'PUT', { agentTypes: kind ? agents : [], accessKind: kind || null, durationDays: days ? Number(days) : null, graceDays: grace ? Number(grace) : null });
      onSaved(`Oferta ${offer.offerName ?? offer.offerCode} salva.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao salvar.'); }
    finally { setBusy(false); }
  }
  return <div className="mt-3 grid gap-3 border-t border-gray-800 pt-3 text-sm md:grid-cols-[1fr_auto]">
    <div className="space-y-3">
      <fieldset className="flex flex-wrap gap-3"><legend className="mb-1 text-xs uppercase tracking-wider text-gray-500">IAs liberadas</legend>
        {AGENTS.map(agent => <label key={agent.type} className="flex items-center gap-2"><input type="checkbox" checked={agents.includes(agent.type)} onChange={e => setAgents(list => e.target.checked ? [...list, agent.type] : list.filter(item => item !== agent.type))} className="accent-orange-500" />{agent.name}</label>)}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-gray-400">Tipo<select value={kind} onChange={e => setKind(e.target.value as typeof kind)} className={`${field} mt-1`}><option value="">Não configurada</option><option value="single">Compra única (N dias)</option><option value="subscription">Assinatura (enquanto paga)</option></select></label>
        <label className="text-xs text-gray-400">{kind === 'subscription' ? 'Dias se faltar próxima cobrança' : 'Validade em dias'}<input inputMode="numeric" value={days} onChange={e => setDays(e.target.value.replace(/\D/g, ''))} className={`${field} mt-1`} placeholder={kind === 'subscription' ? '31' : '365'} /></label>
        <label className="text-xs text-gray-400">Tolerância de atraso (dias)<input inputMode="numeric" value={grace} onChange={e => setGrace(e.target.value.replace(/\D/g, ''))} className={`${field} mt-1`} placeholder="padrão do servidor (3)" /></label>
      </div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </div>
    <div className="flex items-end"><button type="button" className={primary} disabled={busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar mapeamento'}</button></div>
  </div>;
}

export default function HotmartDashboard() {
  const [tab, setTab] = useState<'offers' | 'events' | 'reviews'>('offers');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [eventStatus, setEventStatus] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError('');
    try {
      const [s, o, e, r] = await Promise.all([
        api<Summary>('?resource=summary'), api<{ offers: Offer[] }>('?resource=offers'),
        api<{ events: EventRow[] }>(`?resource=events${eventStatus ? `&status=${eventStatus}` : ''}`), api<{ reviews: Review[] }>('?resource=reviews'),
      ]);
      setSummary(s); setOffers(o.offers); setEvents(e.events); setReviews(r.reviews);
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao carregar.'); }
  }, [eventStatus]);
  useEffect(() => { load(); }, [load]);

  async function run(action: () => Promise<string>) {
    setBusy(true); setError(''); setNotice('');
    try { setNotice(await action()); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha na operação.'); }
    finally { setBusy(false); }
  }
  const sync = () => run(async () => { const r = await api<{ synced: number; environment: string }>('/sync', 'POST', {}); return `${r.synced} oferta(s) sincronizadas (${r.environment}).`; });
  const reprocess = (id: string) => run(async () => { const r = await api<{ status: string }>(`/events/${id}`, 'POST', {}); return `Evento reprocessado: ${statusLabel[r.status] ?? r.status}.`; });
  const resolve = (id: string, decision: 'accept' | 'keep' | 'dismiss') => run(async () => {
    const note = (notes[id] ?? '').trim();
    if (note.length < 3) throw new Error('Informe o motivo da decisão.');
    await api(`/reviews/${id}`, 'POST', { decision, note });
    return decision === 'accept' ? 'Proposta aplicada.' : decision === 'keep' ? 'Acesso atual mantido.' : 'Revisão descartada.';
  });

  const s = summary?.summary;
  return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <section className="grid gap-3 sm:grid-cols-4">
      {[
        ['Webhook', summary ? modeLabel[summary.mode] : '…'],
        ['API', summary ? `${summary.environment} · ${summary.credentials ? 'credenciais ok' : 'sem credenciais'}` : '…'],
        ['Ofertas', s ? `${s.offers} (${s.unconfiguredOffers} sem mapeamento)` : '…'],
        ['Revisões abertas', s ? String(s.openReviews) : '…'],
      ].map(([label, value]) => <div key={label} className="rounded-lg border border-gray-800 bg-gray-900/60 p-3"><p className="text-xs uppercase tracking-wider text-gray-500">{label}</p><p className="mt-1 text-sm text-white">{value}</p></div>)}
    </section>
    {summary && !summary.hottok && summary.mode !== 'off' && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">HOTMART_HOTTOK ausente: o webhook recusará todos os eventos.</p>}
    {notice && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</p>}
    {error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

    <nav className="flex flex-wrap gap-2" aria-label="Seções Hotmart">
      {([['offers', 'Ofertas'], ['events', 'Eventos'], ['reviews', `Revisões${reviews.length ? ` (${reviews.length})` : ''}`]] as const).map(([key, label]) =>
        <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)} className={tab === key ? primary : button}>{label}</button>)}
      <button type="button" className={`${button} ml-auto`} onClick={load} disabled={busy}>Atualizar</button>
    </nav>

    {tab === 'offers' && <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-400">Defina as IAs e a validade de cada oferta. Eventos de ofertas sem mapeamento vão para revisão.</p>
        <button type="button" className={primary} onClick={sync} disabled={busy || !summary?.credentials}>{busy ? 'Sincronizando…' : 'Sincronizar com a Hotmart'}</button>
      </div>
      {offers.length === 0 && <p className="text-sm text-gray-500">Nenhuma oferta ainda. Sincronize ou aguarde o primeiro evento.</p>}
      {offers.map(offer => <article key={offer.id} className="rounded-lg border border-gray-800 bg-gray-900/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-medium text-white">{offer.productName ?? offer.productUcode} · {offer.offerName ?? offer.offerCode}</h3>
            <p className="mt-1 text-xs text-gray-500">Oferta {offer.offerCode}{offer.planName ? ` · plano ${offer.planName}` : ''}{offer.priceValue !== null ? ` · ${offer.priceValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ${offer.priceCurrency ?? ''}` : ''}{offer.source === 'webhook' ? ' · criada por evento' : ''}</p>
            <p className="mt-2 text-sm">{offer.accessKind
              ? <span className="text-emerald-300">{offer.agentTypes.map(getAgentLabel).join(', ')} · {offer.accessKind === 'single' ? `${offer.durationDays} dias` : 'enquanto paga'}{offer.graceDays !== null ? ` · tolerância ${offer.graceDays}d` : ''}</span>
              : <span className="text-orange-300">Não configurada</span>}</p>
          </div>
          <button type="button" className={button} onClick={() => setEditing(editing === offer.id ? null : offer.id)}>{editing === offer.id ? 'Fechar' : 'Configurar'}</button>
        </div>
        {editing === offer.id && <OfferEditor offer={offer} onSaved={message => { setEditing(null); setNotice(message); load(); }} />}
      </article>)}
    </section>}

    {tab === 'events' && <section className="space-y-3">
      <label className="block max-w-xs text-xs text-gray-400">Situação<select value={eventStatus} onChange={e => setEventStatus(e.target.value)} className={`${field} mt-1`}><option value="">Todas</option>{Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      {events.length === 0 && <p className="text-sm text-gray-500">Nenhum evento recebido.</p>}
      {events.map(event => <article key={event.id} className="rounded-lg border border-gray-800 bg-gray-900/40 p-4 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium text-white">{event.eventType} <span className="ml-2 rounded border border-gray-700 px-1.5 py-0.5 text-xs text-gray-300">{event.mode === 'shadow' ? 'sombra' : 'ativo'}</span> <span className="ml-1 text-xs text-orange-300">{statusLabel[event.status] ?? event.status}</span></p>
            <p className="mt-1 text-xs text-gray-500">{when(event.eventCreatedAt)} · {event.buyerEmail ?? 'sem e-mail'} · {event.productName ?? '—'} · oferta {event.offerCode ?? '—'}{event.transaction ? ` · ${event.transaction}` : ''}</p>
          </div>
          {['received', 'failed', 'review'].includes(event.status) && <button type="button" className={button} disabled={busy} onClick={() => reprocess(event.id)}>Reprocessar</button>}
        </div>
        {event.plan && <div className="mt-3 rounded border border-gray-800 bg-gray-950/60 p-3">
          <p className="text-gray-300">{event.mode === 'shadow' ? 'Faria: ' : 'Plano: '}{event.plan.summary}</p>
          {event.plan.createUser ? <p className="mt-1 text-xs text-gray-400">Cria usuário novo{event.plan.invite ? ' e envia convite de primeiro acesso' : ''}.</p> : null}
          {event.plan.convertToPersonal && <p className="mt-1 text-xs text-gray-400">Converte plano global para Personalizado preservando o acesso atual.</p>}
          {!!event.plan.access?.length && <ul className="mt-2 grid gap-1 text-xs text-gray-300 sm:grid-cols-2">{event.plan.access.map(item => <li key={item.agentType}>{getAgentLabel(item.agentType)}: {item.enabled ? `até ${day(item.expiresAt)}` : 'sem acesso'}</li>)}</ul>}
          {!!event.plan.reviews?.length && <p className="mt-2 text-xs text-orange-300">Revisões: {event.plan.reviews.map(r => reviewLabel[r.kind] ?? r.kind).join(', ')}</p>}
        </div>}
        {event.errorCode && <p className="mt-2 text-xs text-red-300">Erro: {event.errorCode} (tentativas {event.attempts})</p>}
        {event.result && typeof event.result.invite === 'string' && <p className="mt-1 text-xs text-gray-400">Convite: {event.result.invite === 'sent' ? 'aceito pelo serviço de e-mail' : 'falhou'}</p>}
      </article>)}
    </section>}

    {tab === 'reviews' && <section className="space-y-3">
      {reviews.length === 0 && <p className="text-sm text-gray-500">Nenhuma revisão aberta.</p>}
      {reviews.map(review => <article key={review.id} className="rounded-lg border border-orange-500/30 bg-gray-900/40 p-4 text-sm">
        <p className="font-medium text-white">{reviewLabel[review.kind] ?? review.kind}{review.eventType ? ` · ${review.eventType}` : ''}</p>
        <p className="mt-1 text-xs text-gray-500">{when(review.createdAt)} · {review.userEmail ?? 'sem usuário vinculado'}</p>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-gray-950/70 p-2 text-xs text-gray-300">{JSON.stringify(review.details, null, 2)}</pre>
        <label className="mt-3 block text-xs text-gray-400">Motivo da decisão<input value={notes[review.id] ?? ''} onChange={e => setNotes(current => ({ ...current, [review.id]: e.target.value }))} className={`${field} mt-1`} maxLength={500} /></label>
        <div className="mt-3 flex flex-wrap gap-2">
          {review.proposal && review.userEmail && <button type="button" className={primary} disabled={busy} onClick={() => resolve(review.id, 'accept')}>Aceitar proposta Hotmart</button>}
          <button type="button" className={button} disabled={busy} onClick={() => resolve(review.id, 'keep')}>Manter como está</button>
          <button type="button" className={button} disabled={busy} onClick={() => resolve(review.id, 'dismiss')}>Descartar</button>
        </div>
      </article>)}
    </section>}
  </div>;
}
