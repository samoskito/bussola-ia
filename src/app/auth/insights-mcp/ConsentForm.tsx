'use client';
import { useRef, useState, type FormEvent } from 'react';

// Formulario nativo (POST same-origin). Evita duplo envio sem trocar por fetch:
// o bloqueio e o desabilitar dos botoes acontecem so no proximo tick, depois que o
// navegador montou o corpo do formulario com o name/value do botao clicado.
export default function ConsentForm({ nonce }: { nonce: string }) {
  const sent = useRef(false);
  const [busy, setBusy] = useState(false);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (sent.current) { event.preventDefault(); return; }
    sent.current = true;
    setTimeout(() => setBusy(true), 0);
  }
  return <form action="/api/insights-mcp/oauth/authorize" method="post" onSubmit={onSubmit} className="flex flex-wrap items-center gap-3" aria-busy={busy}>
    <input type="hidden" name="csrf" value={nonce} />
    <button type="submit" name="decision" value="approve" disabled={busy} className="rounded-lg bg-orange-500 px-5 py-3 font-semibold text-black hover:bg-orange-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-300 disabled:cursor-not-allowed disabled:opacity-60">Autorizar somente leitura</button>
    <button type="submit" name="decision" value="deny" disabled={busy} className="rounded-lg border border-gray-600 px-5 py-3 hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60">Cancelar</button>
    {busy && <p role="status" className="text-sm text-gray-300">Conectando…</p>}
  </form>;
}
