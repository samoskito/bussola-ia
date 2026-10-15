'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

export default function FirstAccessForm() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const candidate = fragment.get('token');
    if (candidate) setToken(candidate);
    // Keep the one-time secret in component memory only, away from URL history and referrers.
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token || busy || done || blocked) return;
    if (password !== confirmation) { setError('As senhas precisam ser iguais.'); return; }
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/users/first-access', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
      const data = await response.json();
      if (!response.ok) {
        if ([401, 403, 410, 503].includes(response.status)) setBlocked(true);
        throw new Error(response.status === 503 ? 'Primeiro acesso indisponível neste momento. Solicite orientação ao administrador.' : data.error || data.message || 'O convite é inválido ou expirou. Solicite um novo link ao administrador.');
      }
      setToken(''); setPassword(''); setConfirmation(''); setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar a senha. Tente novamente.'); }
    finally { setBusy(false); }
  }
  const field = 'mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-3 text-white outline-none focus:border-orange-400 disabled:opacity-50';
  return <main className="flex min-h-screen items-center justify-center bg-gray-950 p-5 text-white"><section className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-7 sm:p-9"><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-orange-300">ExecutivIA · Primeiro acesso</p><h1 className="mt-5 text-3xl font-semibold tracking-tight">Escolha sua senha</h1>
    {done ? <div role="status" className="mt-7"><h2 className="text-xl text-emerald-300">Senha definida</h2><p className="mt-3 text-sm leading-relaxed text-gray-400">Seu convite foi utilizado. Entre com seu e-mail e a senha que você acabou de criar.</p><Link className="mt-5 inline-block rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-gray-950" href="/auth/login">Entrar na ExecutivIA</Link></div> : <><p className="mt-4 text-sm leading-relaxed text-gray-400">Use o link individual enviado pelo administrador. Ele tem validade limitada e só pode ser utilizado uma vez.</p><p className="mt-3 rounded-lg border border-orange-400/30 bg-orange-500/10 p-3 text-xs leading-relaxed text-orange-200">Ao utilizar este link, você define uma nova senha e substitui a senha anterior, se existir. Suas IAs liberadas não serão alteradas.</p><form className="mt-6 space-y-5" onSubmit={submit}><label className="block text-sm text-gray-300">Nova senha<input required minLength={8} maxLength={72} disabled={busy || blocked} autoComplete="new-password" type="password" className={field} value={password} onChange={e => setPassword(e.target.value)} /><span className="mt-2 block text-xs text-gray-500">Pelo menos 8 caracteres. Escolha uma senha que você não usa em outros serviços.</span></label><label className="block text-sm text-gray-300">Confirme a senha<input required minLength={8} maxLength={72} disabled={busy || blocked} autoComplete="new-password" type="password" className={field} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}{!token && <p role="status" className="text-sm leading-relaxed text-gray-400">Abra o link completo recebido no convite. Se ele já foi utilizado ou expirou, solicite um novo link.</p>}<button disabled={!token || busy || blocked} className="w-full rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-gray-950 hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Salvando senha…' : 'Definir minha senha'}</button>
    </form></>}
  </section></main>;
}
