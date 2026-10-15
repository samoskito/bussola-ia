'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AGENTS, getAgentLabel, type AgentType } from '@/lib/agents';
import type { AdminUser, AdminUserAudit, AdminUserList, AdminInviteResult } from '@/lib/admin-users/types';

const field = 'mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400';
const button = 'rounded-lg border border-gray-700 px-4 py-2.5 text-sm transition hover:border-orange-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400 disabled:cursor-not-allowed disabled:opacity-40';
const primary = `${button} border-orange-500 bg-orange-500 text-gray-950 font-semibold hover:bg-orange-400`;
const statusLabel = { active: 'Ativo', expired: 'Expirado', none: 'Sem acesso' };
const sourceLabel = { admin: 'Administrador vitalício', global: 'Plano global', individual: 'Liberação individual', none: 'Sem liberação' };
const actions = { created: 'Usuário criado', profile_updated: 'Cadastro editado', access_updated: 'Acessos alterados', invite_generated: 'Link gerado', invite_simulated_sent: 'Envio de convite simulado', demo_password_confirmed: 'Primeiro acesso simulado', invite_sent: 'Convite aceito pelo serviço de e-mail', invite_send_failed: 'Falha no envio do convite', password_defined: 'Senha definida pelo destinatário' };
const date = (value: string | null) => value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('pt-BR') : 'Sem vencimento';
class RequestError extends Error { constructor(public status: number, message: string, public code?: string) { super(message); } }
async function api<T>(path = '', method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/admin/users${path}`, { method, cache: 'no-store', ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw new RequestError(response.status, response.status === 401 ? 'Sua sessão expirou. Entre novamente.' : response.status === 403 ? 'Acesso exclusivo para administradores.' : response.status === 503 ? 'Administração desativada ou indisponível. As ações estão bloqueadas.' : data.error || data.message || 'Não foi possível concluir a operação.', data.code);
  return data;
}
type AccessDraft = Pick<AdminUser['access'][number], 'agentType' | 'enabled' | 'expiresAt'>;
type Editor = { kind: 'create' | 'profile' | 'access'; nome: string; email: string; telefone: string; agentTypes: AgentType[]; expiresAt: string; access: AccessDraft[]; reason: string; review: boolean };

export default function AdminUsersDashboard({ mode: initialMode = 'demo' }: { mode?: 'demo' | 'live' }) {
  const [q, setQ] = useState('');
  const [agent, setAgent] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [list, setList] = useState<AdminUserList | null>(null);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [events, setEvents] = useState<AdminUserAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [inviteAction, setInviteAction] = useState<{ action: 'generate' | 'send'; reason: string; review: boolean } | null>(null);
  const inviteDialogRef = useRef<HTMLDialogElement>(null);
  const [invite, setInvite] = useState<AdminInviteResult['invite'] | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const requestId = useRef(0);
  const mode = list?.mode || initialMode;
  const isDemo = mode === 'demo';
  const detailRequest = useRef(0);
  const editorRef = useRef<HTMLDialogElement>(null);
  const editorTitleRef = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  function fail(err: unknown) {
    setError(err instanceof Error ? err.message : 'Falha de conexão. Tente novamente.');
    if (err instanceof RequestError && [401, 403, 503].includes(err.status)) setBlocked(true);
  }
  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const data = await api<AdminUserList>(`?${new URLSearchParams({ q, agentType: agent, status, page: String(page), pageSize: '8' })}`);
      if (id === requestId.current) { setList(data); setBlocked(false); setError(''); }
    } catch (err) { if (id === requestId.current) fail(err); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [q, agent, status, page]);
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (editor) { opener.current = document.activeElement as HTMLElement; editorRef.current?.showModal(); }
    else { editorRef.current?.close(); opener.current?.focus(); }
  }, [Boolean(editor)]);
  useEffect(() => {
    editorRef.current?.scrollTo(0, 0);
    if (editor?.review) editorTitleRef.current?.focus({ preventScroll: true });
  }, [editor?.review]);
  useEffect(() => { if (inviteAction) inviteDialogRef.current?.showModal(); else inviteDialogRef.current?.close(); }, [Boolean(inviteAction)]);
  async function select(user: AdminUser) {
    const id = ++detailRequest.current;
    setSelected(user); setEvents([]); setInvite(null); setNotice(''); setError('');
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      const [detail, audit] = await Promise.all([api<{ user: AdminUser }>(`/${user.id}`), api<{ events: AdminUserAudit[] }>(`/${user.id}/audit`)]);
      if (id === detailRequest.current) { setSelected(detail.user); setEvents(audit.events); }
    } catch (err) { if (id === detailRequest.current) fail(err); }
  }
  function open(kind: Editor['kind']) {
    setError('');
    const access = AGENTS.map(agent => {
      const current = selected?.access.find(item => item.agentType === agent.type);
      return { agentType: agent.type, enabled: current?.enabled ?? false, expiresAt: current?.expiresAt ?? null };
    });
    setEditor({ kind, nome: kind === 'create' ? '' : selected?.nome || '', email: kind === 'create' ? '' : selected?.email || '', telefone: kind === 'create' ? '' : selected?.telefone || '', agentTypes: [], expiresAt: '', access, reason: '', review: false });
  }
  function change(values: Partial<Editor>) { setEditor(e => e ? { ...e, ...values } : null); }
  function changeAccess(agentType: AgentType, values: Partial<Pick<AccessDraft, 'enabled' | 'expiresAt'>>) {
    setEditor(current => current ? { ...current, access: current.access.map(item => item.agentType === agentType ? { ...item, ...values } : item) } : null);
  }
  async function save() {
    if (!editor || busy || blocked) return;
    setBusy(true); setError('');
    try {
      const profile = { nome: editor.nome, email: editor.email, telefone: editor.telefone || null, reason: editor.reason };
      const access = { agentTypes: editor.agentTypes, expiresAt: editor.expiresAt || null, reason: editor.reason };
      const result = editor.kind === 'create' ? await api<{ user: AdminUser }>('', 'POST', { ...profile, ...access }) : editor.kind === 'profile' ? await api<{ user: AdminUser }>(`/${selected!.id}`, 'PATCH', { ...profile, revision: selected!.revision }) : await api<{ user: AdminUser }>(`/${selected!.id}/access`, 'POST', { access: editor.access, reason: editor.reason, revision: selected!.revision });
      setEditor(null); await select(result.user); await load(); setNotice(isDemo ? 'Alteração salva somente na demonstração.' : 'Alteração salva.');
    } catch (err) { fail(err); if (err instanceof RequestError && err.status === 409 && err.code === 'revision_conflict' && selected) { setEditor(null); await select(selected); setError('O cadastro mudou. Reabra a edição, confira os dados atualizados e refaça sua alteração.'); } }
    finally { setBusy(false); }
  }
  async function issueInvite(action: 'generate' | 'send', reason: string) {
    if (!selected || busy || blocked) return;
    setBusy(true); setError(''); setInvite(null);
    try {
      const result = await api<AdminInviteResult>(`/${selected.id}/invite`, 'POST', { revision: selected.revision, action, reason });
      setInviteAction(null); setSelected(result.user); setInvite(result.invite);
      setNotice(action === 'send' ? result.invite.simulated ? 'Envio simulado registrado. Nenhum e-mail foi enviado.' : 'Convite aceito pelo serviço de e-mail para envio. A entrega deve ser confirmada pelo destinatário.' : result.invite.simulated ? 'Link temporário gerado. Ele funciona somente nesta demonstração.' : 'Link temporário gerado. Compartilhe somente com o destinatário indicado.');
      try { const audit = await api<{ events: AdminUserAudit[] }>(`/${selected.id}/audit`); setEvents(audit.events); } catch { setError('Convite emitido, mas não foi possível atualizar o histórico. Reabra a ficha para conferir.'); }
      await load();
    } catch (err) { fail(err); if (err instanceof RequestError && err.status === 409 && err.code === 'revision_conflict') { await select(selected); setInviteAction(v => v ? { ...v, review: false } : null); setError('O cadastro mudou. Confira a ficha atualizada antes de emitir outro convite.'); } } finally { setBusy(false); }
  }
  const disabled = busy || blocked;
  return <div className="mx-auto max-w-[1500px] p-4 sm:p-6 xl:p-9">
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-gray-800 pb-7">
      <div><p className="mb-2 text-[11px] font-semibold uppercase tracking-[.22em] text-orange-400">Administração / Pessoas</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Usuários e acessos</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-400">Encontre uma pessoa, confira suas IAs e revise cada mudança antes de salvar.</p></div>
      <button className={primary} disabled={disabled || loading} onClick={() => open('create')}>＋ Novo usuário</button>
    </header>
    {error && <div role="alert" className="mb-5 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{error} <button className="ml-3 underline" onClick={load}>Tentar novamente</button></div>}
    {notice && <p role="status" className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</p>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(390px,.85fr)]">
      <section aria-label="Lista de usuários" className="min-w-0">
        <div className="grid gap-3 rounded-xl border border-gray-800 bg-gray-900/60 p-4 sm:grid-cols-2">
          <label className="text-xs text-gray-400 sm:col-span-2">Buscar pessoa<input type="search" className={field} placeholder="Nome, e-mail ou telefone" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} /></label>
          <label className="text-xs text-gray-400">IA liberada<select className={field} value={agent} onChange={e => { setAgent(e.target.value); setPage(1); }}><option value="">Todas as IAs</option>{AGENTS.map(a => <option value={a.type} key={a.type}>{a.name}</option>)}</select></label>
          <label className="text-xs text-gray-400">Situação<select className={field} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">Todas as situações</option><option value="active">Ativo</option><option value="expired">Expirado</option><option value="none">Sem acesso</option></select></label>
        </div>
        <div className="my-4 flex items-center justify-between text-xs text-gray-400"><span>{loading ? 'Buscando…' : `${list?.total || 0} pessoas encontradas`}</span><span>{isDemo ? 'Base fictícia' : 'Base de usuários'}</span></div>
        <div className="space-y-2" aria-busy={loading}>
          {!loading && !list?.users.length && <p className="rounded-xl border border-dashed border-gray-700 p-10 text-center text-sm text-gray-400">Nenhum usuário para esta busca. Ajuste os filtros.</p>}
          {list?.users.map(user => <button key={user.id} disabled={disabled} onClick={() => select(user)} aria-pressed={selected?.id === user.id} className={`group w-full rounded-xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400 ${selected?.id === user.id ? 'border-orange-400/70 bg-orange-500/[.07]' : 'border-gray-800 bg-gray-900/40 hover:border-gray-600'}`}>
            <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-sm font-medium text-orange-200" aria-hidden="true">{user.nome.slice(0, 2).toUpperCase()}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-medium">{user.nome}</h2><Badge status={user.status} /></div><p className="mt-1 break-all text-xs text-gray-400">{user.email}</p><p className="mt-1 text-xs text-gray-500">{user.telefone || 'Telefone não informado'}</p></div></div>
            <div className="mt-4 flex flex-wrap gap-1.5">{user.access.map(a => <span title={`${getAgentLabel(a.agentType)}: ${a.effective ? 'liberado' : 'bloqueado'}`} key={a.agentType} className={`rounded border px-2 py-1 text-[10px] ${a.effective ? 'border-emerald-400/25 bg-emerald-400/5 text-emerald-300' : 'border-gray-800 text-gray-500'}`}>{a.agentType === 'comunicacao' ? 'Comunicação' : a.agentType === 'apresentacao' ? 'Apresentação' : a.agentType === 'conversas_dificeis' ? 'Conversas' : 'LinkedIn'} {a.effective ? '✓' : '—'}</span>)}</div>
          </button>)}
        </div>
        {list && list.totalPages > 1 && <div className="mt-4 flex items-center justify-between gap-2 text-xs text-gray-400"><button className={button} disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Anterior</button><span>{page} / {list.totalPages}</span><button className={button} disabled={page >= list.totalPages || loading} onClick={() => setPage(p => p + 1)}>Próxima</button></div>}
      </section>
      <section ref={detailRef} aria-label="Ficha do usuário" className="min-w-0 scroll-mt-4 rounded-xl border border-gray-800 bg-gray-900/50 p-5 sm:p-6">
        {!selected ? <div className="flex min-h-80 flex-col justify-center border-l-2 border-orange-500/60 pl-6"><p className="text-xs uppercase tracking-widest text-orange-300">Ficha administrativa</p><h2 className="mt-3 text-2xl font-medium">Cada acesso tem uma origem.</h2><p className="mt-3 max-w-sm text-sm leading-relaxed text-gray-400">Selecione uma pessoa para consultar cadastro, permissões efetivas, convite e histórico de alterações.</p></div> : <>
          <div className="flex flex-wrap justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[.2em] text-gray-500">Ficha administrativa</p><h2 className="mt-2 break-words text-2xl font-medium">{selected.nome}</h2></div><Badge status={selected.status} /></div>
          <dl className="my-5 grid gap-4 border-y border-gray-800 py-5 text-sm sm:grid-cols-2"><div><dt className="text-xs text-gray-500">E-mail</dt><dd className="mt-1 break-all">{selected.email}</dd></div><div><dt className="text-xs text-gray-500">Telefone</dt><dd className="mt-1">{selected.telefone || 'Não informado'}</dd></div><div><dt className="text-xs text-gray-500">Plano / nível</dt><dd className="mt-1">{selected.plano || 'Sem plano'} · {selected.nivel === 'admin' ? 'Administrador' : 'Usuário comum'}</dd></div><div><dt className="text-xs text-gray-500">Validade global</dt><dd className="mt-1">{selected.nivel === 'admin' ? 'Vitalício' : date(selected.data_expiracao)}</dd></div></dl>
          <div className="mb-6 flex flex-wrap gap-2"><button className={button} disabled={disabled || selected.nivel === 'admin'} onClick={() => open('profile')}>Editar cadastro</button><button className={button} disabled={disabled || selected.nivel === 'admin'} onClick={() => open('access')}>Gerenciar acessos</button></div>
          {selected.nivel === 'admin' && <p className="mb-4 text-xs text-orange-200">Conta administrativa: acesso vitalício. Edição bloqueada neste painel.</p>}
          <h3 className="mb-3 text-sm font-semibold">Acesso efetivo às quatro IAs</h3>
          <div className="space-y-2">{selected.access.map(a => <div key={a.agentType} className="rounded-lg border border-gray-800 bg-gray-950/60 p-3"><div className="flex items-start justify-between gap-3"><h4 className="text-sm">{getAgentLabel(a.agentType)}</h4><span className={`shrink-0 text-xs ${a.effective ? 'text-emerald-300' : 'text-gray-500'}`}>{a.effective ? 'Liberado' : 'Bloqueado'}</span></div><p className="mt-2 text-xs leading-relaxed text-gray-400">{sourceLabel[a.source]} · {a.source === 'admin' ? 'Vitalício' : `Validade: ${date(a.expiresAt)}`}{!a.effective && a.enabled ? ' · Prazo vencido ou bloqueio global' : ''}</p></div>)}</div>
          <div className="mt-6 border-t border-gray-800 pt-5"><h3 className="text-sm font-semibold">Primeiro acesso</h3><p className="mt-2 text-xs leading-relaxed text-gray-400">{isDemo ? 'O próprio usuário escolhe a senha. Link temporário e envio são simulados; nenhum e-mail real sai deste painel.' : 'O próprio usuário escolhe a senha pelo link temporário. Um novo link invalida o anterior. O envio por e-mail exige revisão e confirmação.'}</p><p className="mt-2 text-xs text-gray-500">Estado: {({ none: 'não emitido', generated: 'link gerado', simulated_sent: 'envio simulado', consumed: 'utilizado', expired: 'expirado', sent: 'enviado ao serviço de e-mail', send_failed: 'falha no envio' })[selected.invite.status]}</p><div className="mt-3 flex flex-wrap gap-2"><button className={button} disabled={disabled || selected.nivel === 'admin'} onClick={() => { setError(''); setInviteAction({ action: 'generate', reason: '', review: false }); }}>Gerar link temporário</button><button className={button} disabled={disabled || selected.nivel === 'admin'} onClick={() => { setError(''); setInviteAction({ action: 'send', reason: '', review: false }); }}>{isDemo ? 'Simular envio de e-mail' : 'Enviar convite por e-mail'}</button></div>
          {invite && <div className="mt-3 rounded-lg border border-orange-500/25 bg-orange-500/5 p-3"><label className="text-xs text-orange-200">{invite.simulated ? 'Link de demonstração' : 'Link de primeiro acesso'} · expira em {new Date(invite.expiresAt).toLocaleString('pt-BR')}<input readOnly className={field} value={typeof window === 'undefined' ? invite.url : new URL(invite.url, window.location.origin).href} onFocus={e => e.target.select()} /></label><div className="mt-2 flex gap-3"><button className="text-xs text-orange-300 underline" onClick={async () => { try { await navigator.clipboard.writeText(new URL(invite.url, window.location.origin).href); setNotice('Link copiado.'); } catch { setNotice('Selecione o campo e copie o link manualmente.'); } }}>Copiar link</button><a className="text-xs text-orange-300 underline" href={invite.url}>{invite.simulated ? 'Abrir simulação' : 'Abrir primeiro acesso'}</a></div></div>}
          </div>
          <div className="mt-6 border-t border-gray-800 pt-5"><h3 className="mb-4 text-sm font-semibold">Histórico de alterações</h3>{events.length ? <ol className="space-y-4">{events.map(event => <li className="border-l border-gray-700 pl-3" key={event.id}><p className="text-xs font-medium">{actions[event.action] || event.action}</p><p className="mt-1 text-xs text-gray-400">{event.reason}</p><p className="mt-1 break-all text-[10px] text-gray-500">{new Date(event.createdAt).toLocaleString('pt-BR')} · {event.actor}</p><details className="mt-1 text-xs text-gray-500"><summary className="cursor-pointer">Ver alterações registradas</summary><pre className="mt-2 whitespace-pre-wrap break-all rounded bg-gray-950 p-2">{JSON.stringify(event.changes, null, 2)}</pre></details></li>)}</ol> : <p className="text-xs text-gray-500">Nenhuma alteração registrada.</p>}</div>
        </>}
      </section>
    </div>
    <dialog ref={inviteDialogRef} onCancel={e => { if (busy) e.preventDefault(); else setInviteAction(null); }} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-6 text-white shadow-2xl backdrop:bg-black/80" aria-labelledby="invite-title">
      {inviteAction && <form onSubmit={e => { e.preventDefault(); if (inviteAction.review) issueInvite(inviteAction.action, inviteAction.reason); else setInviteAction({ ...inviteAction, review: true }); }}>
        <p className="text-xs uppercase tracking-widest text-orange-300">{isDemo ? 'Demo local' : 'Primeiro acesso'} · {inviteAction.review ? 'Revisão' : 'Preparação'}</p><h2 id="invite-title" className="mt-3 text-2xl font-semibold">{inviteAction.action === 'send' ? isDemo ? 'Simular envio de convite' : 'Enviar convite' : 'Gerar link temporário'}</h2>
        <p className="mt-4 break-all text-sm text-gray-300">Destinatário: {selected?.nome} · {selected?.email}</p>
        {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
        {inviteAction.review ? <div className="my-5 space-y-3 rounded-lg border border-gray-700 bg-gray-950 p-4 text-sm"><p>Antes: {selected?.invite.status === 'none' ? 'nenhum convite' : 'convite existente'}.</p><p>Depois: um novo link temporário será emitido. Links anteriores serão invalidados.</p>{!isDemo && <p className="rounded-lg border border-orange-400/40 bg-orange-500/10 p-3 text-orange-200">Este link permite definir uma senha nova e substituir a senha atual, se existir. Não altera as IAs liberadas.</p>}<p>{isDemo ? 'Apenas simulação; nenhum e-mail será enviado.' : inviteAction.action === 'send' ? 'O serviço tentará enviar um e-mail real para o endereço acima.' : 'Nenhum e-mail será enviado. O link ficará disponível para cópia.'}</p><p className="break-words text-gray-400">Motivo: {inviteAction.reason}</p></div> : <label className="my-5 block text-xs text-gray-400">Motivo do convite<textarea required minLength={5} maxLength={500} rows={2} className={field} value={inviteAction.reason} onChange={e => setInviteAction({ ...inviteAction, reason: e.target.value })} /></label>}
        <div className="flex justify-end gap-2"><button type="button" disabled={busy} className={button} onClick={() => inviteAction.review ? setInviteAction({ ...inviteAction, review: false }) : setInviteAction(null)}>{inviteAction.review ? 'Voltar e ajustar' : 'Cancelar'}</button><button type="submit" disabled={disabled} className={primary}>{busy ? 'Processando…' : inviteAction.review ? 'Confirmar' : 'Revisar convite'}</button></div>
      </form>}
    </dialog>
    <dialog ref={editorRef} onCancel={e => { if (busy) e.preventDefault(); else setEditor(null); }} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-0 text-white shadow-2xl backdrop:bg-black/80" aria-labelledby="editor-title">
      {editor && <form className="p-5 sm:p-7" onSubmit={(e: FormEvent) => { e.preventDefault(); if (editor.review) save(); else change({ review: true }); }}>
        <p className="mb-2 text-[10px] uppercase tracking-widest text-orange-300">{isDemo ? 'Demo local' : 'Administração'} · {editor.review ? '02 / Revisão' : '01 / Preparação'}</p><h2 id="editor-title" ref={editorTitleRef} tabIndex={-1} className="text-2xl font-semibold outline-none">{editor.review ? 'Confira antes de salvar' : editor.kind === 'create' ? 'Novo usuário' : editor.kind === 'profile' ? 'Editar cadastro' : 'Gerenciar acessos'}</h2>
        {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
        {editor.review ? <div className="my-5 space-y-4 rounded-lg border border-gray-700 bg-gray-950 p-4 text-sm"><p className="text-xs leading-relaxed text-orange-200">{isDemo ? 'Somente dados fictícios serão alterados. Nenhum convite é enviado ao salvar.' : 'Esta alteração será aplicada ao cadastro abaixo. Nenhum convite é enviado ao salvar.'}</p>{editor.kind !== 'access' && <><p><span className="block text-xs text-gray-500">Nome</span>{editor.kind === 'profile' && `${selected?.nome} → `}{editor.nome}</p><p className="break-all"><span className="block text-xs text-gray-500">E-mail</span>{editor.kind === 'profile' && `${selected?.email} → `}{editor.email}</p><p><span className="block text-xs text-gray-500">Telefone</span>{editor.kind === 'profile' && `${selected?.telefone || 'Vazio'} → `}{editor.telefone || 'Vazio'}</p></>}
          {editor.kind === 'create' && <><p><span className="block text-xs text-gray-500">Antes</span>Novo cadastro sem acessos</p><p><span className="block text-xs text-gray-500">Depois · conjunto completo de IAs</span>{editor.agentTypes.map(getAgentLabel).join(', ') || 'Nenhuma IA liberada'}</p><p>Validade das IAs selecionadas: {editor.expiresAt ? `${date(editor.expiresAt)} (inclusive)` : 'Sem vencimento'}</p></>}
          {editor.kind === 'access' && <><AccessReview before={selected?.access || []} after={editor.access} /><p className="text-xs leading-relaxed text-gray-400">IAs desmarcadas serão revogadas. As datas de cada IA serão mantidas conforme a revisão. Plano global será convertido para acessos individuais ao salvar.</p></>}
          <p><span className="block text-xs text-gray-500">Motivo registrado</span>{editor.reason}</p></div> : <div className="my-5 space-y-4">
          {editor.kind !== 'access' && <><label className="block text-xs text-gray-400">Nome<input required maxLength={120} className={field} value={editor.nome} onChange={e => change({ nome: e.target.value })} /></label><label className="block text-xs text-gray-400">E-mail<input required type="email" maxLength={254} className={field} value={editor.email} onChange={e => change({ email: e.target.value })} /></label><label className="block text-xs text-gray-400">Telefone<input type="tel" maxLength={30} className={field} value={editor.telefone} onChange={e => change({ telefone: e.target.value })} /></label></>}
          {editor.kind === 'create' && <><fieldset><legend className="mb-2 text-xs text-gray-400">IAs que ficarão liberadas</legend>{AGENTS.map(a => <label className="mb-2 flex items-start gap-3 rounded-lg border border-gray-700 p-3 text-sm" key={a.type}><input type="checkbox" className="mt-1 accent-orange-500" checked={editor.agentTypes.includes(a.type)} onChange={e => change({ agentTypes: e.target.checked ? [...editor.agentTypes, a.type] : editor.agentTypes.filter(t => t !== a.type) })} />{a.name}</label>)}</fieldset><label className="block text-xs text-gray-400">Validade das IAs selecionadas<input type="date" min={new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())} className={field} value={editor.expiresAt} onChange={e => change({ expiresAt: e.target.value })} /><span className="mt-1 block text-gray-500">Em branco: sem vencimento. A data inclui o dia informado.</span></label></>}
          {editor.kind === 'access' && <><fieldset><legend className="mb-2 text-xs text-gray-400">Acesso e validade de cada IA</legend>{editor.access.map(item => <div className="mb-3 rounded-lg border border-gray-700 p-3" key={item.agentType}><label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 accent-orange-500" checked={item.enabled} onChange={e => changeAccess(item.agentType, { enabled: e.target.checked })} />{getAgentLabel(item.agentType)}</label><label className="mt-3 block text-xs text-gray-400">Validade de {getAgentLabel(item.agentType)}<input type="date" className={field} value={item.expiresAt || ''} onChange={e => changeAccess(item.agentType, { expiresAt: e.target.value || null })} /><span className="mt-1 block text-gray-500">{item.expiresAt ? `Até ${date(item.expiresAt)}, inclusive.` : 'Sem vencimento (campo em branco).'}{!item.enabled && ' IA desmarcada: sem acesso, mesmo com uma data registrada.'}</span></label></div>)}</fieldset><p className="text-xs leading-relaxed text-gray-400">Cada data vale somente para sua IA. Desmarcar revoga o acesso; mantenha os demais campos para preservar as outras permissões. Ao salvar, o plano global será convertido para acessos individuais.</p></>}
          <label className="block text-xs text-gray-400">Motivo da alteração<textarea required minLength={5} maxLength={500} rows={2} className={field} placeholder="Ex.: bônus aprovado pelo atendimento" value={editor.reason} onChange={e => change({ reason: e.target.value })} /></label>
          {editor.kind === 'create' && <p className="text-xs text-gray-500">Cadastro de usuário comum. O convite de primeiro acesso pode ser gerado depois.</p>}
        </div>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-800 pt-4"><button type="button" className={button} disabled={busy} onClick={() => editor.review ? change({ review: false }) : setEditor(null)}>{editor.review ? 'Voltar e ajustar' : 'Cancelar'}</button><button type="submit" className={primary} disabled={disabled}>{busy ? 'Salvando…' : editor.review ? isDemo ? 'Confirmar na demo' : 'Confirmar alteração' : 'Revisar alteração'}</button></div>
      </form>}
    </dialog>
  </div>;
}

function AccessReview({ before, after }: { before: AdminUser['access']; after: AccessDraft[] }) {
  return <div className="space-y-3">{after.map(item => {
    const previous = before.find(access => access.agentType === item.agentType);
    const changed = previous?.enabled !== item.enabled || previous?.expiresAt !== item.expiresAt;
    return <section key={item.agentType} aria-label={`Revisão de ${getAgentLabel(item.agentType)}`} className="rounded-lg border border-gray-700 p-3">
      <h3 className="text-sm font-medium">{getAgentLabel(item.agentType)}</h3><p className={`mt-1 text-xs ${changed ? 'text-orange-300' : 'text-gray-500'}`}>{changed ? 'Será alterada' : 'Mantida'}</p>
      <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
        <div><h4 className="text-gray-500">Antes</h4><p className="mt-1">{previous?.enabled ? 'Liberada' : 'Sem acesso'}{previous?.enabled && !previous.effective ? ' (prazo vencido ou bloqueio global)' : ''}</p><p className="mt-1">Validade: {previous?.expiresAt ? `${date(previous.expiresAt)} (inclusive)` : 'Sem vencimento'}</p></div>
        <div><h4 className="text-gray-500">Depois</h4><p className="mt-1">{item.enabled ? 'Liberada' : 'Sem acesso (revogada)'}</p><p className="mt-1">Validade: {item.expiresAt ? `${date(item.expiresAt)} (inclusive)` : 'Sem vencimento'}</p></div>
      </div>
    </section>;
  })}</div>;
}

function Badge({ status }: { status: AdminUser['status'] }) { return <span className={`h-fit rounded-full border px-2.5 py-1 text-[10px] font-medium ${status === 'active' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : status === 'expired' ? 'border-amber-400/30 bg-amber-400/10 text-amber-300' : 'border-gray-700 text-gray-400'}`}>{statusLabel[status]}</span>; }
