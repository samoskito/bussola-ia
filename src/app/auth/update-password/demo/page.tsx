'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

export default function DemoFirstAccessPage() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get('token') || ''); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) { setError('As senhas precisam ser iguais.'); return; }
    if (!token || busy || done) return;
    setBusy(true); setError('');
    try {
      // Password fields only demonstrate the recipient experience. Never transmit or persist them.
      const response = await fetch('/api/admin/users/demo-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      const data = await response.json();
      if (response.status === 503) setUnavailable(true);
      if (!response.ok) throw new Error(data.error || data.message || 'Link inválido, expirado ou demonstração desativada.');
      setPassword(''); setConfirmation(''); setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível concluir a simulação.'); }
    finally { setBusy(false); }
  }
  const field = 'mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-3 text-white outline-none focus:border-orange-400';
  return <main className="flex min-h-screen items-center justify-center bg-gray-950 p-5 text-white"><section className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-7 sm:p-9"><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-orange-300">ExecutivIA · Demo local</p><h1 className="mt-5 text-3xl font-semibold tracking-tight">Seu primeiro acesso</h1><p className="mt-4 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-xs leading-relaxed text-orange-200">Simulação com dados fictícios. A senha digitada não será enviada nem salva. Esta tela não cria uma senha válida para entrar no aplicativo.</p>
    {done ? <div role="status" className="mt-7"><h2 className="text-xl text-emerald-300">Simulação concluída</h2><p className="mt-3 text-sm leading-relaxed text-gray-400">O link foi consumido apenas na demonstração. Nenhuma senha real foi criada ou alterada.</p><Link className="mt-5 inline-block text-sm text-orange-300 underline" href="/auth/login">Ir para a entrada do aplicativo</Link></div> : <form className="mt-6 space-y-5" onSubmit={submit}>
      <label className="block text-sm text-gray-300">Escolha uma senha fictícia<input required minLength={8} maxLength={128} autoComplete="off" type="password" className={field} value={password} onChange={e => setPassword(e.target.value)} /><span className="mt-2 block text-xs text-gray-500">Use pelo menos 8 caracteres apenas para testar a tela.</span></label><label className="block text-sm text-gray-300">Confirme a senha fictícia<input required minLength={8} maxLength={128} autoComplete="off" type="password" className={field} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}{!token && <p role="status" className="text-sm text-gray-400">Abra o link temporário gerado pelo painel de demonstração.</p>}<button disabled={!token || busy || unavailable} className="w-full rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-gray-950 hover:bg-orange-400 disabled:opacity-40">{busy ? 'Confirmando…' : 'Concluir simulação'}</button>
    </form>}
  </section></main>;
}
